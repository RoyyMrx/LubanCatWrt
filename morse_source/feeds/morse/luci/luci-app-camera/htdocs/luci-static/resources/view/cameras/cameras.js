/* This provides an interface to cameras on the local network.
 *
 * Main functionality:
 *  - discover cameras via ONVIF and show info
 *  - use MediaMTX to create proxy streams on the AP
 *    (so they're viewable in the browser and can
 *    be reliably accessed in case the IP cameras
 *    aren't accessible by the client)
 *  - provide a live view of the camera stream
 *    that allows tweaking of parameters via ONVIF
 *
 * It looks a bit like this:
 *
 *     camera.js -> openwrt_ap:8889/* (WebRTC video streams)
 *      |
 *     ubus (on openwrt_ap) -> /usr/lib/rpcd/onvif.so -> ONVIF IP cameras on network
 *                          -> /usr/libexec/mediamtx -> openwrt_ap:9997 (mediamtx API)
 *
 * i.e. we communicate with both (remote) ONVIF cameras and MediaMTX (on the AP)
 * via rpcd plugins.
 */

'use strict';

'require form';
'require network';
'require rpc';
'require view';
'require uci';
'require ui';

'require view.cameras.videolive as videolive';

document.querySelector('head').appendChild(E('link', {
	'rel': 'stylesheet',
	'type': 'text/css',
	'href': L.resource('view/cameras/css/custom.css')
}));

const RESTART_PAUSE = 2000;

var callLuciNetworkDevices = rpc.declare({
	object: 'luci-rpc',
	method: 'getNetworkDevices',
	expect: { '': {} },
	reject: true,
});

const onvif = {
	probe: rpc.declare({
		object: 'onvif',
		method: 'probe',
		params: [ 'multicast_ip' ],
		expect: { devices: [] },
		reject: true,
	}),

	info: rpc.declare({
		object: 'onvif',
		method: 'info',
		params: [ 'device_url', 'username', 'password' ],
		expect: { '': {} },
		reject: true,
	}),

	set_encoder: rpc.declare({
		object: 'onvif',
		method: 'set_encoder',
		params: [ 'media_url', 'username', 'password', 'encoder_token', 'config' ],
		expect: { '': {} },
		reject: true,
	}),

	set_imaging: rpc.declare({
		object: 'onvif',
		method: 'set_imaging',
		params: [ 'imaging_url', 'username', 'password', 'source_token', 'settings' ],
		expect: { '': {} },
		reject: true,
	}),

	get_stream: rpc.declare({
		object: 'onvif',
		method: 'get_stream',
		params: [ 'media_url', 'username', 'password', 'encoder_token', 'source_config_token' ],
		expect: { 'stream_url': '' },
		reject: true,
	}),
};

const mediamtx = {
	set_proxy: rpc.declare({
		object: 'mediamtx',
		method: 'set_proxy',
		params: [ 'stream_url' ],
		reject: true,
	}),

	get_ports: rpc.declare({
		object: 'mediamtx',
		method: 'get_ports',
		params: [],
		reject: true,
	}),
}

// Load uci section style config (flat object), and make it nested by interpreting '__'
// as a reference to a dict field. i.e. resolution__height => {resolution: {height: ...}}
// Also find things that look like numbers and make them numbers, which is a terrible
// idea that I will probably curse myself for.
function uciToJson(o, target = {}) {
	for (const [k, v] of Object.entries(o || {})) {
		const loc = k.split('__');
		const finalField = loc.pop();
		let currTarget = target;
		for (const field of loc) {
			currTarget = (currTarget[field] ??= {});
		}
		currTarget[finalField] = /^\d+$/.test(v) ? Number(v) : v;
	}

	return target;
}

function jsonToUci(o, key = null, target = {}) {
	// Turn {resolution: {height: ...}} into resolution__height ...
	if (!(o instanceof Object)) {
		target[key] = o;
		return target;
	}

	for (const [subKey, subValue] of Object.entries(o)) {
		jsonToUci(subValue, key ? `${key}__${subKey}` : subKey, target);
	}

	return target;
}


const ENCODER_DEFAULT_FIELDS = new Set([
	'resolution__width', 'resolution__height', 'quality', 'bitrate', 'govlength',
	'encoding', 'profile', 'framerate'
]);
class EncoderDefaults {
	constructor() {
		this.observers = [];
		this.load();
	}

	registerObserver(o) {
		this.observers.push(o);
	}

	get() {
		return this.config;
	}

	load() {
		this.config = uciToJson(uci.get('cameras', 'encoder_defaults'));
	}

	save(c) {
		for (const [k, v] of Object.entries(jsonToUci(c))) {
			if (ENCODER_DEFAULT_FIELDS.has(k)) {
				uci.set('cameras', 'encoder_defaults', k, v);
			}
		}

		this.config = c;
		for (const o of this.observers) {
			o();
		}
		// TODO handle failure.
		uci.save();
	}
}


let NEXT_ID = 1;

class ONVIFDevice {
	constructor(encoderDefaults, endpointReferenceAddress, deviceUrl, username, password) {
		this.id = NEXT_ID++;
		this.encoderDefaults = encoderDefaults;
		this.endpointReferenceAddress = endpointReferenceAddress;
		this.deviceUrl = deviceUrl;
		const url = new URL(deviceUrl);
		this.webUrl = `${url.protocol}//${url.host}/`;
		this.username = username;
		this.password = password;
		this.info = null;
		this.streamUrl = null;
		this.receiver = null;
		this.encoderToken = null;
		this.sourceToken = null;
		this.sourceConfigToken = null;
		this.videoElement = null;

		// This is used to report info when device discovery succeeds but our onvif info call blows up.
		this.info = {hostname: _('Unknown'), model: _('ONVIF query failure'), firmware: ''};
		this.proxyUrls = {};

		this.encoderDefaults.registerObserver(() => {
			if (this.encoderInfoCell) {
				this.encoderInfoCell.replaceChildren(...this.renderEncoderInfo());
			}
		});
	}

	get encoder() {
		return this.info.media.encoders[this.encoderToken];
	}

	get source() {
		return this.info.media.sources[this.sourceToken];
	}

	get source_config() {
		return this.info.media.sources[this.sourceToken].configs[this.sourceConfigToken];
	}

	get endpointReference() {
		return `${this.endpointReferenceAddress}`.replace(/\W/, '_');
	}

	async requestInfo() {
		this.info = await onvif.info(this.deviceUrl, this.username, this.password);
		this.encoderToken = Object.keys(this.info.media.encoders)[0];
		this.sourceToken = Object.keys(this.info.media.sources)[0];
		this.sourceConfigToken = Object.keys(this.source.configs)[0];
		this.streamUrl = await onvif.get_stream(this.info.media_url, this.username, this.password, this.encoderToken, this.sourceConfigToken);

		return this;
	}

	async updateEncoderConfig(config, attributeChange = false) {
		// TODO don't attempt invalid settings? Or adjust to closest?
		await onvif.set_encoder(this.info.media_url, this.username, this.password, this.encoderToken, config);
		Object.assign(this.encoder, config);

		this.encoderInfoCell.replaceChildren(...this.renderEncoderInfo());

		// If it's _not_ an attribute change on our video live elemnent that caused this,
		// then we should update the attributes on the video live element as they'll
		// be out of sync. But we have to stop observing them to avoid a loop...
		if (this.videoElement && !attributeChange) {
			this.stopSettingsObserver();
			for (const field of ['bitrate', 'framerate', 'resolution']) {
				if (!config[field]) {
					continue;
				}

				this.videoLive.setAttribute(field,
					field === 'resolution' ? `${config[field].width}x${config[field].height}`
					                       : config[field]);
			}
			this.startSettingsObserver();
		}
	}

	async updateImagingConfig(config) {
		await onvif.set_imaging(this.info.imaging_url, this.username, this.password, this.sourceToken, config);
		Object.assign(this.source.imaging, config);
	}

	stopSettingsObserver() {
		this.settingsObserver.disconnect();
	}

	startSettingsObserver() {
		this.settingsObserver.observe(this.videoLive, {attributeFilter: ['bitrate', 'brightness', 'framerate', 'resolution']});
	}

	setProxyUrls(proxyUrls) {
		this.proxyUrls = proxyUrls;
	}

	renderInfoRow(livestreamError, liveViewEnabled) {
		let liveViewCheckbox = E('input', {'class': 'live-view-checkbox', 'type': 'checkbox', checked: liveViewEnabled || undefined});

		if (livestreamError) {
			liveViewCheckbox = livestreamError;
		} else if (!this.proxyUrls.webrtc) {
			liveViewCheckbox = _('WebRTC proxy disabled');
		}

		return E('tr', {'class': 'row', 'data-url': this.deviceUrl, 'data-sortkey': this.info.hostname}, [
			E('td', {'class': 'td'}, E('a', {href: this.webUrl}, this.info.hostname)),
			E('td', {'class': 'td hide-sm'}, this.info.model),
			E('td', {'class': 'td hide-sm'}, this.info.firmware_version),
			this.encoderInfoCell = E('td', {'class': 'td center'}, this.renderEncoderInfo()),
			E('td', {'class': 'td center'}, this.renderStreamLinks()),
			E('td', {'class': 'td center'}, liveViewCheckbox),
		]);
	}

	async renderEncoderForm() {
		const formFields = ['resolution', 'bitrate', 'framerate', 'profile', 'quality', 'govlength'];
		const encodingOptions = this.encoder.options.encoding[this.encoder.encoding];

		const name = _('Encoder configuration: ') + this.info.hostname;
		const config = {encoder_config: {}};
		for (const field of formFields) {
			if (field === 'resolution') {
				config.encoder_config.resolution = `${this.encoder.resolution.width}x${this.encoder.resolution.height}`;
			} else {
				config.encoder_config[field] = this.encoder[field];
			}
		}
		const m = new form.JSONMap(config);
		const s = m.section(form.NamedSection, 'encoder_config');
		let o;

		if (encodingOptions.resolution.length > 1) {
			o = s.option(form.ListValue, 'resolution', _('Resolution'));
			for (const resolution of encodingOptions.resolution) {
				const v = `${resolution.width}x${resolution.height}`;
				o.value(v, v);
			}
		}

		o = s.option(form.Value, 'bitrate', _('Bitrate (kbps)'));
		// Ideally, this should come from the ONVIF server, but it requires an extension, so for now...
		// These 'defaults' are also in videolive.js.
		o.datatype = 'range(100, 10000)';

		if (encodingOptions.framerate_range.min < encodingOptions.framerate_range.max) {
			o = s.option(form.Value, 'framerate', _('Framerate (fps)'));
			o.datatype = `range(${encodingOptions.framerate_range.min}, ${encodingOptions.framerate_range.max})`;
		}

		if (encodingOptions.profile.length > 1) {
			o = s.option(form.ListValue, 'profile', _('Profile'));
			for (const profile of encodingOptions.profile) {
				o.value(profile, profile);
			}
		}

		if (this.encoder.options.quality_range.min < this.encoder.options.quality_range.max) {
			o = s.option(form.Value, 'quality', _('Quality'));
			o.datatype = `range(${this.encoder.options.quality_range.min}, ${this.encoder.options.quality_range.max})`;
		}

		if (encodingOptions.govlength_range.min < encodingOptions.govlength_range.max) {
			o = s.option(form.Value, 'govlength', _('GOV length (key frame interval)'));
			o.datatype = `range(${encodingOptions.govlength_range.min}, ${encodingOptions.govlength_range.max})`;
		}

		const save = () => {
			m.save();
			const orig_config = Object.assign({}, config.encoder_config);
			const [width, height] = orig_config.resolution.split('x').map(Number);
			orig_config.resolution = {width, height};
			for (const field of ['bitrate', 'quality', 'framerate']) {
				orig_config[field] = Number(orig_config[field]);
			}

			// TODO handleError...
			this.updateEncoderConfig(orig_config);
			ui.hideModal();
			return orig_config;
		};

		const saveAsDefault = () => {
			this.encoderDefaults.save(save());
		};

		ui.showModal(name, [
			await m.render(),
			E('div', {'class': 'right'}, [
				E('button', {'class': 'cbi-button', click: ui.hideModal}, _('Dismiss')), ' ',
				E('button', {'class': 'cbi-button cbi-button-positive', click: save}, _('Save')), ' ',
				E('button', {'class': 'cbi-button cbi-button-action', click: saveAsDefault}, _('Save as Default')),
			]),
		]);
	}

	renderEncoderInfo() {
		if (!this.info.media) {
			return [_('Unavailable via ONVIF')];
		}

		const infoString = `${this.encoder.resolution.width}x${this.encoder.resolution.height}@${this.encoder.bitrate}kbps`;

		const diffs = [];
		for (const [key, val] of Object.entries(this.encoderDefaults.get())) {
			// uci info fields start with '.' (e.g. .type, .name)
			if (!key.startsWith('.') && JSON.stringify(val) !== JSON.stringify(this.encoder[key])) {
				diffs.push(`${key} is ${JSON.stringify(this.encoder[key])} and not ${JSON.stringify(val)}`);
			}
		}

		const info = E('a', {style: 'cursor: pointer', click: () => this.renderEncoderForm()}, infoString);

		if (diffs.length === 0) {
			return [info];
		} else {
			return [
				info, ' ',
				E('b', {style: 'cursor: help', title: `Non-default settings:\n${diffs.join('\n')}`}, '(!)'),
			];
		}
	}

	renderStreamLinks() {
		const streamLinks = [
			E('a', {href: this.streamUrl}, 'RTSP'),
		];

		if (this.proxyUrls.rtsp) {
			streamLinks.push(' | ');
			streamLinks.push(E('a', {href: this.proxyUrls.rtsp}, 'Proxy RTSP'));
		}

		if (this.proxyUrls.webrtcPage) {
			streamLinks.push(' | ');
			streamLinks.push(E('a', {href: this.proxyUrls.webrtcPage}, 'WebRTC'));
		}

		if (this.proxyUrls.hls) {
			streamLinks.push(' | ');
			streamLinks.push(E('a', {href: this.proxyUrls.hls}, 'HLS'));
		}

		return streamLinks;
	}

	renderVideo() {
		const autoplay = true;

		let videoAttributes = {
			'autoplay': autoplay,
		};

		if (this.info.media) {
			const encodingOptions = this.encoder.options.encoding[this.encoder.encoding];
			Object.assign(videoAttributes, {
				'brightness': this.source.imaging.brightness,
				'brightness-min': this.source.imaging.options.brightness_range.min,
				'brightness-max': this.source.imaging.options.brightness_range.max,
				'bitrate': this.encoder.bitrate,
				'framerate': this.encoder.framerate,
				'framerate-min': encodingOptions.framerate_range.min,
				'framerate-max': encodingOptions.framerate_range.max,
				'resolution': `${this.encoder.resolution.width}x${this.encoder.resolution.height}`,
				'resolution-options': encodingOptions.resolution.map(({width, height}) => `${width}x${height}`).join(','),
			});
		}

		this.videoLive = E('video-live', videoAttributes);

		this.receiver = new Receiver(this.videoLive, this.proxyUrls.webrtc);

		// We stop/start the receiver so we don't stream things unnecessarily.
		// Note that mediamtx will also stop proxying once it has no connections.
		this.videoLive.addEventListener('userplay', () => this.receiver.start());
		this.videoLive.addEventListener('userpause', () => this.receiver.stop());

		if (this.info.media) {
			// Watch 'external' custom controls for change so we can call the device.
			this.settingsObserver = new MutationObserver(mutationList => {
				const handleError = (e) => {
					ui.addNotification(_('ONVIF error'), E('pre', {}, e.message), 'warning');
				};

				for (const mutation of mutationList) {
					switch (mutation.attributeName) {
						case 'bitrate':
							this.updateEncoderConfig({bitrate: Number(mutation.target.getAttribute('bitrate'))}, true)
								.catch(handleError);
							break;
						case 'framerate':
							this.updateEncoderConfig({framerate: Number(mutation.target.getAttribute('framerate'))}, true)
								.catch(handleError);
							break;
						case 'brightness':
							this.updateImagingConfig({brightness: Number(mutation.target.getAttribute('brightness'))}, true)
								.catch(handleError);
							break;
						case 'resolution':
							const [width, height] = mutation.target.getAttribute('resolution').split('x');
							this.updateEncoderConfig({resolution: {width: Number(width), height: Number(height)}}, true)
								.catch(handleError);
							break;
					}
				}
			});
			this.startSettingsObserver();
		}

		if (autoplay) {
			this.receiver.start();
		}

		return E('div', {}, [
			E('div', {"class": "video-header"}, [
				E('h4', {}, [E('a', {href: this.webUrl}, this.info.hostname), ` (${this.info.model})`]),
			]),
			this.videoLive,
		]);
	}

	addVideoElement(videoGridElement) {
		if (!this.videoElement) {
			this.videoElement = this.renderVideo();
			videoGridElement.append(this.videoElement);
			videoGridElement.closest('section').classList.remove('hidden');
		}
	}

	removeVideoElement(videoGridElement) {
		if (this.videoElement) {
			this.receiver.stop();
			this.videoElement.remove();
			this.videoElement = null;
			if (videoGridElement.children.length === 0) {
				videoGridElement.closest('section').classList.add('hidden');
			}
		}
	};

}

// Adapted from https://github.com/aler9/mediamtx/blob/adbd4b72961a0d06005e7ee69ddac3aa770803f1/internal/core/webrtc_index.html
// (MIT licensed, but also just the 'HOWTO' instructions...)
class Receiver {
	constructor(element, url) {
		this.ws = null;
		this.pc = null;
		this.restartTimeout = null;
		this.url = url;
		this.videoElement = element;
		this.stopped = true;
	}

	stop() {
		if (this.stopped) {
			return;
		}

		console.log('stream stop requested', this.url)

		this.stopped = true;
		this.videoElement.pause();

		if (this.ws !== null) {
			this.ws.close();
		}
		if (this.pc !== null) {
			this.pc.close();
			this.pc = null;
		}
	}

	start() {
		if (!this.stopped) {
			return;
		}

		console.log('stream start requested', this.url)

		this.stopped = false;

		this.ws = new WebSocket(this.url);

		this.ws.onerror = () => {
			console.log("ws error", this.url);
			if (this.ws === null) {
				return;
			}

			this.ws.close();
		};

		this.ws.onclose = () => {
			console.log("ws closed", this.url);
			this.ws = null;
			if (!this.stopped) {
				this.scheduleRestart();
			}
			this.videoElement.video.srcObject = null;
		};

		this.ws.onmessage = (msg) => this.onIceServers(msg);
	}

	onIceServers(msg) {
		if (this.ws === null) {
			return;
		}

		const iceServers = JSON.parse(msg.data);

		this.pc = new RTCPeerConnection({
			iceServers,
		});

		this.ws.onmessage = (msg) => this.onRemoteDescription(msg);
		this.pc.onicecandidate = (evt) => this.onIceCandidate(evt);

		this.pc.oniceconnectionstatechange = () => {
			if (this.pc === null) {
				return;
			}

			console.log("peer connection state:", this.pc.iceConnectionState, this.url);

			switch (this.pc.iceConnectionState) {
			case "disconnected":
				this.scheduleRestart();
			}
		};

		this.pc.ontrack = (evt) => {
			console.log("new track " + evt.track.kind, this.url);
			this.videoElement.video.srcObject = evt.streams[0];
		};

		const direction = "sendrecv";
		this.pc.addTransceiver("video", { direction });
		this.pc.addTransceiver("audio", { direction });

		this.pc.createOffer()
			.then((desc) => {
				if (this.pc === null || this.ws === null) {
					return;
				}

				this.pc.setLocalDescription(desc);

				console.log("sending offer", this.url);
				this.ws.send(JSON.stringify(desc));
			});
	}

	onRemoteDescription(msg) {
		if (this.pc === null || this.ws === null) {
			return;
		}

		this.pc.setRemoteDescription(new RTCSessionDescription(JSON.parse(msg.data)));
		this.ws.onmessage = (msg) => this.onRemoteCandidate(msg);
	}

	onIceCandidate(evt) {
		if (this.ws === null) {
			return;
		}

		if (evt.candidate !== null) {
			if (evt.candidate.candidate !== "") {
				this.ws.send(JSON.stringify(evt.candidate));
			}
		}
	}

	onRemoteCandidate(msg) {
		if (this.pc === null) {
			return;
		}

		this.pc.addIceCandidate(JSON.parse(msg.data));
	}

	scheduleRestart() {
		this.stopped = true;

		if (this.ws !== null) {
			this.ws.close();
		}

		if (this.pc !== null) {
			this.pc.close();
			this.pc = null;
		}

		this.restartTimeout = window.setTimeout(() => {
			this.restartTimeout = null;
			this.start();
			this.videoElement.play();
		}, RESTART_PAUSE);
	}
}

return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,
	devices: {},

	load() {
		return Promise.all([
			callLuciNetworkDevices(),
			uci.load('cameras'),
			videolive.loadTemplate(),
		]);
	},

	setupVideoGridChildrenUpdate() {
		// Hackery since Firefox doesn't yet have support for 'has()', so we attach
		// classes to the video-grid to indicate the number of children.

		const updateGridClasses = () => {
			const videoCount = this.videoGridElement.childElementCount;

			for (let i = 0; i <= 9; ++i) {
				if (videoCount === i) {
					this.videoGridElement.classList.add(`children-${i}`);
				} else {
					this.videoGridElement.classList.remove(`children-${i}`);
				}
			}

			if (videoCount > 9) {
				this.videoGridElement.classList.add('children-10-or-more');
			} else {
				this.videoGridElement.classList.remove('children-10-or-more');
			}
		};

		updateGridClasses();

		const observer = new MutationObserver(updateGridClasses);
		observer.observe(this.videoGridElement, {childList: true});
	},

	async convertPathToProxyUrls(path) {
		if (!this._mediamtx_ports) {
			this._mediamtx_ports = await mediamtx.get_ports();
		}

		if (this._mediamtx_ports.error) {
			throw new Error(_('MediaMTX port failure: ') + this._mediamtx_ports.error);
		}

		const ports = this._mediamtx_ports;
		const host = window.location.hostname;

		return {
			webrtc: ports.webrtc && `ws://${host}:${ports.webrtc}/${path}/ws`,
			webrtcPage: ports.webrtc && `http://${host}:${ports.webrtc}/${path}/`,
			rtsp: ports.rtsp && `rtsp://${host}:${ports.rtsp}/${path}/`,
			hls: ports.hls && `http://${host}:${ports.hls}/${path}/`,
		}
	},

	async discover(probeIP) {
		if (this._mediamtx_ports?.error) {
			// Reset port info cache in error case in case MediaMTX is now up.
			// TODO - what we actually should do is redo any devices in error here.
			this._mediamtx_ports = null;
		}

		if (Object.keys(this.devices).length === 0) {
			this.discoveryText.classList.remove('hidden');
			this.noCamerasText.classList.add('hidden');
		}

		let mediamtxError = null;

		for (let i = 0; i < this.numProbes; ++i) {
			for (const device of await onvif.probe(probeIP)) {
				if (this.devices[device.device_url]) {
					continue;
				}

				const onvifVideo = new ONVIFDevice(this.encoderDefaults, device.endpoint_reference_address, device.device_url, '', '');
				this.devices[device.device_url] = onvifVideo;
				try {
					await onvifVideo.requestInfo();
					const setProxyResult = await mediamtx.set_proxy(onvifVideo.streamUrl);
					if (setProxyResult.error) {
						console.error('MediaMTX issue', setProxyResult.error);
						mediamtxError = setProxyResult.error;
					} else {
						onvifVideo.setProxyUrls(await this.convertPathToProxyUrls(setProxyResult.path));
					}
				} catch (e) {
					console.error(e);
				}

				const liveViewEnabled = Object.keys(this.devices).length <= this.numAutoplay;
				const row = onvifVideo.renderInfoRow(mediamtxError, liveViewEnabled);
				this.cameraTable.append(row);
				for (const r of this.cameraTable.children) {
					if (r.dataset.sortkey && r.dataset.sortkey.localeCompare(row.dataset.sortkey) > 0) {
						this.cameraTable.insertBefore(row, r);
						break;
					}
				}
				this.cameraTable.classList.remove('hidden');
				this.discoveryText.classList.add('hidden');

				const liveViewCheckbox = row.querySelector('.live-view-checkbox');
				if (liveViewCheckbox) {
					liveViewCheckbox.addEventListener('change', (e) => {
						if (e.target.checked) {
							onvifVideo.addVideoElement(this.videoGridElement);
						} else {
							onvifVideo.removeVideoElement(this.videoGridElement);
						}
						this.updateLiveViewCheckbox();
					});

					if (liveViewEnabled) {
						onvifVideo.addVideoElement(this.videoGridElement);
					}
					this.updateLiveViewCheckbox();
				}
			}
		}

		if (Object.keys(this.devices).length === 0) {
			this.discoveryText.classList.add('hidden');
			this.noCamerasText.classList.remove('hidden');
		}
	},

	renderDiscovery(devices) {
		// Hack: privilege wlan as it's more likely to have connected IP cameras.
		const orderedDeviceKeys = [];
		orderedDeviceKeys.push(...Object.keys(devices).filter(k => k.startsWith('wlan')));
		orderedDeviceKeys.push(...Object.keys(devices).filter(k => !k.startsWith('wlan')));

		const probeIPs = [];
		for (const deviceKey of orderedDeviceKeys) {
			for (const ipaddr of devices[deviceKey].ipaddrs) {
				if (ipaddr.address !== '127.0.0.1') {
					probeIPs.push([deviceKey, ipaddr.address]);
				}
			}
		}

		if (probeIPs.length === 0) {
			// Just to do _something_ in the UI. This shouldn't happen.
			probeIPs.push(['unknown', '127.0.0.1']);
		}

		const selectProbeIPs = E('select', {'class': 'cbi-select'}, probeIPs.map(
			([deviceName, ip]) => E('option', {value: ip}, `${ip} (${deviceName})`)
		));

		const discoverButton = E('button', {
			'class': 'cbi-button cbi-button-action',
			'click': ui.createHandlerFn(this, () => this.discover(selectProbeIPs.value)),
		}, [_('Discover')]);

		discoverButton.click();

		return E('span', {}, [
			selectProbeIPs,
			discoverButton,
		]);
	},

	updateLiveViewCheckbox() {
		let checked = false;
		let unchecked = false;
		for (const node of this.cameraTable.querySelectorAll('.live-view-checkbox')) {
			if (node.checked) {
				checked = true;
			} else {
				unchecked = true;
			}
		}

		if (checked && unchecked) {
			this.allLiveViewCheckbox.checked = false;
			this.allLiveViewCheckbox.indeterminate = true;
		} else if (checked) {
			this.allLiveViewCheckbox.checked = true;
			this.allLiveViewCheckbox.indeterminate = false;
		} else if (unchecked) {
			this.allLiveViewCheckbox.checked = false;
			this.allLiveViewCheckbox.indeterminate = false;
		} else {
			this.allLiveViewCheckbox.checked = false;
			this.allLiveViewCheckbox.indeterminate = true;
		}
	},

	async setDefaults() {
		for (const onvifDevice of Object.values(this.devices)) {
			await onvifDevice.updateEncoderConfig(this.encoderDefaults.get());
		}
	},

	renderSetDefaultsTitle() {
		return `Reset all devices to ${this.encoderDefaults.get().resolution.width}x${this.encoderDefaults.get().resolution.height}@${this.encoderDefaults.get().bitrate}kbps`;
	},

	renderSetDefaults() {
		return E('button', {
			'class': 'cbi-button cbi-button-action',
			'style': 'margin-right: 10px',
			'title': this.renderSetDefaultsTitle(),
			'click': ui.createHandlerFn(this, () => this.setDefaults()),
		}, [_('Force Configs to Default')]);
	},

	render([devices]) {
		this.numProbes = Number(uci.get('cameras', 'luci', 'num_probes'));
		this.numAutoplay = Number(uci.get('cameras', 'luci', 'num_autoplay'));
		this.encoderDefaults = new EncoderDefaults();

		this.discoveryText = E('p', {'class': 'hidden'}, _('Discovering cameras...'));
		this.noCamerasText = E('p', {'class': 'hidden'}, _('No ONVIF-compatible cameras found.'));
		this.allLiveViewCheckbox = E('input', {'class': 'all-live-view-checkbox', 'type': 'checkbox'});
		this.allLiveViewCheckbox.indeterminate = true;
		this.allLiveViewCheckbox.addEventListener('change', (e) => {
			const val = e.target.checked;
			for (const node of this.cameraTable.querySelectorAll('.live-view-checkbox')) {
				node.checked = val;
				node.dispatchEvent(new Event('change'));
			}
		});

		let fullscreenButton = '';
		if (document.fullscreenEnabled || document.webkitFullscreenEnabled) {
			fullscreenButton = E('button', {'class': 'cbi-button cbi-button-action', style: 'float: right'}, 'Fullscreen'),
			fullscreenButton.addEventListener('click', (e) => {
				if (this.videoGridElement.requestFullscreen) {
					this.videoGridElement.requestFullscreen();
				} else if (this.videoGridElement.webkitRequestFullscreen) {
					this.videoGridElement.webkitRequestFullscreen();
				}
			});
		}

		let setDefaultsButton = this.renderSetDefaults();
		this.encoderDefaults.registerObserver(() => {
			setDefaultsButton.title = this.renderSetDefaultsTitle();
		});

		this.videoGridElement = E('div', {class: 'video-grid'});
		this.setupVideoGridChildrenUpdate();

		return [
			E('span', {'class': 'pull-right'}, [
				setDefaultsButton,
				this.renderDiscovery(devices),
			]),
			E('h2', {}, 'Cameras'),
			E('section', {}, [
				this.discoveryText,
				this.noCamerasText,
				this.cameraTable = E('table', {'class': 'table hidden'}, [
					E('tr', {'class': 'tr table-titles'}, [
						E('th', {'class': 'th'}, [_('Hostname')]),
						E('th', {'class': 'th hide-sm'}, [_('Model')]),
						E('th', {'class': 'th hide-sm'}, [_('Firmware')]),
						E('th', {'class': 'th center'}, [_('Config')]),
						E('th', {'class': 'th center'}, [_('Streams')]),
						E('th', {'class': 'th center'}, [_('Live view'), this.allLiveViewCheckbox]),
					]),
				]),
			]),
			E('section', {'class': 'hidden'}, [
				fullscreenButton,
				E('h3', {}, 'Live view'),
				this.videoGridElement,
			]),
		];
	},
});