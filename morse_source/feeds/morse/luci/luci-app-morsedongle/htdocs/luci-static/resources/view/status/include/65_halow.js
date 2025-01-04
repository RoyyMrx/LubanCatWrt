'use strict';
'require baseclass';
'require dom';
'require network';
'require uci';
'require fs';
'require rpc';
'require tools.morse.morseconf as mmconf';
'require tools.morse.device.remote as remoteDevice';

const umdnsUpdate = rpc.declare({
	object: 'umdns',
	method: 'update',
	params: []
});

const umdnsBrowse = rpc.declare({
	object: 'umdns',
	method: 'browse',
	params:[],
	expect: { "_dongle-rpc._tcp": {} }
});

const getSignalPercent = function(quality, quality_max) {
	let qc = quality || 0,
	    qm = quality_max || 0;

	if (qc > 0 && qm > 0)
		return Math.floor((100 / qm) * qc);

	return 0;
};

function get(object, ...args) {
	let v = object;

	for (const arg of args)
		if (L.isObject(v))
			v = v[arg];
		else
			return null;

	return v;
};

function formatWifiEncryption(enc) {
	if (!L.isObject(enc))
		return null;

	if (!enc.enabled)
		return 'None';

	let ciphers = Array.isArray(enc.ciphers)
		? enc.ciphers.map(function(c) { return c.toUpperCase() }) : [ 'NONE' ];

	if (Array.isArray(enc.wep)) {
		let has_open = false,
		    has_shared = false;

		for (let i = 0; i < enc.wep.length; i++)
			if (enc.wep[i] == 'open')
				has_open = true;
			else if (enc.wep[i] == 'shared')
				has_shared = true;

		if (has_open && has_shared)
			return 'WEP Open/Shared (%s)'.format(ciphers.join(', '));
		else if (has_open)
			return 'WEP Open System (%s)'.format(ciphers.join(', '));
		else if (has_shared)
			return 'WEP Shared Auth (%s)'.format(ciphers.join(', '));

		return 'WEP';
	}

	if (Array.isArray(enc.wpa)) {
		let versions = [],
		    suites = Array.isArray(enc.authentication)
		    ? enc.authentication.map(function(a) { return a.toUpperCase() }) : [ 'NONE' ];

		for (let i = 0; i < enc.wpa.length; i++)
			switch (enc.wpa[i]) {
			case 1:
				versions.push('WPA');
				break;

			default:
				versions.push('WPA%d'.format(enc.wpa[i]));
				break;
			}

		if (versions.length > 1)
			return 'mixed %s %s (%s)'.format(versions.join('/'), suites.join(', '), ciphers.join(', '));

		return '%s %s (%s)'.format(versions[0], suites.join(', '), ciphers.join(', '));
	}

	return 'Unknown';
}

return baseclass.extend({
	title: _('Wireless (802.11ah)'),

	wifirate: function(rt) {
		let s = '%.1f\xa0%s, %d\xa0%s'.format(rt.rate / 1000, _('Mbit/s'), rt.mhz, _('MHz')),
		    ht = rt.ht, nss = rt.nss,
		    mcs = rt.mcs, sgi = rt.short_gi;

		if (ht) {
			if (nss) s += ', NSS\xa0%d'.format(nss);
			if (ht)  s += ', MCS\xa0%s'.format(mcs);
			if (sgi) s += ', ' + _('Short GI').replace(/ /g, '\xa0');
		}

		return s;
	},

	renderbox: function(name, iface, deviceInfo, interfaceInfo, assoclist) {
		let chan = null,
		    freq = null,
		    rate = null,
		    badges = [];

		let is_assoc = (interfaceInfo?.iwinfo?.bssid != '00:00:00:00:00:00' 
		                && interfaceInfo?.iwinfo?.channel
		                && !deviceInfo?.disabled),
		    quality = getSignalPercent(interfaceInfo?.iwinfo?.quality, 
		                               interfaceInfo?.iwinfo?.quality_max);

		let icon;
		if (deviceInfo?.disabled)
			icon = L.resource('icons/signal-none.png');
		else if (quality <= 0)
			icon = L.resource('icons/signal-0.png');
		else if (quality < 25)
			icon = L.resource('icons/signal-0-25.png');
		else if (quality < 50)
			icon = L.resource('icons/signal-25-50.png');
		else if (quality < 75)
			icon = L.resource('icons/signal-50-75.png');
		else
			icon = L.resource('icons/signal-75-100.png');

		let badge = renderBadge(
			icon,
			'%s: %d dBm / %s: %d%%'.format(_('Signal'), interfaceInfo?.iwinfo?.signal, _('Quality'), quality),
			_('SSID'), interfaceInfo?.iwinfo?.ssid || '?',
			_('Mode'), interfaceInfo?.iwinfo?.mode ,
			_('BSSID'), is_assoc ? (interfaceInfo?.iwinfo?.bssid || '-') : null,
			_('Encryption'), is_assoc ? formatWifiEncryption(interfaceInfo?.iwinfo?.encryption) : null,
			_('Associations'), is_assoc ? (assoclist.length || '-') : null,
			null, is_assoc ? null : E('em', deviceInfo?.disabled ? _('Wireless is disabled') : _('Wireless is not associated')),
		);

		badges.push(badge);

		chan = (chan != null) ? chan : interfaceInfo?.iwinfo?.channel;
		freq = (freq != null) ? freq : interfaceInfo?.iwinfo?.frequency / 1000;
		rate = (rate != null) ? rate : interfaceInfo?.iwinfo?.bitrate / 1000;

		return E('div', { class: 'ifacebox' }, [
			E('div', { class: 'ifacebox-head center ' + (deviceInfo?.up ? 'active' : '') },
				E('strong', name)),
			E('div', { class: 'ifacebox-body left' }, [
				L.itemlist(E('span'), [
					_('Type'), get(interfaceInfo, "iwinfo", "hardware", ".name"),
					_('Channel'), chan ? '%d (%.3f %s)'.format(chan, freq, freq > 500 ? _('MHz') : _('GHz')) : '-',
					_('Bitrate'), rate ? '%f %s'.format(rate, _('Mbit/s')) : '-',
				]),
				E('div', {}, badges)
			])
		]);
	},

	checkReport: async function(report) {
		if(!report || Object.keys(report).length == 0)
			throw new Error('device not found');
		
		let firstEntry = Object.keys(report)[0];
		let ipv4 = report[firstEntry].ipv4;
		if(ipv4 === undefined)
			throw new Error('address not found');
		
		let device = remoteDevice.load(ipv4);
		mmconf.setDevice(device);
		try {
			await mmconf.get();
		}
		catch(e) {
			switch(e.message){
				case "XHR request timed out":
					console.error(e);
					throw new Error('timed out', { "ip": ipv4, "deviceName": firstEntry });
				default:
					throw e;
			}
		}


		return {"ip": ipv4, "deviceName": firstEntry};
	},

	load: async function() {
		await fs.exec_direct('/etc/init.d/umdns', ['restart']);
		await umdnsUpdate();
		//docs indicate we should "wait a couple of seconds" after running umdns update.
		// umdns update doesn't seem to wait for us, instead it returns after sending 
		// mdns queries, but before receiving the responses. So adding a wait
		await new Promise((resolveFn) => window.setTimeout(resolveFn, 2000));
		let report = await umdnsBrowse();
		try {
			var {ip, deviceName} = await this.checkReport(report);
		}
		catch(e){
			switch(e.message){
				case "device not found":
					console.error("Couldn't find remote device");
					return Promise.reject();
				case "address not found":
					console.error("Device found but has no IP address");
					return Promise.reject();
				case "timed out":
					console.error('Could not reach device %s at %s'.format(e.deviceName, e.ip));
					return Promise.reject();
				default:
					console.error(e);
					return Promise.reject();
				
			}
		}

		/* This is one piece which needs to change. The config library gets the interface in one way
		 * but this page is getting all possible interfaces in a different way.
		 * So we're just checking we match the library config selected interface.
		 * At a later date, we would likely need to extend this to pull useful information from multiple
		 * devices and interfaces.
		 */
		let device = remoteDevice.load(ip);
		const callLuciWirelessDevices = device.remoteRpc.declare({
			object: 'luci-rpc',
			method: 'getWirelessDevices',
			reject: true
		});

		const callLuciHostHints= device.remoteRpc.declare({
			object: 'luci-rpc',
			method: 'getHostHints',
			reject: true
		});

		const callIwinfoAssoc = device.remoteRpc.declare({
			object: 'iwinfo',
			method: 'assoclist',
			params: [ 'device' ],
			reject: true,
			expect: { results: [] }
		});

		let iface;
		iface = await device.interface();


		await device.config.load('wireless');
		let radio = device.config.sections('wireless', 'wifi-device').filter(function(ns) {
						return ns.type == 'morse';
					});
		if(!radio || radio.length == 0) return Promise.reject();
		radio = radio[0][".name"];
		
		let devices = await callLuciWirelessDevices();
		if(!devices || !devices[radio]) return Promise.reject();

		let luciIfaces = devices[radio]?.interfaces;
		let luciIface = luciIfaces.filter(function(i){ return i["ifname"] == iface });
		if(!luciIface || luciIface.length == 0) return Promise.reject();
		return [deviceName,
		        iface,
		        devices[radio],
		        luciIface[0],
		        await callIwinfoAssoc(iface),
		        await callLuciHostHints()
		       ];
	},

	render: function([deviceName, iface, deviceInfo, interfaceInfo, iwinfoAssoclist, hostHints]) {
		let table = E('div', { 'class': 'network-status-table' });
		
		table.appendChild(this.renderbox(deviceName, iface, deviceInfo, interfaceInfo, iwinfoAssoclist));

		if (!table.lastElementChild)
			return null;

		let assoclist = E('table', { 'class': 'table assoclist' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th nowrap' }, _('Network')),
				E('th', { 'class': 'th hide-xs' }, _('MAC address')),
				E('th', { 'class': 'th' }, _('Host')),
				E('th', { 'class': 'th' }, '%s / %s'.format(_('Signal'), _('Noise'))),
				E('th', { 'class': 'th' }, '%s / %s'.format(_('RX Rate'), _('TX Rate')))
			])
		]);

		let rows = [];


		for (let k = 0; k < iwinfoAssoclist.length; k++) {
			let bss = iwinfoAssoclist[k],
			    name = get(hostHints, bss.mac, ".name"),
			    ipv4 = L.toArray(get(hostHints, bss.mac, "ipaddrs"))[0],
			    ipv6 = L.toArray(get(hostHints, bss.mac, "ip6addrs"))[0];

			let icon;
			let q = Math.min((bss.signal + 110) / 70 * 100, 100);
			if (q == 0)
				icon = L.resource('icons/signal-0.png');
			else if (q < 25)
				icon = L.resource('icons/signal-0-25.png');
			else if (q < 50)
				icon = L.resource('icons/signal-25-50.png');
			else if (q < 75)
				icon = L.resource('icons/signal-50-75.png');
			else
				icon = L.resource('icons/signal-75-100.png');

			let sig_title, sig_value;

			if (bss.noise) {
				sig_value = '%d/%d\xa0%s'.format(bss.signal, bss.noise, _('dBm'));
				sig_title = '%s: %d %s / %s: %d %s / %s %d'.format(
					_('Signal'), bss.signal, _('dBm'),
					_('Noise'), bss.noise, _('dBm'),
					_('SNR'), bss.signal - bss.noise);
			}
			else {
				sig_value = '%d\xa0%s'.format(bss.signal, _('dBm'));
				sig_title = '%s: %d %s'.format(_('Signal'), bss.signal, _('dBm'));
			}

			let hint;

			if (name && ipv4 && ipv6)
					hint = '%s <span class="hide-xs">(%s, %s)</span>'.format(name, ipv4, ipv6);
			else if (name && (ipv4 || ipv6))
				hint = '%s <span class="hide-xs">(%s)</span>'.format(name, ipv4 || ipv6);
			else
				hint = name || ipv4 || ipv6 || '?';

			let row = [
				E('span', {
					'class': 'ifacebadge',
					'title': '%s: %s "%s" (%s)'.format(_('Wireless Network'), interfaceInfo?.iwinfo?.mode, 
														interfaceInfo?.iwinfo?.ssid, iface),
					'data-ifname': iface,
					'data-ssid': interfaceInfo?.iwinfo?.ssid
				}, [
					E('img', { 'src': L.resource('icons/wifi.png') }),
					E('span', {}, [
						' ', '%s "%s"'.format(interfaceInfo?.iwinfo?.mode, interfaceInfo?.iwinfo?.ssid),
						E('small', {}, [ ' (', iface, ')' ])
					])
				]),
				bss.mac,
				hint,
				E('span', {
					'class': 'ifacebadge',
					'title': sig_title,
					'data-signal': bss.signal,
					'data-noise': bss.noise
				}, [
					E('img', { 'src': icon }),
					E('span', {}, [
						' ', sig_value
					])
				]),
				E('span', {}, [
					E('span', this.wifirate(bss.rx)),
					E('br'),
					E('span', this.wifirate(bss.tx))
				])
			];

			rows.push(row);
		}

		cbi_update_table(assoclist, rows, E('em', _('No information available')));

		return E([
			table,
			E('h3', _('Associated Stations')),
			assoclist
		]);
	}
});
