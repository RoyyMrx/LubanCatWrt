'require baseclass';
'require fs';
'require uci';

var device = null;

// Driver doesn't support the same set of country codes as a regulatory information
// (EU is not split out).
const DRIVER_COUNTRIES = new Set(['US', 'AU', 'NZ', 'EU', 'IN', 'JP', 'KR', 'SG']);


const __morse_wifi_device = {
    get(field) {
        const morseDevice = device.config.sections('wireless', 'wifi-device').find(ns => ns.type === 'morse');
        return field == null ? morseDevice : morseDevice?.[field];
    },
    set(field, value) {
        const morseDevice = __morse_wifi_device.get();

        if (morseDevice !== undefined) {
            device.config.set('wireless', morseDevice['.name'], field, value);
        }
    },
}

function getWifiIface(prefix, field) {
    const morseDevice = __morse_wifi_device.get();
    if (morseDevice === undefined) {
        return undefined;
    }

    const deviceName = morseDevice['.name'];
    const morseIface = device.config.sections('wireless', 'wifi-iface').find(ns => ns['.name'] === `${prefix}_${deviceName}`);

    return field == null ? morseIface : morseIface?.[field];
}

function setWifiIface(prefix, field, value) {
    const morseDevice = __morse_wifi_device.get();
    if (morseDevice === undefined) {
        return undefined;
    }
    const sectionName = `${prefix}_${morseDevice['.name']}`;

    device.config.set('wireless', sectionName, field, value);
}

const __morse_wifi_iface = {
    get(field) {
        return getWifiIface('default', field);
    },
    set(field, value) {
        setWifiIface('default', field, value);
    }
};

const __morse_wifi_iface_prplsta = {
    get(field) {
        return getWifiIface('prplsta', field);
    },
    set(field, value) {
        setWifiIface('prplsta', field, value);
    }
};


const ___prplmesh = {
    get(section, field) {
        return device.config.get('prplmesh', section, field);
    },
    set(section, field, value) {
        device.config.set('prplmesh', section, field, value);
    },
};

const __rpos = {
    get(field) {
        return device.config.get('rpos', 'core', field);
    },
    set(field, value) {
        device.config.set('rpos', 'core', field, value);
    },
};

const ___dhcp = {
    get(network, field) {
        if(network == null) return device.config.sections('dhcp', 'dhcp');

        if(field == null) return device.config.get('dhcp', network);

        return device.config.get('dhcp', network, field);
    },
    set(network, field, value) {
        if(network == null) return;
        device.config.set('dhcp', network, field, value)
    }
}

const ___dns = {
    get(network, field) {
        if(network == null) return device.config.sections('dhcp', 'dnsmasq');

        if(field == null) return device.config.get('dhcp', network);

        return device.config.get('dhcp', network, field);
    },
    set(network, field, value) {
        if(network == null) return;
        device.config.set('dhcp', network, field, value)
    }
}

const ___network_device = {
    get(name, field) {
        const section = device.config.sections('network', 'device').find(ns => ns.name === name);
        return field == null ? section : section?.[field];
    },
    set(name, field, value) {
        const section = ___network_device.get(name);

        if (section !== undefined) {
            device.config.set('network', section['.name'], field, value);
        }
    },
}

const ___iface = {
    get(field) {
        if(this.network == null) return null;
        if(field == null) return device.config.get('network', this.network);

        return device.config.get('network', this.network, field);
    },
    set(field, value){
        if(this.network == null || field == null) return null;

        device.config.set('network', this.network, field, value);
    },
    remove(field){
        if(field == null) return null;
        device.config.unset('network', this.network, field);
    }
}

const __bridge_iface = {
    __proto__: ___iface,
    network: 'lan'
}

const __eth_iface = {
    __proto__: ___iface,
    network: 'privlan'
}

const __halow_iface = {
    __proto__: ___iface,
    network: 'ahwlan'
}

const ___firewall = {
    get(name, field) {
        if(name == null) return null;
        if(field == null) return device.config.get('firewall', name);
        return device.config.get('firewall', name, field);
    },
    getAll(type){
        if (type == null) return null;
        var sections = device.config.sections('firewall', type);
        return sections;
    },

    set(name, field, value) {
        if(name == null || field == null || value == null) return null;
        return device.config.set('firewall', name, field, value);
    },
}

const morse_conf_shim = {
    mode: {
        __proto__: __morse_wifi_iface,
        get() {
            let mode = super.get("mode");
            if (mode == null) return "none";
            return mode;
        },
        set(mode) {
            super.set("mode", mode);
            // Make sure the radio is on if we're trying to set a mode on it.
            __morse_wifi_device.set("disabled", "0");
        }
    },
    mesh: {
        __proto__: ___prplmesh,
        get() {
            // It's possible that the prplmesh config doesn't exist at all,
            // in which case we need to return '0' to the hidden element.
            return super.get("config", "enable") || "0";
        },
        set(mesh) {
            // Do nothing here; it requires multiple reconfigurations. See setPrplMesh().
        }
    },
    meshmode: {
        __proto__: ___prplmesh,
        get() {
            // Default to reporting controller to the frontend so that if we're missing
            // this config that ends up as the default.
            return super.get("config", "management_mode") === 'Multi-AP-Agent' ? 'agent' : 'controller';
        },
        set(mesh) {
            // Do nothing here; it requires multiple reconfigurations. See setPrplMesh().
        }
    },
    country: {
        __proto__: __morse_wifi_device,
        get() {
            return super.get("country");
        },
        set(country) {
            super.set("country", country);
        }
    },
    ssid: {
        __proto__: __morse_wifi_iface,
        get() {
            return super.get("ssid")
        },
        set(ssid) {
            super.set("ssid", ssid);
        }
    },
    sta_ssid: {
        __proto__: __morse_wifi_iface,
        get() {
            return super.get("ssid")
        },
        set(ssid) {
            super.set("ssid", ssid);
        }
    },
    adhoc_ssid: {
        __proto__: __morse_wifi_iface,
        get() {
            return super.get("ssid")
        },
        set(ssid) {
            super.set("ssid", ssid);
        }
    },
    security: {
        __proto__: __morse_wifi_iface,
        get() {
            return super.get("encryption")
        },
        set(encryption) {
            super.set("encryption", encryption);
        }
    },
    password: {
        __proto__: __morse_wifi_iface,
        get() {
            return super.get("key")
        },
        set(key) {
            super.set("key", key);
        }
    },
    enable_pmf: {
        __proto__: __morse_wifi_iface,
        NO_MGMT_FRAME_PROTECTION:0, // these values are comming from hostapd mfp_options enum
        MGMT_FRAME_PROTECTION_OPTIONAL:1,
        MGMT_FRAME_PROTECTION_REQUIRED:2,
        get() {
            var ieee80211w = super.get("ieee80211w");

            //if the ieee80211w is not defined in the uci config, it will be set to 2 in hostapd.sh
            if(ieee80211w == null)
                ieee80211w = this.MGMT_FRAME_PROTECTION_REQUIRED;
            
            switch(parseInt(ieee80211w))
            {
                case this.MGMT_FRAME_PROTECTION_REQUIRED:
                    return 1;
                case this.NO_MGMT_FRAME_PROTECTION:
                    return 0;
                default:
                    return 0;
            }
        },
        set(enable_pmf) {
                super.set("ieee80211w", enable_pmf ? this.MGMT_FRAME_PROTECTION_REQUIRED : this.NO_MGMT_FRAME_PROTECTION);
        }
    },
    op_class: {
        __proto__: __morse_wifi_device,
        get() {
            return super.get("op_class")
        },
        set(op_class) {
            super.set("op_class", op_class);
        }
    },
    halow_channel: {
        __proto__: __morse_wifi_device,
        get() {
            return super.get("channel")
        },
        set(channel) {
            super.set("channel", channel);
        }
    },
    beacon_int: {
        __proto__: __morse_wifi_device,
        get() {
            return super.get("beacon_int")
        },
        set(beacon_int) {
            super.set("beacon_int", beacon_int);
        }
    },
    dtim_period: {
        __proto__: __morse_wifi_iface,
        get() {
            return super.get("dtim_period")
        },
        set(dtim_period) {
            super.set("dtim_period", dtim_period);
        }
    },
    ap_max_inactivity: {
        __proto__: __morse_wifi_iface,
        get() {
            return super.get("max_inactivity")
        },
        set(max_inactivity) {
            super.set("max_inactivity", max_inactivity);
        }
    },
    eth_ip_method: {
        __proto__: __eth_iface,
        get() {
            let proto = super.get("proto")
            if(___dhcp.get(this.network, "ignore") == "0") return 1;

            switch(proto){
                case "static":
                    return 0;
                case "dhcp":
                    return 2;
                default:
                    break;
            }
            return 0;
        },
        set(proto) {
            switch(parseInt(proto)){
                case 2:
                    ___dhcp.set(this.network, "ignore", 1);
                    ___dns.set(this.network.concat("_dns"), "localuse", 0);
                    ___dns.set(this.network.concat("_dns"), "port", 0);
                    super.set("proto", "dhcp");
                    break;
                case 1:
                    ___dhcp.set(this.network, "ignore", 0);
                    ___dns.set(this.network.concat("_dns"), "localuse", null);
                    ___dns.set(this.network.concat("_dns"), "port", null);
                    super.set("proto", "static");
                    break;
                case 0:
                    ___dhcp.set(this.network, "ignore", 1);
                    ___dns.set(this.network.concat("_dns"), "localuse", 0);
                    ___dns.set(this.network.concat("_dns"), "port", 0);
                    super.set("proto", "static");
                default:
                    break;
            }
        }
    },
    eth_netmask: {
        __proto__: __eth_iface,
        get() {
            return super.get("netmask")
        },
        set(netmask) {
            super.set("netmask", netmask);
        }
    },
    eth_gateway: {
        __proto__: __eth_iface,
        get() {
            var gateway = null;
            if(___dhcp.get(this.network, "ignore") == "0") {
                var dhcp_options = ___dhcp.get(this.network, "dhcp_option");
                if(Array.isArray(dhcp_options)){
                    dhcp_options.filter((option) => option.search("3,") != -1);
                    
                    if(dhcp_options.length == 0)
                        return null;
                    
                    dhcp_options = dhcp_options[0];
                }

                if(dhcp_options == null || dhcp_options.search("3,") == -1) {
                    return null;
                } else {
                    return dhcp_options.slice(2);
                }
            }
            return super.get("gateway")
        },
        set(gateway) {
            if(___dhcp.get(this.network, "ignore") == "0") {
                if(gateway == null || gateway == "")
                    return
                var router = "3,".concat(gateway);
                var dns = "6,".concat(gateway);
                ___dhcp.set(this.network, "dhcp_option", null);
                ___dhcp.set(this.network, "dhcp_option", [router, dns]);
                super.set("gateway", null);
                return
            }
            super.set("gateway", gateway);
        }
    },
    eth_ip: {
        __proto__: __eth_iface,
        get() {
            return super.get("ipaddr")
        },
        set(ip) {
            super.set("ipaddr", ip);
        }
    },
    eth_dhcp_range_start: {
        __proto__: __eth_iface,
        get() {
            return ___dhcp.get(this.network, "start")
        },
        set(start) {
            ___dhcp.set(this.network, "start", start);
        }
    },
    eth_dhcp_range_end:{
        __proto__: __eth_iface,
        get() {
            let start = parseInt(___dhcp.get(this.network, "start"));
            let limit = parseInt(___dhcp.get(this.network, "limit"));
            if(isNaN(limit) || isNaN(start)) return null;
            return start + limit - 1;
        },
        set(end) {
            var start = ___dhcp.get(this.network, "start");
            ___dhcp.set(this.network, "limit", end - start + 1);
        }
    },
    halow_ip_method: {
        __proto__: __halow_iface,
        get() {
            let proto = super.get("proto");
            if(___dhcp.get(this.network, "ignore") == "0") return 1;

            switch(proto){
                case "static":
                    return 0;
                case "dhcp":
                    return 2;
                default:
                    break;
            }
            return 0;
        },
        set(proto) {
            switch(parseInt(proto)){
                case 2:
                    ___dhcp.set(this.network, "ignore", 1);
                    ___dns.set(this.network.concat("_dns"), "localuse", 0);
                    ___dns.set(this.network.concat("_dns"), "port", 0);
                    super.set("proto", "dhcp");
                    break;
                case 1:
                    ___dhcp.set(this.network, "ignore", 0);
                    ___dns.set(this.network.concat("_dns"), "localuse", null);
                    ___dns.set(this.network.concat("_dns"), "port", null);
                    super.set("proto", "static");
                    break;
                case 0:
                    ___dhcp.set(this.network, "ignore", 1);
                    ___dns.set(this.network.concat("_dns"), "localuse", 0);
                    ___dns.set(this.network.concat("_dns"), "port", 0);
                    super.set("proto", "static");
                default:
                    break;
            }
        }
    },
    halow_ip: {
        __proto__: __halow_iface,
        get() {
            return super.get("ipaddr")
        },
        set(ip) {
            super.set("ipaddr", ip);
        }
    },
    halow_netmask: {
        __proto__: __halow_iface,
        get() {
            return super.get("netmask")
        },
        set(netmask) {
            super.set("netmask", netmask);
        }
    },
    halow_gateway: {
        __proto__: __halow_iface,
        get() {
            var gateway = null;
            if(___dhcp.get(this.network, "ignore") == "0") {
                var dhcp_options = ___dhcp.get(this.network, "dhcp_option");
                if(Array.isArray(dhcp_options)){
                    dhcp_options.filter((option) => option.search("3,") != -1);
                    
                    if(dhcp_options.length == 0)
                        return null;
                    
                    dhcp_options = dhcp_options[0];
                }

                if(dhcp_options == null || dhcp_options.search("3,") == -1) {
                    return null;
                } else {
                    return dhcp_options.slice(2);
                }
            }
            return super.get("gateway")
        },
        set(gateway) {
            if(___dhcp.get(this.network, "ignore") == "0") {
                if(gateway == null || gateway == "")
                    return
                var router = "3,".concat(gateway);
                var dns = "6,".concat(gateway);
                ___dhcp.set(this.network, "dhcp_option", null);
                ___dhcp.set(this.network, "dhcp_option", [router, dns]);
                super.set("gateway", null);
                return
            }
            super.set("gateway", gateway);
        }
    },
    halow_dhcp_range_start: {
        __proto__: __halow_iface,
        get() {
            return ___dhcp.get(this.network, "start")
        },
        set(start) {
            ___dhcp.set(this.network, "start", start);
        }
    },
    halow_dhcp_range_end:{
        __proto__: __halow_iface,
        get() {
            let start = parseInt(___dhcp.get(this.network, "start"));
            let limit = parseInt(___dhcp.get(this.network, "limit"));
            if(isNaN(limit) || isNaN(start)) return null;
            return start + limit - 1;
        },
        set(end) {
            var start = ___dhcp.get(this.network, "start");
            ___dhcp.set(this.network, "limit", end - start + 1);
        }
    },
    forwarding: {
        get(){
            let router = !(___firewall.get("mmrouter", "enabled") == "0");
            if (router == null) router = true;
            
            let extender = !(___firewall.get("mmextender", "enabled") == "0");
            if (extender == null) extender = true;

            if (router) {
                ___firewall.set("mmextender", "enabled", 0);
                return "router";
            }
            else if (extender) return "extender";
            return "none"
        },
        set(forwarding){
            switch(forwarding){
                case "router":
                    ___firewall.set("mmrouter", "enabled", "1");
                    ___firewall.set("mmextender", "enabled", "0");
                    __halow_iface.remove("gateway");
                    ___dhcp.set(__halow_iface.network, "dhcp_option", null);
                    ___dhcp.set(__halow_iface.network, "dhcp_option", [
                                                                        "3,".concat(__halow_iface.get("ipaddr")),
                                                                        "6,".concat(__halow_iface.get("ipaddr"))
                                                                      ]);
                    ___dns.set(__eth_iface.network.concat("_dns"), "notinterface", "loopback");
                    ___dns.set(__halow_iface.network.concat("_dns"), "notinterface", null);
                    break;
                case "extender":
                    ___firewall.set("mmrouter", "enabled", "0");
                    ___firewall.set("mmextender", "enabled", "1");
                    __eth_iface.remove("gateway");
                    ___dhcp.set(__eth_iface.network, "dhcp_option", null);
                    ___dhcp.set(__eth_iface.network, "dhcp_option", [
                                                                        "3,".concat(__eth_iface.get("ipaddr")),
                                                                        "6,".concat(__eth_iface.get("ipaddr"))
                                                                      ]);
                    ___dns.set(__eth_iface.network.concat("_dns"), "notinterface", null);
                    ___dns.set(__halow_iface.network.concat("_dns"), "notinterface", "loopback");
                    break;
                case "none":
                default:
                    ___firewall.set("mmrouter", "enabled", "0");
                    ___firewall.set("mmextender", "enabled", "0");
                    ___dns.set(__eth_iface.network.concat("_dns"), "notinterface", "loopback");
                    ___dns.set(__halow_iface.network.concat("_dns"), "notinterface", "loopback");
                    break;
            }
        }
    },
    ap_forwarding: {
        get(){
            return (___firewall.get("mmrouter", "enabled") != "0" || ___firewall.get("mmextender", "enabled") != "0") ? 1 : 0;
        },
        set(forwarding){
            if (forwarding === null) {
                return;
            }

            if (forwarding) {
                ___firewall.set("mmrouter", "enabled", "1");
                ___firewall.set("mmextender", "enabled", "0");
                __halow_iface.remove("gateway");
                ___dhcp.set(__halow_iface.network, "dhcp_option", null);
                ___dhcp.set(__eth_iface.network, "dhcp_option", [
                    "3,".concat(__eth_iface.get("ipaddr")),
                    "6,".concat(__eth_iface.get("ipaddr"))
                ]);
                ___dns.set(__eth_iface.network.concat("_dns"), "notinterface", "loopback");
                ___dns.set(__halow_iface.network.concat("_dns"), "notinterface", null);
            } else {
                ___firewall.set("mmrouter", "enabled", "0");
                ___firewall.set("mmextender", "enabled", "0");
                ___dns.set(__eth_iface.network.concat("_dns"), "notinterface", "loopback");
                ___dns.set(__halow_iface.network.concat("_dns"), "notinterface", "loopback");
            }
        },
    },
    sta_forwarding: {
        get(){
            return (___firewall.get("mmrouter", "enabled") != "0" || ___firewall.get("mmextender", "enabled") != "0") ? 1 : 0;
        },
        set(forwarding){
            if (forwarding === null) {
                return;
            }

            if (forwarding) {
                ___firewall.set("mmrouter", "enabled", "0");
                ___firewall.set("mmextender", "enabled", "1");
                __eth_iface.remove("gateway");
                ___dhcp.set(__eth_iface.network, "dhcp_option", null);
                ___dhcp.set(__eth_iface.network, "dhcp_option", [
                    "3,".concat(__eth_iface.get("ipaddr")),
                    "6,".concat(__eth_iface.get("ipaddr"))
                ]);
                ___dns.set(__eth_iface.network.concat("_dns"), "notinterface", null);
                ___dns.set(__halow_iface.network.concat("_dns"), "notinterface", "loopback");
            } else {
                ___firewall.set("mmrouter", "enabled", "0");
                ___firewall.set("mmextender", "enabled", "0");
                ___dns.set(__eth_iface.network.concat("_dns"), "notinterface", "loopback");
                ___dns.set(__halow_iface.network.concat("_dns"), "notinterface", "loopback");
            }
        },
    },
    bridge: {
        __proto__: __morse_wifi_iface,
        get() {
            if (super.get("network")==__bridge_iface.network) return 1;
            return 0;
        },
        set(bridge) {
            let bridgeIf = __bridge_iface.get("device");
            if(bridgeIf == null)
                bridgeIf = __eth_iface.get("device");
            switch(parseInt(bridge)){
                case 1:
                    super.set("network", __bridge_iface.network)
                    if (__rpos.get("interface")) {
                        __rpos.set("interface", __bridge_iface.network);
                    }
                    __bridge_iface.set("device", bridgeIf);
                    __eth_iface.remove("device");
                    super.set("wds", "1");
                    break;
                case 0:
                    super.set("network", __halow_iface.network)
                    if (__rpos.get("interface")) {
                        __rpos.set("interface", __halow_iface.network);
                    }
                    __eth_iface.set("device", bridgeIf);
                    __bridge_iface.remove("device")
                    super.set("wds", "0");
                default:
                    break;
            }
        }
    },
    bridge_ip_method: {
        __proto__: __bridge_iface,
        get() {
            let proto = super.get("proto")
            if(!___dhcp.get(this.network, "ignore")) return 2;

            switch(proto){
                case "static":
                    return 0;
                case "dhcp":
                    return 1;
                default:
                    break;
            }
            return 0;
        },
        set(proto) {
            switch(parseInt(proto)){
                case 1:
                    ___dhcp.set(this.network, "ignore", 1);
                    super.set("proto", "dhcp");
                    break;
                case 0:
                    ___dhcp.set(this.network, "ignore", 1);
                    super.set("proto", "static");
                    break;
                default:
                    break;
            }
        }
    },
    bridge_ip: {
        __proto__: __bridge_iface,
        get() {
            return super.get("ipaddr")
        },
        set(ip) {
            super.set("ipaddr", ip);
        }
    },
    bridge_netmask: {
        __proto__: __bridge_iface,
        get() {
            return super.get("netmask")
        },
        set(netmask) {
            super.set("netmask", netmask);
        }
    },
    bridge_gateway: {
        __proto__: __bridge_iface,
        get() {
            return super.get("gateway")
        },
        set(gateway) {
            super.set("gateway", gateway);
        }
    },
}

morse_conf_shim.ap_halow_ip_method = morse_conf_shim.halow_ip_method;
morse_conf_shim.sta_halow_ip_method = morse_conf_shim.halow_ip_method;
morse_conf_shim.adhoc_halow_ip_method = morse_conf_shim.halow_ip_method;

var missingSections = function(){
    var networks = ["lan", "ahwlan", "privlan"];
    var dhcp = [...networks, ...networks.map(n => n + "_dns")];
    var firewall = [...networks, "mmrouter", "mmextender"];
    var missing = [];

    window.config = device.config;

    networks.forEach(
        function(network){
            if(device.config.get('network', network) == null)
                missing.push("network." + network);
        }
    )

    dhcp.forEach(
        function(network){
            if(device.config.get('dhcp', network) == null)
                missing.push("dhcp");
        }
    )

    firewall.forEach(
        function(network){
            if(device.config.get('firewall', network) == null)
                missing.push("firewall");
        }
    )

    var morseDevice = device.config.sections('wireless', 'wifi-device').filter(function(ns) {
        return ns.type == 'morse';
    });

    if(morseDevice == null) missing.push("wifi-device");

    return [...new Set(missing)];
}

var mmGetMorseConf = async function() {
    await device.config.load(['wireless', 'dhcp', 'firewall', 'network']);
    try {
        await device.config.load(['prplmesh']);
    } catch {
        // prplmesh config may be missing if these packages aren't installed. Ignore.
    }
    
    try {
        await device.config.load(['rpos']);
    } catch {
        // rpos config may be missing if these packages aren't installed. Ignore.
    }

    return {
        missing: missingSections(),
        config: Object.entries(morse_conf_shim).reduce(
            (d, [k, v]) => {
                d[k] = v.get();
                return d;
            }, {}),
    };
};

// Unfortunately, Prplmesh needs to do a bunch of work, and because
// we need access to whatever the existing setup is it's easier to
// act _after_  everything else.
var setPrplMesh = function(mesh, config) {
    if (mesh == '0') {
        ___prplmesh.set('config', 'enable', '0');

        // We don't support WPS normally, requiring SAE/OWE etc.
        // However, we need it for prplmesh setup.
        __morse_wifi_iface.set('wps_virtual_push_button', null);
        __morse_wifi_iface.set('wps_independent', null);
        __morse_wifi_iface.set('multi_ap', null);
        __morse_wifi_iface.set('auth_cache', null);
        __morse_wifi_iface.set('ifname', null);

        // Remove MAC addresses on the bridge. This is only needed if we're bridging
        // prplmesh (see below).
        ___network_device.set('br0', 'macaddr', null);
        // Remove any bridging from our normal halow interface. Again, only used for prplmesh.
        __halow_iface.set('device', null);

        __morse_wifi_iface_prplsta.set('disabled', '1');

        return;
    }

    const meshmode = config['meshmode'];

    ___prplmesh.set('config', 'enable', '1');

    __morse_wifi_iface.set('mode', 'ap');
    __morse_wifi_iface.set('wps_virtual_push_button', '1')
    __morse_wifi_iface.set('wps_independent', '0');
    __morse_wifi_iface.set('encryption', 'sae')
    __morse_wifi_iface.set('auth_cache', '0');
    __morse_wifi_iface.set('ifname', 'wlan-prpl');
    __morse_wifi_iface.set('multi_ap', '3');

    if (__morse_wifi_iface.get('network') === __bridge_iface.network) {
        // We're using our bridge, so we can use the same bridge for prplmesh
        // but we need it to have a MAC address.
        ___network_device.set('br0', 'macaddr', ___network_device.get('br-prpl', 'macaddr'));
        __halow_iface.set('device', null);
    } else {
        // We're hopefully using ahwlan, but we need to set it to use the br-prpl bridge
        // (4-addr mode requires a bridged interface, but we want to keep it distinct
        // from br0 if the user didn't ask us to bridge br0).
        __halow_iface.set('device', 'br-prpl');
        ___network_device.set('br0', 'macaddr', null);
    }

    if (meshmode === 'controller') {
        ___prplmesh.set('config', 'management_mode', 'Multi-AP-Controller-and-Agent');
        ___prplmesh.set('config', 'operating_mode', 'Gateway');
        ___prplmesh.set('config', 'master', '1');
        ___prplmesh.set('config', 'gateway', '1');
        ___prplmesh.set('config', 'client_roaming', '0');
        ___prplmesh.set('config', 'wired_backhaul', '1');

        __morse_wifi_iface_prplsta.set('disabled', '1');
    } else if (meshmode === 'agent') {
        // If we're an agent, act as a repeater and enable the STA
        // for wireless backhaul.
        ___prplmesh.set('config', 'management_mode', 'Multi-AP-Agent');
        ___prplmesh.set('config', 'operating_mode', 'WDS-Repeater');
        ___prplmesh.set('config', 'master', '0');
        ___prplmesh.set('config', 'gateway', '0');
        ___prplmesh.set('config', 'client_roaming', '1');
        ___prplmesh.set('config', 'wired_backhaul', '0');

        __morse_wifi_iface_prplsta.set('disabled', '0');
        // This makes sure that our STA is set to the same network as the AP.
        // (it might be ahwlan or lan depending on whether we're in bridge mode).
        __morse_wifi_iface_prplsta.set('network', __morse_wifi_iface.get('network'));
    }
}

var mmSaveMorseConf = function(json, opts, mode) {
    if (mode !== undefined) {
        morse_conf_shim['mode'].set(mode);
    }

    let meshVal = null;

    opts.forEach(
        opt => {
            var val = json['config'][opt.field];
            //the JSONMap save deletes unselected checkbox form fields....
            // fields hidden with "depends" are also removed from the jsonmap
            // if it's a Flag based value, we set to 0 and save it. 
            // if it's anything else, assume we just don't want to touch it
            // should come up with something more intelligent for this.
            var removed_fields = ["checkbox", "slider"]
            if(val===undefined){
                if(removed_fields.includes(opt.type))
                    val = 0;
                else if(opt.allow_empty)
                    val = null;
                else
                    return;
            }
            
            //this allows setting of custom values for different keys, used by "forwarding"
            // which is a flag based type value with "none" as a false value, and "router" or "extender"
            // as the true value when in the appropriate "mode"
            // I'd have liked to roll in the above undefined check into this, but you can not check for undefined
            // with .includes.
            var false_vals = ["0", "false", "no", "none", 0, false]
            if(removed_fields.includes(opt.type)){
                if(opt.vals){
                    val = false_vals.includes(val) ? 0 : 1;
                    val = opt.vals[val]
                }
            }

            if(morse_conf_shim[opt.field] == null) return;

            morse_conf_shim[opt.field].set(val);

            if (opt.field === "mesh" && opt.type !== "hidden") {
                meshVal = val;
            }

            if (opt.field === "mode") {
                if (mode !== undefined) {
                    throw new Error("Internal error: mode provided in function and config");
                }
                mode = val;
            }
        }
    )

    if (meshVal !== null) {
        setPrplMesh(meshVal, json.config);
    }

    return device.config.save();
};

var mmApplyUCI = function() {
    return device.config.apply();
}

var mmGetChanges = function() {
    return device.config.changes();
}

var mmGetMorseChannelMap = function() {
    return device.channelMap()
    .then(
        function(csv) {
            var lines = csv.split(/[\r\n]+/);
            var map = {};
            var regex = /^([A-Z]{2}),([0-9]+),([0-9]+),[^,]*,([0-9]+),([0-9\.]+),.*$/;
            lines.forEach(
                function(line){
                    if(regex.test(line)){
                        var match = line.match(regex);
                        if (!DRIVER_COUNTRIES.has((match[1]))) {
                            return;
                        }

                        if(!(match[1] in map))
                            map[match[1]] = {}
                        if(!(match[4] in map[match[1]])){
                            map[match[1]][match[4]] = {}
                            map[match[1]][match[4]]['channels'] = []
                            map[match[1]][match[4]]['freqs'] = []
                            map[match[1]][match[4]]['bandwidth'] = match[2]
                        }
                        map[match[1]][match[4]]['channels'].push(match[3]);
                        map[match[1]][match[4]]['freqs'].push(match[5]);
                    }
                }
            )

            return map;
        }
    )
};

// Similar to mmGetMorseChannelMap, but returns all the data in an array of objects
// (e.g. [{s1g_chan: 2, bandwidth: 3, ...}, ...]) rather than attempting to preprocess.
var mmGetHalowChannels = async function() {
    const channelsCsv = await device.channelMap();
    const [header, ...data] = channelsCsv.split(/[\r\n]+/).map(line => line.split(','));

    const channels = data.map(channel => channel.reduce((channel_obj, val, i) => {
        channel_obj[header[i]] = val;
        return channel_obj;
    }, {}))

    return channels.filter(channel => DRIVER_COUNTRIES.has(channel.country_code));
};

var mmGetMorseIface = function() {
    return device.interface();
};

var mmSetDevice = function(dev){
    device = dev;
}

var mmGetDeviceLoaded = function(){
    return device != null;
}

return baseclass.extend({
    loaded: mmGetDeviceLoaded,
    setDevice: mmSetDevice,
    interface: mmGetMorseIface,
    channelMap: mmGetMorseChannelMap,
    halowChannels: mmGetHalowChannels,
    apply: mmApplyUCI,
    save: mmSaveMorseConf,
    changes: mmGetChanges,
    get: mmGetMorseConf
})