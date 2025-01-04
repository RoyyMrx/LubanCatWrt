'use strict';
'require fs';
'require form';
'require view';
'require baseclass';
'require dom';
'require ui';
'require tools.morse.morseui as morseui';


const opts = [    
    {field: "country",       type: "dropdown",  description: "Region", 
        vals:[],
    },
    
    {field: "ssid",          type: "text",  description: "SSID",
        validationRegex:"^.{1,32}$",
        validateErrMessage:"SSID should be between 1 and 32 characters."},
    
    {field: "security",      type: "dropdown",  description: "Encryption", 
        vals:[
            {key: "owe", value: "OWE"}, 
            {key: "sae", value: "SAE"}
        ]
    },
    
    {field: "password",      type: "password",  description: "Password",
        depends: {security: "sae"},
        validationRegex:"^[ -~]{8,63}$",
        validateErrMessage:"Password should be between 8 and 63 characters."
    },
    
    {field: "enable_pmf",    type: "checkbox",     description: "Protected Management Frames"},

    {field: "op_class", type: "hidden", description: "",
        vals:[],
    },

    {field: "bandwidth", type: "dropdown", description: "Operating Bandwidth (MHz)",
        vals:[],
    },

    {field: "halow_channel", type: "dropdown", description: "Channel", 
        vals:[]
    },

    {field: "beacon_int", type: "text", description: "Beacon Interval (ms)"},

    {field: "dtim_period", type: "dropdown", description: "DTIM Period",
        vals:[
            {key: "1", value: "1"},
            {key: "3", value: "3"},
            {key: "10", value: "10"}
        ]
    },

    {field: "ap_max_inactivity", type: "text", description: "Max Inactivity (1-65536)",
        validationRange:{min: 1, max: 65536},
        validateErrMessage:"Max Inactivity must be between 1 and 65536"
    },

    {field: "eth_ip_method",  type: "dropdown",  description: "Wired IP Method",
        vals:[
            {key: "2", value: "DHCP Client"},
            {key: "0", value: "Static"}
        ],
        depends: {bridge: "0"}
    },

    {field: "eth_ip",       type: "text",  description: "Wired IP Address", 
        depends: [{eth_ip_method: "0", bridge: "0"}],
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: "eth_netmask",  type: "text",  description: "Wired IP Netmask", 
        depends: [{eth_ip_method: "0", bridge: "0"}],
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: "eth_gateway",  type: "text",  description: "Wired IP Gateway",
        depends: [{eth_ip_method: "0", bridge: "0"}, {eth_ip_method: "1", bridge: "0"}],
        allow_empty: true,
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },

    {field: "halow_ip_method",  type: "dropdown",  description: "HaLow IP Method",
        vals:[
            {key: "1", value: "DHCP Server"},
            {key: "0", value: "Static"}
        ],
        depends: {bridge: "0"}
    },
    {field: "halow_ip",       type: "text",  description: "HaLow IP Address",
       depends: {bridge: "0"},
       validationRegex:morseui.commonConsts.ip_regex,
       validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: "halow_netmask",  type: "text",  description: "HaLow Netmask",
        depends: {bridge: "0"},
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: "halow_gateway",  type: "text",  description: "HaLow Gateway",
        depends: [{halow_ip_method: "0", bridge: "0"}],
        allow_empty: true,
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: "halow_dhcp_range_start", type: "text", description: "DHCP Range Start",
        depends: {halow_ip_method: "1", bridge: "0"},
        validationRange:{min: 2, max: 254},
        validateErrMessage:"End range limited within 2-254"
    },
    {field: "halow_dhcp_range_end", type: "text", description: "DHCP Range End",
        depends: {halow_ip_method: "1", bridge: "0"},
        validationRange:{min: 2, max: 254},
        validateErrMessage:"End range limited within 2-254"
    },

    {field: "forwarding", type: "hidden", description: "Enable traffic forwarding", helptext: "When enabled, traffic is routed between the LAN and HaLow interfaces",
        vals:{
            "1": "router",
            "0": "none"
        },
        strings:[
            {key: "1", value: "Traffic Forwarding - On"},
            {key: "0", value: "Traffic Forwarding - Off"}
        ],
        depends: {bridge: "0"}
    },

    {field: "bridge", type: "toggle", description: " ",
        vals:[
            {key: "1", value: "Bridge"},
            {key: "0", value: "Traffic Forwarding"}
        ]
    },

    {field: "bridge_ip_method", type: "dropdown", description: "IP Method",
        vals:[
            {key: "1", value: "DHCP Client"},
            {key: "0", value: "Static"}
        ],
        depends: {bridge: "1"}
    },

    {field: "bridge_ip",       type: "text",  description: "IP Address",
       depends: {bridge: "1", bridge_ip_method: "0"},
       validationRegex:morseui.commonConsts.ip_regex,
       validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: "bridge_netmask",  type: "text",  description: "Netmask",
        depends: {bridge: "1", bridge_ip_method: "0"},
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
    {field: "bridge_gateway",  type: "text",  description: "Gateway",
        depends: {bridge: "1", bridge_ip_method: "0"},
        allow_empty: true,
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },
]

const layout = [
    {name: "basic", description: "Basic Wireless", opts: ["ssid", "security", "password"]},

    {name: "traf", description: "Traffic Management", opts:["bridge"]},

    {name: "ip_bridge", description: "IP Settings", 
        opts:["bridge_ip_method", "bridge_ip", "bridge_netmask", "bridge_gateway"], 
        depends:{bridge: "1"}},

    {name: "ip_halow", description: "IP Settings - HaLow",
        opts:["halow_ip_method", "halow_ip", "halow_netmask", "halow_gateway", "halow_dhcp_range_start", "halow_dhcp_range_end"], 
        depends:{bridge: "0"}},

    {name: "ip_eth", description: "IP Settings - Ethernet", 
        opts:["eth_ip_method", "eth_ip", "eth_netmask", "eth_gateway"], 
        depends:{bridge: "0"}},

    {name: "advanced-wireless", description: "Advanced - Wireless", 
        opts:["country", "bandwidth", "halow_channel", "enable_pmf", "beacon_int", "dtim_period", "ap_max_inactivity"]},
]

const getBWs = function(region, map)
{
    let bws = {};
    if (!map.hasOwnProperty(region))
        return [];
    Object.keys(map[region]).forEach(
        op => {
            if (!bws[map[region][op]['bandwidth']]) {
                bws[map[region][op]['bandwidth']] = {};
                bws[map[region][op]['bandwidth']]['channels'] = [];
                bws[map[region][op]['bandwidth']]['freqs'] = [];
                bws[map[region][op]['bandwidth']]['opclass'] = [];
            }
            for (let i = 0; i < map[region][op]['channels'].length; i++) {
                let ch = map[region][op]['channels'][i];
                let fr = map[region][op]['freqs'][i];
                bws[map[region][op]['bandwidth']]['channels'].push(ch);
                bws[map[region][op]['bandwidth']]['freqs'].push(fr);
                bws[map[region][op]['bandwidth']]['opclass'].push(op);
            }

        }
    )
    return bws;
}

const bestOp = function(map, reg)
{
    if(!reg || !map.hasOwnProperty(reg))
        throw L.error("ReferenceError", "Invalid region set!");
    let op = Object.keys(map[reg]).reduce((a, b) => map[reg][a].bandwidth > map[reg][b].bandwidth ? a : b);
    if(!op)
        throw L.error("ReferenceError", "Unable to acquire suitable op class");
    return op;
}

const getBWfromConfigs = function(conf, map)
{
    let reg = conf['config']['country'];
    let default_op = bestOp(map, reg);
    let default_bw = map[reg][default_op].bandwidth;
    let op_class = conf['config']['op_class'];

    if (!op_class || !map[reg].hasOwnProperty(op_class))
        return {"bw": default_bw, "op": default_op};

    let bw = map[reg][op_class].bandwidth;
    return bw ? {"bw": bw, "op": op_class}
                : {"bw": default_bw, "op": default_op};
}

const getOperationClass = function(map, reg, bw, channel) 
{
    let default_op = bestOp(map, reg);

    let BWs = getBWs(reg, map);
    if (BWs.length == 0)
        throw L.error('ReferenceError', 'Unable to acquire channel map. Invalid region?');        
    
    let bwtable = BWs[bw] || Objects.values(BWs)[0];
    let op_class = bwtable.opclass[bwtable.channels.findIndex((ch) => ch==channel)];
    if(!op_class)
        op_class = default_op;
    return op_class;
}

const updateBW = function(m, conf, map, ev) {
    let s = m.lookupOption('bandwidth', 'config');
    let bandwidth = s[0];
    bandwidth.getUIElement('config').clearOptions();

    s = m.lookupOption('country', 'config');
    let region = s[0].getUIElement('config').getValue();

    let bws = getBWs(region, map);
    Object.keys(bws).forEach(bw =>{
        bandwidth.getUIElement('config').addOption(bw, bw + " MHz");
    });

    updateChannels(m, conf, map, ev);
    return;
}

const updateChannels = function(m, conf, map, ev) {
    let s = m.lookupOption('halow_channel', 'config');
    let channels = s[0];
    channels.getUIElement('config').clearOptions();

    s = m.lookupOption('country', 'config');
    let reg = s[0].getUIElement('config').getValue();

    s = m.lookupOption('bandwidth', 'config');
    let bw = s[0].getUIElement('config').getValue();
    let bws = getBWs(reg, map);
    
    if (bws.hasOwnProperty(bw)) {
        for (let i = 0; i < bws[bw]['channels'].length; i++) {
            let ch = bws[bw]['channels'][i];
            let fr = bws[bw]['freqs'][i];
            channels.getUIElement('config').addOption(ch, ch + " (" + fr + " MHz)");
        }
    }
    
    updateOpClass(m, conf, map, ev);
    return;
}

const updateOpClass = function (m, conf, map, ev){
    let s = m.lookupOption('halow_channel', 'config');
    let channel = s[0].getUIElement('config').getValue();

    s = m.lookupOption('country', 'config');
    let reg = s[0].getUIElement('config').getValue();

    s = m.lookupOption('bandwidth', 'config');
    let bw = s[0].getUIElement('config').getValue();
    conf["config"]["op_class"] = getOperationClass(map, reg, bw, channel);
}

const updateForwarding = function(m, conf) 
{
    let s = m.lookupOption('bridge', 'config');
    let mode = s[0].getUIElement("config").getValue();
    if (mode == "0")
        conf['config']['forwarding'] = "router"; 
    conf['config']['forwarding'] = "none";
}

const MorseAp = baseclass.extend({
    getOpts: function() {
        return opts;
    },

    render: function(data) {
        let conf = data[0] || [];
        let map = data[1] || [];
        let device = data[2] || [];

        let m = new form.JSONMap(conf, "");
        s = m.section(form.NamedSection, 'config');

        let reg = conf["config"]["country"];

        let {bw, op} = getBWfromConfigs(conf, map);
        conf['config']['bandwidth'] = bw;
        conf['config']['op_class'] = op;
        conf["config"]["mode"] = "ap";

        let elements = morseui.renderSection(s, opts, layout, conf);
        elements['country'].onchange = L.bind(updateBW, this, m, conf, map);

        let bws=getBWs(reg, map);

        Object.keys(bws).forEach(
            bw => elements['bandwidth'].value(bw, bw + " MHz")
        )

        elements['bandwidth'].onchange = L.bind(updateChannels, this, m, conf, map);
        elements['halow_channel'].onchange = L.bind(updateOpClass, this, m, conf, map);

        bw = conf['config']['bandwidth'];
        if(bws.hasOwnProperty(bw)){
            for (let i = 0; i < bws[bw]['channels'].length; i++) {
                let ch = bws[bw]['channels'][i];
                let fr = bws[bw]['freqs'][i];
                elements['halow_channel'].value(ch, ch + " (" + fr + " MHz)");
            }
        }

        elements['bridge'].onchange = L.bind(updateForwarding, this, m, conf);

        Object.keys(map).forEach(
            reg => {
                elements['country'].value(reg, reg);
            }
        )

        return m.render();
    },
})

return MorseAp;