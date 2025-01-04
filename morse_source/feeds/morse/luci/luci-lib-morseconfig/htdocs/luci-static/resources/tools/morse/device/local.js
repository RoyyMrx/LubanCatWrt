'require baseclass';
'require rpc';
'require uci';
'require request';

var callIwinfoScan = rpc.declare({
    object: 'iwinfo',
    method: 'scan',
    params: [ 'device' ],
    nobatch: true,
    expect: { results: [] }
});

var LocalUciClass = uci.constructor.extend({
    apply: function(){
        var uciApply = rpc.declare({
            object: 'uci',
            method: 'apply',
            params: [ 'timeout', 'rollback' ],
            reject: true
        });
        return uciApply(0, false).then(() => document.dispatchEvent(new CustomEvent('uci-applied')));
    },
})

var Local = baseclass.extend({
    config: null,

    __init__: function(){
        this.config = new LocalUciClass();
    },

    /**
     * Trigger a wireless scan on the Morse radio device and obtain a list of
     * nearby networks.
     *
     * @returns {Promise<Array<LuCI.network.WifiScanResult>>}
     * Returns a promise resolving to an array of scan result objects
     * describing the networks found in the vicinity.
     */
    scan: function(iface){
        if(iface === undefined) return null;
        return callIwinfoScan(iface);
    },

    /**
     * Examines all network interfaces on the device and finds the Halow interface
     * by checking for the MorseMicro OUI.
     *
     * @returns {Promise<String>}
     * Returns a promise resolving to an string containing the interface name.
     */
    interface: function(){
        var callNetworkDevice = rpc.declare({
            object: 'luci-rpc',
            method: 'getNetworkDevices'
        });

        return callNetworkDevice()
        .then((devices) => {
            for (let iface in devices){
                if(devices[iface].mac === undefined) continue;

                if(devices[iface].mac.match(/^0c\:bf\:74/i) && devices[iface].devtype == 'wlan')
                    return iface;
            }
            return Promise.reject();
        })
        .catch(() => LuCI.prototype.error('InternalError', "No morse device found on remote url."));
    },

    /**
     * Dumps the contents of the escaped csv formatted regulatory database used
     * by Morse for all regions.
     *
     * @returns {Promise<String>}
     * Returns a promise resolving to an string containing the entire channel file.
     */
    channelMap: function(){
        var callChannelMap = rpc.declare({
            object: 'file',
            method: 'read',
            params: ['path'],
            expect: { data: "" }
        });

        return callChannelMap("/usr/share/morse-regdb/channels.csv")
        .then((csv) => {
            if(csv === undefined) return Promise.reject();

            return csv;
        })
        .catch(() => LuCI.prototype.error('InternalError', "No channel map found on remote url."));
    }
});

var LocalDeviceFactory = baseclass.extend({
    load: () => new Local()
});

return LocalDeviceFactory;