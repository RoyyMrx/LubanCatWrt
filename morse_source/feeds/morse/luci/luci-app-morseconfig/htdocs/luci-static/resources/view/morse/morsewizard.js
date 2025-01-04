'use strict';
'require fs';
'require form';
'require network';
'require view';
'require dom';
'require ui';
'require rpc';
'require tools.morse.morseui as morseui';
'require tools.morse.morseconf as mmconf';
'require tools.morse.device.local as localDevice';
'require view.morse.wpsbuttonelement';

/* 'Simple' HaLow configuration.
 *
 * Unlike many wizards, this attempts to load any existing configuration
 * and work with that. This means that if you do mess with the underlying
 * UCI configuration in some way it _may_ manage to load it up but
 * it also may fail to adjust to changes.
 */

const callIwinfoScan = rpc.declare({
    object: 'iwinfo',
    method: 'scan',
    params: [ 'device' ],
    nobatch: true,
    expect: { results: [] }
});

let opts = [
    {field: 'mode',          type: 'toggle',  description: ' ',
        vals: [
            {key: 'ap', value: 'Access Point'},
            {key: 'sta', value: 'Station'},
            {key: 'adhoc', value: 'Ad-Hoc'},
            {key: 'none', value: 'Off'},
        ],
        depends: {mesh: '0'}
    },

    {field: 'meshmode',          type: 'toggle',  description: ' ',
        vals: [
            {key: 'controller', value: 'Controller/Agent (AP)'},
            {key: 'agent', value: 'Agent'},
            {key: 'none', value: 'Off'},
        ],
        depends: {mesh: '1'}
    },

    {field: 'mesh',          type: 'slider',  description: 'EasyMesh',
        strings:[
            {key: '1', value: 'EasyMesh - On'},
            {key: '0', value: 'EasyMesh - Off'}
        ],
    },

    {field: 'country',       type: 'dropdown',  description: 'Region',
        vals:[],
    },

    {field: 'ssid',          type: 'text',  description: 'SSID',
        validationRegex:'^.{1,32}$',
        validateErrMessage:'SSID should be between 1 and 32 characters.',
        depends: [{mesh: '0', mode: 'ap'}, {mesh: '1', meshmode: 'controller'}],
    },

    {field: 'sta_ssid',          type: 'editdrop',  description: 'SSID',
        vals: [],
        validationRegex:'^.{1,32}$',
        validateErrMessage:'SSID should be between 1 and 32 characters.',
        depends: {mode: 'sta', mesh: '0'},
    },

    {field: 'adhoc_ssid',          type: 'editdrop',  description: 'SSID',
        vals: [],
        validationRegex:'^.{1,32}$',
        validateErrMessage:'SSID should be between 1 and 32 characters.',
        depends: {mode: 'adhoc', mesh: '0'},
        helptext: "HaLow Ad-Hoc networks only support open encryption methods"
    },

    {field: 'security',      type: 'dropdown',  description: 'Encryption',
        vals:[
            {key: 'sae', value: 'SAE'},
            {key: 'owe', value: 'OWE'}
        ],
        // Forced to SAE for mesh.
        depends: [{mesh: '0', mode: 'ap'}, {mesh: '0', mode: 'sta'}],
    },

    {field: 'password',      type: 'password',  description: 'Password',
        validationRegex:'^[ -~]{8,63}$',
        validationRegexASCII:'[^ -~]',
        validateErrMessage:'Password should be between 8 and 63 characters.',
        validateErrMessageASCII:'Only ASCII characters',
        depends: [{mesh: '0', mode: 'ap', security: 'sae'}, {mesh: '0', mode: 'sta', security: 'sae'}, {mesh: '1', meshmode: 'controller'}],
    },

    {field: 'enable_pmf', type: 'checkbox', description: 'Protected Management Frames', 
        depends: {mode: 'adhoc', "!reverse": true},
    },

    // The wizard relies on netifd automatically configuring our op class.
    // This means it's important for op_class to be unset; we don't want an incompatible
    // op class from a previous configuration causing us to fail to bring up hostapd.
    {field: "op_class", type: "hidden", description: "",
        vals:[],
    },

    {field: 'bandwidth', type: 'dropdown', description: 'Operating Bandwidth (MHz)',
        vals:[],
        depends: [{mesh: '0', mode: 'ap'}, {mesh: '0', mode: 'adhoc'}, {mesh: '1'}],
    },

    {field: 'halow_channel', type: 'dropdown', description: 'Channel',
        vals:[],
        depends: [{mesh: '0', mode: 'ap'}, {mesh: '0', mode: 'adhoc'}, {mesh: '1'}],
    },

    {field: 'beacon_int', type: 'text', description: 'Beacon Interval (ms)',
        validationRange:{min: 15, max: 65535},
        validateErrMessage:'Beacon interval must be between 15 and 65535 ms',
        depends: [{mesh: '0', mode: 'ap'}, {mesh: '0', mode: 'adhoc'}, {mesh: '1'}],
    },

    {field: 'dtim_period', type: 'dropdown', description: 'DTIM Period',
        vals:[
            {key: '1', value: '1'},
            {key: '3', value: '3'},
            {key: '10', value: '10'}
        ],
        depends: [{mesh: '0', mode: 'ap'}, {mesh: '1'}],
    },

    {field: 'ap_max_inactivity', type: 'text', description: 'Max Inactivity (1-65536)',
        validationRange:{min: 1, max: 65536},
        validateErrMessage:'Max Inactivity must be between 1 and 65536',
        depends: [{mesh: '0', mode: 'ap'}, {mesh: '1'}],
    },

    {field: 'eth_ip_method',  type: 'dropdown',  description: 'Wired IP Method',
        vals:[
            {key: '2', value: 'DHCP Client'},
            {key: '1', value: 'DHCP Server'},
            {key: '0', value: 'Static'}
        ],
        depends: [{ bridge: '0' }, { mesh: '1' }]
    },

    {field: 'eth_ip',       type: 'text',  description: 'Wired IP Address',
        depends: [{eth_ip_method: '0', bridge: '0'}, {eth_ip_method: '1', bridge: '0'},
                  {eth_ip_method: '0', mesh: '1'},   {eth_ip_method: '1', mesh: '1'}],
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: 'eth_netmask',  type: 'text',  description: 'Wired IP Netmask',
        depends: [{eth_ip_method: '0', bridge: '0'}, {eth_ip_method: '1', bridge: '0'},
                  {eth_ip_method: '0', mesh: '1'},   {eth_ip_method: '1', mesh: '1'}],
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: 'eth_gateway',  type: 'text',  description: 'Wired IP Gateway',
        depends: [{eth_ip_method: '0', bridge: '0'}, {eth_ip_method: '1', bridge: '0'},
                  {eth_ip_method: '0', mesh: '1'},   {eth_ip_method: '1', mesh: '1'}],
        allow_empty: true,
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: 'eth_dhcp_range_start', type: 'text', description: 'DHCP Range Start',
        depends: [{eth_ip_method: '1', bridge: '0'},{eth_ip_method: '1', mesh: '1'}],
        validationRange:{min: 2, max: 254},
        validateErrMessage:'Start range limited within 2-254'
    },
    {field: 'eth_dhcp_range_end', type: 'text', description: 'DHCP Range End',
        depends: [{eth_ip_method: '1', bridge: '0'},{eth_ip_method: '1', mesh: '1'}],
        validationRange:{min: 2, max: 254},
        validateErrMessage:'End range limited within 2-254'
    },

    {field: 'ap_halow_ip_method',  type: 'dropdown',  description: 'HaLow IP Method',
        vals:[
            {key: '1', value: 'DHCP Server'},
            {key: '0', value: 'Static'}
        ],
        depends: [{mesh: '0', mode: 'ap', bridge: '0'}, {mesh: '1', meshmode: 'controller', bridge: '0'},
                  {mesh: '0', mode: 'ap', mesh: '1'},   {mesh: '1', meshmode: 'controller', mesh: '1'}],
    },
    {field: 'sta_halow_ip_method',  type: 'dropdown',  description: 'HaLow IP Method',
        vals:[
            {key: '2', value: 'DHCP Client'},
            {key: '0', value: 'Static'}
        ],
        depends: [{mesh: '0', mode: 'sta', bridge: '0'}, {mesh: '1', meshmode: 'agent', bridge: '0'},
                  {mesh: '0', mode: 'sta', mesh: '1'},   {mesh: '1', meshmode: 'agent', mesh: '1'}],
    },
    {field: 'adhoc_halow_ip_method',  type: 'dropdown',  description: 'HaLow IP Method',
        vals:[
            {key: '2', value: 'DHCP Client'},
            {key: '1', value: 'DHCP Server'},
            {key: '0', value: 'Static'}
        ],
        depends: {mode: 'adhoc'}
    },
    {field: 'halow_ip',       type: 'text',  description: 'HaLow IP Address',
        depends: [
            {mesh: '0', mode: 'ap'},
            {mesh: '1', meshmode: 'controller'},
            {sta_halow_ip_method: '0', bridge: '0'},
            {sta_halow_ip_method: '0', mesh: '1'},
            {adhoc_halow_ip_method: '0'}, {adhoc_halow_ip_method: '1'}
        ],
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: 'halow_netmask',  type: 'text',  description: 'HaLow Netmask',
        depends: [
            {mesh: '0', mode: 'ap'},
            {mesh: '1', meshmode: 'controller'},
            {sta_halow_ip_method: '0', bridge: '0'},
            {sta_halow_ip_method: '0', mesh: '1'},
            {adhoc_halow_ip_method: '0'}, {adhoc_halow_ip_method: '1'}
        ],
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: 'halow_gateway',  type: 'text',  description: 'HaLow Gateway',
        depends: [
            {ap_halow_ip_method: '0', bridge: '0'}, {ap_halow_ip_method: '1', bridge: '0', forwarding:'0'},
            {ap_halow_ip_method: '0', mesh: '1'},   {ap_halow_ip_method: '1', mesh: '1', forwarding:'0'},
            {sta_halow_ip_method: '0', bridge: '0'}, {sta_halow_ip_method: '1', bridge: '0', forwarding:'0'},
            {sta_halow_ip_method: '0', mesh: '1'},   {sta_halow_ip_method: '1', mesh: '1', forwarding:'0'},
            {adhoc_halow_ip_method: '0'}, {adhoc_halow_ip_method: '1'}
        ],
        allow_empty: true,
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: 'halow_dhcp_range_start', type: 'text', description: 'DHCP Range Start',
        depends: [{ap_halow_ip_method: '1', bridge: '0'}, {ap_halow_ip_method: '1', mesh: '1'}, {adhoc_halow_ip_method: '1'}],
        validationRange:{min: 2, max: 254},
        validateErrMessage:'End range limited within 2-254'
    },
    {field: 'halow_dhcp_range_end', type: 'text', description: 'DHCP Range End',
        depends: [{ap_halow_ip_method: '1', bridge: '0'}, {ap_halow_ip_method: '1', mesh: '1'}, {adhoc_halow_ip_method: '1'}],
        validationRange:{min: 2, max: 254},
        validateErrMessage:'End range limited within 2-254'
    },

    {field: 'ap_forwarding', type: 'slider', description: 'Enable traffic forwarding', helptext: 'When enabled, traffic is routed between the LAN and HaLow interfaces',
        strings:[
            {key: '1', value: 'Traffic Forwarding - On'},
            {key: '0', value: 'Traffic Forwarding - Off'}
        ],
        depends: [
            {mesh: '0', mode: 'ap', bridge: '0'},
            {mesh: '0', mode: 'ap', mesh: '1'},
            {mesh: '1', meshmode: 'controller'},
        ],
    },

    {field: 'sta_forwarding', type: 'slider', description: 'Enable traffic forwarding', helptext: 'When enabled, traffic is routed between the LAN and HaLow interfaces',
        strings:[
            {key: '1', value: 'Traffic Forwarding - On'},
            {key: '0', value: 'Traffic Forwarding - Off'}
        ],
        depends: [
            {mesh: '0', mode: 'sta', bridge: '0'},
            {mesh: '0', mode: 'sta', mesh: '1'},
            {mesh: '1', meshmode: 'agent'},
        ],
    },

    {field: 'bridge', type: 'slider', description: ' ', helptext: 'When enabled, the LAN and HaLow interfaces are joined to form a single network.',
        strings:[
            {key: '1', value: 'Bridge - On'},
            {key: '0', value: 'Bridge - Off'}
        ],
        depends: [
            {mesh: '0'},
        ],
    },

    {field: 'bridge_ip_method', type: 'dropdown', description: 'IP Method',
        vals:[
            {key: '1', value: 'DHCP Client'},
            {key: '0', value: 'Static'}
        ],
        depends: {bridge: '1'}
    },

    {field: 'bridge_ip',       type: 'text',  description: 'IP Address',
        depends: {bridge: '1', bridge_ip_method: '0'},
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: 'bridge_netmask',  type: 'text',  description: 'Netmask',
        depends: {bridge: '1', bridge_ip_method: '0'},
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: 'bridge_gateway',  type: 'text',  description: 'Gateway',
        depends: {bridge: '1', bridge_ip_method: '0'},
        allow_empty: true,
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
];

const layout = [
    {name: 'mode_select', description: '', opts: ['mode', 'meshmode']},

    {name: 'basic', description: 'Basic Wireless',
        opts: ['mesh', 'ssid', 'sta_ssid', 'adhoc_ssid', 'security', 'password'],
        depends: {'!reverse': true, mode: 'none'}},

    {name: 'traf', description: 'Traffic Management',
        opts:['bridge', 'ap_forwarding', 'sta_forwarding'],
        depends: [{mesh: '0', mode: 'ap'}, {mesh: '0', mode: 'sta'}, {mesh: '1'}]},

    {name: 'ip_bridge', description: 'IP Settings',
        opts: ['bridge_ip_method', 'bridge_ip', 'bridge_netmask', 'bridge_gateway'],
        depends: [{mesh: '0', mode: 'ap', bridge: '1'}, {mesh: '0', mode: 'sta', bridge: '1'}, {mesh: '1', bridge: '1'}]},

    {name: 'ip_halow', description: 'IP Settings - HaLow',
        opts: ['ap_halow_ip_method', 'sta_halow_ip_method', 'adhoc_halow_ip_method', 'halow_ip', 'halow_netmask', 'halow_gateway', 'halow_dhcp_range_start', 'halow_dhcp_range_end'],
        depends: [{mesh: '0', mode: 'ap', bridge: '0'}, {mesh: '0', mode: 'sta', bridge: '0'}, {mesh: '0', mode: 'adhoc'}, {mesh: '1', bridge: '0'},
                  {mesh: '0', mode: 'ap', mesh: '1'},   {mesh: '0', mode: 'sta', mesh: '1'},   {mesh: '0', mode: 'adhoc'}, {mesh: '1', mesh: '1'}]
    },

    {name: 'ip_eth', description: 'IP Settings - Ethernet',
        opts: ['eth_ip_method', 'eth_ip', 'eth_netmask', 'eth_gateway', 'eth_dhcp_range_start', 'eth_dhcp_range_end'],
        depends: [{mode: 'none'}, {mesh: '0', mode: 'adhoc'}, {bridge: '0'}, {mesh: '1'}]},

    {name: 'advanced-wireless', description: 'Advanced - Wireless',
        opts: ['country', 'bandwidth', 'halow_channel', 'enable_pmf', 'beacon_int', 'dtim_period', 'ap_max_inactivity'],
        depends: {'!reverse': true, mode: 'none'}},
];

const SECTION_ID = 'config';

return view.extend({
    handleReset: null,
    handleSaveApply: null,

    async handleSave(ev) {
        // Propagate the UI into this.jsonConf.
        const map = document.querySelector('.cbi-map');
        await dom.callClassMethod(map, 'save');

        const config = this.jsonConf.config;
        if (!this.isCountrySet) {
            // On initial region setup, force to a STA
            // (so as little happens as possible).
            config['mode'] = 'none';
        }

        if (!config['halow_channel']) {
            // Force a nice halow channel. In general, this shouldn't be nececssary,
            // but sometimes things mess up without it...
            const channels = this.countryChannels[config['country']];
            const bandwidths = Object.keys(channels).map(Number);
            config['halow_channel'] = channels[Math.max(...bandwidths)][0].s1g_chan;
        }

        // JSONMap by default removes unset things, and anything in the form
        // that's off (via depends OR flag) is regarded as undefined.
        // Unfortunately, we need to _act_ on something being undefined, otherwise
        // it will remain in the config, so we've hacked the save to treat
        // an 'undefined' as off for flags. Which necessitates extra hackery here.
        // Probably the right solution here is to stop using JSONMap.
        switch (config['mesh'] === '1' ? config['meshmode'] : config['mode']) {
            case 'ap':
            case 'controller':
                config['sta_forwarding'] = null;
                break;
            case 'agent':
            case 'sta':
                config['ap_forwarding'] = null;
                break;
            case 'adhoc':
                //at this stage adhoc only functions with open encryption
                //this resets the config to none so as to not confuse
                //those that use the uci command line
                config['security'] = 'none';
                config['ap_forwarding'] = null;
                config['sta_forwarding'] = null;
                break;
            default:
                break;
        }

        // Force the op_class to null so we don't persist whatever's loaded
        // (see comment on above option).
        config['op_class'] = null;

        let hrefs = [];
        if (config.hasOwnProperty("halow_ip")) hrefs.push(config["halow_ip"]);
        if (config.hasOwnProperty("bridge_ip")) hrefs.push(config["bridge_ip"]);
        if (config.hasOwnProperty("eth_ip")) hrefs.push(config["eth_ip"]);

        await mmconf.save(this.jsonConf, opts);
        const changes = await mmconf.changes();
        await morseui.timeoutModal(changes, hrefs);
        await mmconf.apply();
    },

    updateBandwidthOptions(country) {
        const bandwidthOptions = this.options['bandwidth'];

        bandwidthOptions.clear();
        for (const bw of Object.keys(this.countryChannels[country])) {
            bandwidthOptions.value(bw, `${bw} MHz`);
        }

        return bandwidthOptions;
    },

    updateChannelOptions(country, bandwidth) {
        const channelOptions = this.options['halow_channel'];

        channelOptions.clear();
        for (const channel of this.countryChannels[country][bandwidth]) {
            channelOptions.value(channel.s1g_chan, `${channel.s1g_chan} (${channel.centre_freq_mhz} MHz)`);
        }

        return channelOptions;
    },

    getBandwidth(currentChannel) {
        const country = this.jsonConf.config['country'];

        // We only store channel, not bandwidth, so we have to figure
        // out bandwidth here when we load from the file.
        for (const [bw, channels] of Object.entries(this.countryChannels[country])) {
            for (const channel of channels) {
                if (channel.s1g_chan == currentChannel) {
                    return bw;
                }
            }
        }

        // If no match, default to max bandwidth.
        return Math.max(...Object.keys(this.countryChannels[country]).map(Number));
    },

    load: function() {
        mmconf.setDevice(localDevice.load());
        return Promise.all([
            mmconf.get(),
            (async () => {
                const channels = await mmconf.halowChannels();
                const countryChannels = {};
                // Reorganise channel map by country/bw.
                for (const channel of channels) {
                    const {country_code, bw} = channel;
                    countryChannels[country_code] ??= {};
                    countryChannels[country_code][bw] ??= [];
                    countryChannels[country_code][bw].push(channel);
                }
                return countryChannels;
            })(),
            L.resolveDefault(fs.read('/usr/lib/opkg/info/prplmesh.control')),
            network.getWifiNetworks(),
            Promise.race([new Promise((resolve) => document.addEventListener('luci-loaded', resolve, {once: true})),
                          new Promise((resolve) => window.setTimeout(resolve, 2000))])
        ]);
    },

    doScan: async function(id, mode) {
        const scanResult = (await callIwinfoScan(await mmconf.interface())).filter(result => result.mode == mode);
        const ssidElement = this.getUIElement(id);
        ssidElement.clearChoices();
        ssidElement.addChoices(scanResult.map(res => res['ssid']));
        ssidElement.setValue(scanResult[0]['ssid']);
    },

    getUIElement(name) {
        // It's unclear to me why this is so difficult to extract from the option,
        // and why you need to pass the section id in.
        // Probably means we're doing something wrong.
        return this.options[name].getUIElement(SECTION_ID);
    },

    updateWPSButton: function() {
        const meshConfig = this.options['mesh'].cfgvalue(SECTION_ID) === '1';
        const meshForm = this.options['mesh'].formvalue(SECTION_ID) === '1';
        const modeConfig = this.options['meshmode'].cfgvalue(SECTION_ID);
        const modeForm = this.options['meshmode'].formvalue(SECTION_ID);

        // We can only perform wps actions if we're already correctly setup.
        // i.e. we're in easymesh mode, and our current (mesh/mode) == saved (mesh/mode).
        const STATES = this.wpsButtonHost.constructor.STATES;
        if (meshForm && meshConfig && modeForm === modeConfig) {
            this.wpsButtonHost.setAttribute('state', STATES.AVAILABLE);
            this.wpsButtonSupplicant.setAttribute('state', modeForm === 'agent' ? STATES.AVAILABLE : STATES.INVISIBLE);
        } else if (meshForm) {
            this.wpsButtonHost.setAttribute('state', STATES.UPDATE_CONFIG);
            this.wpsButtonSupplicant.setAttribute('state', modeForm === 'agent' ? STATES.UPDATE_CONFIG : STATES.INVISIBLE);
        } else {
            this.wpsButtonHost.setAttribute('state', STATES.INVISIBLE);
            this.wpsButtonSupplicant.setAttribute('state', STATES.INVISIBLE);
        }
    },

    render: async function([jsonConf, countryChannels, prplmesh, networks]) {
        if (jsonConf.missing.length > 0) {
            console.error(jsonConf.missing);
            return morseui.resetPage(this, jsonConf.missing);
        }

        if (!prplmesh) {
            // i.e. we think there's no prplmesh available, so don't show it.
            opts.find(o => o.field === "mesh").type = "hidden";
        }

        this.countryChannels = countryChannels;
        this.jsonConf = jsonConf;
        const currentCountry = jsonConf.config['country'];
        this.isCountrySet = !!currentCountry;

        const m = new form.JSONMap(jsonConf, _('HaLow Configuration'));
        const s = m.section(form.NamedSection, 'config', _('config'));
        this.options = {};

        if (!this.isCountrySet) {
            const countryOpt = opts.find(opt => opt.field == 'country');
            this.options['country'] = morseui.renderElement(m, s, countryOpt);
            m.title = 'Set your Region';
        } else {
            for (const section of layout) {
                const so = s.option(form.SectionValue, section.name, form.NamedSection, 'config', 'config', _(section.description));
                const ss = so.subsection;

                if (section.hasOwnProperty('depends')) {
                    for (const d of Array.isArray(section.depends) ? section.depends : [section.depends]) {
                        so.depends(d);
                    }
                }

                for (const opt of section.opts) {
                    const optionDefinition = opts.find(obj => obj.field == opt);
                    if (!optionDefinition) {
                        console.error('Missing option: ', opt);
                        continue;
                    }

                    this.options[opt] = morseui.renderElement(m, ss, optionDefinition, jsonConf.config[opt]);
                }
            }

            jsonConf.config['bandwidth'] = this.getBandwidth(jsonConf.config['halow_channel'])

            this.updateBandwidthOptions(currentCountry);
            this.updateChannelOptions(currentCountry, jsonConf.config['bandwidth']);

            this.options['country'].onchange = (ev, sectionId, country) => {
                const bandwidthOptions = this.updateBandwidthOptions(country);
                const bandwidth = Math.max(...Object.keys(this.countryChannels[country]).map(Number));
                bandwidthOptions.renderUpdate(SECTION_ID, String(bandwidth));

                const channelOptions = this.updateChannelOptions(country, bandwidth);
                channelOptions.renderUpdate(SECTION_ID);
            };

            this.options['bandwidth'].onchange = (ev, sectionId, bandwidth) => {
                const country = this.options['country'].formvalue(SECTION_ID);
                const channelOptions = this.updateChannelOptions(country, bandwidth);
                channelOptions.renderUpdate(SECTION_ID);
            };

            this.options['sta_ssid'].onchange = () => this.getUIElement('password').setValue('');
            this.options['sta_ssid'].btnText = 'Scan';
            this.options['sta_ssid'].onclick = L.bind(this.doScan, this, 'sta_ssid', "Master");

            this.options['adhoc_ssid'].btnText = 'Scan';
            this.options['adhoc_ssid'].onclick = L.bind(this.doScan, this, 'adhoc_ssid', "Ad-Hoc");

            this.options['mode'].onchange = (ev, sectionId, val) => {
                if (val === 'none') {
                    // Turn off bridge mode as it doesn't make sense when ahwlan is off
                    // (and will disable our IP settings).
                    this.getUIElement('bridge').setValue('0');
                }
            };

            if (prplmesh) {
                this.options['mesh'].onchange = (ev, sectionId, val) => {
                    this.updateWPSButton();
                };

                this.options['meshmode'].onchange = (ev, sectionId, val) => {
                    if (val === 'none') {
                        this.getUIElement('bridge').setValue('0');
                        this.getUIElement('mesh').setValue('0');
                        this.getUIElement('mode').setValue('none');
                        // Set meshmode back to controller; our 'none' is fake,
                        // and we never actually want to be there.
                        this.getUIElement('meshmode').setValue('controller');
                    }
                    this.updateWPSButton();
                };
            }
        }

        for (const country of Object.keys(countryChannels)) {
            this.options['country'].value(country, country);
        }

        const formElement = await m.render();

        // Hack in some WPS buttons.
        // Well, this is pretty ugly. Initially, I put the buttons up the top,
        // but they either cause the page to jump or use blank space since we
        // want them invisible when easymesh is off.
        // Another perspective on this would be that the WPS button doesn't really belong
        // on this page at all - LuCI has one on the status page - but we're trying to
        // keep _everything_ we need for basic setup on this page.
        // Although perhaps the end-point of that argument is that we'd need status
        // on the page, or at least some way to view the result of the WPS action.
        if (this.isCountrySet && prplmesh) {
            const meshValueNode = this.getUIElement('mesh').node;
            const meshSlider = meshValueNode.closest('.cbi-checkbox');
            meshSlider.style.minWidth = '212px'; // Make it line up with dropdown + button
            const meshField = meshValueNode.closest('.cbi-value-field');
            meshField.style.display = 'inline-flex';
            meshField.append(E('span', {}, [
                this.wpsButtonHost = E('cli-wps-button', {service: 'hostapd'}),
                this.wpsButtonSupplicant = E('cli-wps-button', {service: 'wpa_supplicant'})
            ]));

            this.updateWPSButton();
        }

        return formElement;
    }
});