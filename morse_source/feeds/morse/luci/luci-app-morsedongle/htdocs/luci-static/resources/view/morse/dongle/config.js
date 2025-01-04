'use strict';
'require fs';
'require form';
'require view';
'require dom';
'require ui';
'require poll';
'require rpc';
'require tools.morse.morseui as morseui';
'require tools.morse.morseconf as mmconf';
'require tools.morse.device.remote as remoteDevice';
'require view.morse.dongle.ap as ap';
'require view.morse.dongle.sta as sta';

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

const country_opt = {
    field: "country",       type: "dropdown",  description: "Region", 
    vals:[],
};

const mode_opt = {
    field: "mode", type: "toggle", description: " ",
    vals:[
        {key: "ap", value: "Access Point"},
        //{key: "none", value: "None" },
        {key: "sta", value: "Station"}
    ]
};

let opts = [];

const MorseConfig = view.extend({ 
    json_data: [],
    channel_map: [],
    device: null,
    mode: null,
    handleReset: null,
    handleSaveApply: null,
    
    handleSave: function(ev) {
        let map = document.querySelector('div.cbi-section .cbi-map');
        return dom.callClassMethod(map, 'save')
        .then(() => mmconf.save(this.json_data, opts, this.mode))
        .then(() => mmconf.changes())
        .then((changes) => this.timeoutModal(changes))
        .then(() => mmconf.apply(this.json_data));
    },

    /* This timeoutModal is targeted to checking remote device connectivity.
     * Where the UITimeoutModal available in libmorseui carries out a ui.pingDevice
     * which is invokes a call from the users webbrowser. This performs a configuration
     * get using the remoterpc dongle call, so the target device is actually checking
     * connectivity. Useful if you're remotely accessing the host device, without
     * actually having access to the dongle.
     */
    timeoutModal: function(changes) {
        let hrefs = [];
        if(changes.network != null){
            changes.network.forEach(
                ([command, section, key, value]) => {
                    if(command == "set" && key == "ipaddr" && ["lan", "privlan"].includes(section))
                        hrefs.push(value);
                }
            );
        }
        
        let ts = performance.now();
        let timerId = 0;
        let timer = 60 * 1000;
        let deadline = ts + timer;
        const tick = function() {
            let now = performance.now();
    
            ui.showModal(_('Saving'), [
                E('p', { 'class': 'spinning' }, _('Applying configuration changes %ds. The page will reload on successful reconnect').format(Math.max(Math.floor((deadline - performance.now()) / 1000, 0))))
            ]);
    
            timerId = window.setTimeout(tick, 1000 - (now - ts));
            ts = now;
        };
    
        const reconnect = function(){
            const poller = function(){
                poll.add(function(){
                    let tasks = [];
                    hrefs.forEach(
                        (ip) => tasks.push(new Promise(async function(resolveFn, rejectFn){
                                window.setTimeout(rejectFn, 1000);
                                // I wanted the ability to scan multiple IP addresses here,
                                // and was considering cloning mmconf for each test to avoid any
                                // concurrency issues - but the setDevice() is only setting a global var
                                // not an object member.
                                // Currently this code will likely break for multiple hrefs, 
                                // depending on how the event loop handles the await below. However, I'm only
                                // expecting 1 href at this time. A change to libmorseconfig to make the global
                                // device is required.
                                //let conf = Object.assign({}, mmconf);
                                let device = remoteDevice.load(ip)
                                mmconf.setDevice(device);
                                try {
                                    await mmconf.get();
                                }
                                catch {
                                    return rejectFn();
                                }
                                return resolveFn();
                            }
                        )))
                    return Promise.any(tasks).then(function(){
                        poll.stop();
                        window.clearTimeout(timerId);
                        ui.hideModal();
                        document.location.reload(true);
                    })
                })
            };
            if(hrefs.length == 0){
                window.clearTimeout(timerId);
                ui.hideModal();
                document.location.reload(true);
            }
            window.setTimeout(poller, 1000)
        };
    
        tick();
    
        window.setTimeout(reconnect, 10*1000);
    },

    checkReport: async function(report) {
        if(!report || Object.keys(report).length == 0)
            throw L.error(_('Error'), _('No compatible remote devices found!'));
        
        let firstEntry = Object.keys(report)[0];
        let ipv4 = report[firstEntry].ipv4;
        if(ipv4 === undefined)
            throw L.error(_('Error'), _('Remote device %s found. But no IPv4 address present!').format(firstEntry));
        
        if(Object.keys(report).length > 1)
            ui.addNotification(null, E('p', _('More than one remote device found, using %s at %s').format(firstEntry, ipv4)), 'info');

        let device = remoteDevice.load(ipv4);
        mmconf.setDevice(device);
        try {
            await mmconf.get();
        }
        catch(e) {
            switch(e.message){
                case "XHR request timed out":
                    console.error(e);
                    throw L.error(_('Timeout'), _('Could not reach device %s at %s').format(firstEntry, ipv4));
                default:
                    throw e;
            }
        }


        return {"ip": ipv4, "deviceName": firstEntry};
    },

    reRenderConfig(m, container){
        let s = m.lookupOption('mode', 'config');
        let mode = s[0].getUIElement("config").getValue();
        this.renderConfig(container, mode);
    },

    renderConfig: async function(container, mode) {
        let content = "";
        switch(mode) {
            case 'ap':
                content = await ap.render([this.json_data, this.map, this.device]);
                opts = ap.getOpts();
                this.mode = "ap";
                break;
            case 'sta':
                content = await sta.render([this.json_data, this.map, this.device]);
                opts = sta.getOpts();
                this.mode = "sta";
                break;
            default:
                content = "";
                return;
        }

        dom.content(container, content);
    },

    load: async function() {
        await fs.exec_direct('/etc/init.d/umdns', ['restart']);
        await umdnsUpdate();
        //docs indicate we should "wait a couple of seconds" after running umdns update.
        // umdns update doesn't seem to wait for us, instead it returns after sending 
        // mdns queries, but before receiving the responses. So adding a wait
        await new Promise((resolveFn) => window.setTimeout(resolveFn, 2000));
        let report = await umdnsBrowse();
        let {ip, deviceName} = await this.checkReport(report);
        let device = remoteDevice.load(ip);
        mmconf.setDevice(device);
        return Promise.all([
            mmconf.get(),
            mmconf.channelMap(),
            device,
            ip,
            deviceName,
            Promise.race([new Promise((resolve) => document.addEventListener("luci-loaded", resolve, {once: true})),
                         new Promise((resolve) => window.setTimeout(resolve, 2000))])
        ]);  
    },

    render: async function([config, map, device, ip, deviceName]) {
        this.json_data = config;
        this.map = map;
        this.device = device;

        let m, s;
        let elements = {};

        m = new form.JSONMap(this.json_data, _('Morse Micro Dongle Configuration'));
        s = m.section(form.NamedSection, 'config');
        let container = E('div', {'class':'cbi-section'});

        let reg = this.json_data['config']['country'];
        if(reg == null || reg == '')
        {
            reg='AU';
            opts = [country_opt, mode_opt];
            this.mode = "none";
            let mm = new form.JSONMap(this.json_data, _("Set your Region"));
            s = mm.section(form.NamedSection, 'config');

            elements['country'] = morseui.renderElement(mm, s, country_opt);

            Object.keys(map).forEach(
                reg => elements['country'].value(reg, reg)
            )
            let content = await mm.render();
            dom.content(container, content);
            return container;
        }
        let so = s.option(form.SectionValue, null, form.NamedSection, 'config', 'config', _('Device %s at %s').format(deviceName, ip));
        so = s.option(form.SectionValue, "mode", form.NamedSection, 'config', 'config', _("Mode"));
        let ss = so.subsection;
        let o = morseui.renderElement(m, ss, mode_opt, this.json_data["config"]["mode"]);
        o.onchange = L.bind(this.reRenderConfig, this, m, container);

        this.renderConfig(container, this.json_data["config"]["mode"])
        return [await m.render(), container];
    }
});

return MorseConfig;