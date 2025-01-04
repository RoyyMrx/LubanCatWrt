'use strict';
'require fs';
'require form';
'require view';
'require baseclass';
'require dom';
'require ui';
'require rpc';
'require tools.morse.morseui as morseui';

const callIwinfoScan = rpc.declare({
    object: 'iwinfo',
    method: 'scan',
    params: [ 'device' ],
    nobatch: true,
    expect: { results: [] }
});

const opts = [    
    {field: "country",       type: "dropdown",  description: "Region", 
        vals:[],
    },
    
    {field: "ssid",          type: "editdrop",  description: "SSID",
        vals:[],
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
        depends: [{eth_ip_method: "0", bridge: "0"}],
        allow_empty: true,
        validationRegex:morseui.commonConsts.ip_regex,
        validateErrMessage:morseui.commonConsts.ip_regex_errormsg
    },

    {field: "halow_ip_method",  type: "dropdown",  description: "HaLow IP Method",
        vals:[
            {key: "2", value: "DHCP Client"},
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

    {field: "forwarding", type: "hidden", description: "Enable traffic forwarding", helptext: "When enabled, traffic is routed between the LAN and HaLow interfaces",
        vals:{
            "1": "extender",
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
        opts:["halow_ip_method", "halow_ip", "halow_netmask", "halow_gateway"], 
        depends:{bridge: "0"}},

    {name: "ip_eth", description: "IP Settings - Ethernet", 
        opts:["eth_ip_method", "eth_ip", "eth_netmask", "eth_gateway"], 
        depends:{bridge: "0"}},

    {name: "advanced-wireless", description: "Advanced - Wireless", 
        opts:["country", "enable_pmf"]},
];

const doScan = function(m, device, ev) {        
    return device.interface()
    .then( iface => device.scan(iface) )
    .then(result => {
        let s = m.lookupOption('ssid', 'config');
        let o = s[0];
        let dropdownList = o.getUIElement('config');
        dropdownList.clearChoices(true);
        if(result.length == 0){
            console.info("Scan list empty.")
            return;
        }
        dropdownList.setValue(result[0]['ssid']);
        result.forEach(result => {
            o.getUIElement('config').addChoices([result['ssid']]);
        });
    })
};

const resetPassword = function(m, ev)
{
    let pw = m.lookupOption('password', 'config');
    pw[0].getUIElement("config").setValue("");
};

const updateForwarding = function(m, conf) 
{
    let s = m.lookupOption('bridge', 'config');
    let mode = s[0].getUIElement("config").getValue();
    if (mode == "0")
        conf['config']['forwarding'] = "extender"; 
    conf['config']['forwarding'] = "none";
};

const MorseSta = baseclass.extend({
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

        conf["config"]["mode"] = "sta";

        let elements = morseui.renderSection(s, opts, layout, conf);

        let ssidOpt = elements['ssid'];
        ssidOpt.onchange = L.bind(resetPassword, this, m);
        ssidOpt.btnText = 'Scan';
        ssidOpt.onclick = L.bind(doScan, this, m, device);

        elements['bridge'].onchange = L.bind(updateForwarding, this, m, conf);

        Object.keys(map).forEach(
            reg => {
                elements['country'].value(reg, reg);
            }
        )

        return m.render();
    },
});

return MorseSta;