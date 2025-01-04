'require baseclass';
'require rpc';
'require uci';

var remoteRequest = rpc.declare({
	object: 'dongle',
	method: 'request',
	params: ['uri', 'body']
});

var RemoteRpcClass = rpc.constructor.extend({
    remoteRpcRequestId: 1,
    remoteRpcBaseUrl: null,
    remoteRpcSessionId: '00000000000000000000000000000000',
    rpcInterceptorFns:[],

    expires: 0,
    message: {
        jsonrpc: "2.0",
        id: 0,
        method: "call",
        params: [
            "00000000000000000000000000000000",
            "session",
            "login",
            {
                username: "dongle",
                password: "dongle"
            }
        ]
    },

    __currentTime: () => Math.floor(Date.now() / 1000),

    __login: function(){
        return remoteRequest(this.remoteRpcBaseUrl, this.message);
    },

    __checkLogin: function(){
        if(this.__currentTime() > this.expires){
            return this.__login()
            .then((response) => {
                if(response.result && (response.result[0] != 0 || response.result.length != 2))
                    throw("Some error");
                this.remoteRpcSessionId = response.result[1].ubus_rpc_session;
                this.expires = this.__currentTime() + response.result[1].expires;
            })
        }
        return Promise.resolve();
    },
    
    call: function(req, cb, nobatch) {
        if(this.remoteRpcBaseUrl === undefined)
            return Promise.reject(new Error("No URL set for remote RPC call!"));

        return this.__checkLogin()
        .then(() => {
            req.params[0] = this.remoteRpcSessionId;
            req.id = this.remoteRpcRequestId++;

            return remoteRequest(this.remoteRpcBaseUrl, req)
        })
        .then(cb, cb);
    },

    parseCallReply: function (req, res) {
        var msg = null;
        if (res instanceof Error) return req.reject(res);
        try {
            if (res.error || !res.result)
                 throw new Error("RPCError", { "message": _("RPC call to %s/%s failed with HTTP error %d: %s").format(req.object, req.method, res.error.code, res.error.message || "?")});
            msg = res;
        } catch (e) {
            return req.reject(e);
        }
        Promise.all(
            this.rpcInterceptorFns.map(function (fn) {
                return fn(msg, req);
            })
        )
            .then(this.handleCallReply.bind(this, req, msg))
            .catch(req.reject);
    },

    /**
	 * Returns the current RPC session id.
	 *
	 * @returns {string}
	 * Returns the 32 byte session ID string used for authenticating remote
	 * requests.
	 */
	getSessionID: function() {
		return this.remoteRpcSessionId;
	},

	/**
	 * Set the RPC session id to use.
	 *
	 * @param {string} sid
	 * Sets the 32 byte session ID string used for authenticating remote
	 * requests.
	 */
	setSessionID: function(sid) {
		this.remoteRpcSessionId = sid;
	},

	/**
	 * Returns the current RPC base URL.
	 *
	 * @returns {string}
	 * Returns the RPC URL endpoint to issue requests against.
	 */
	getBaseURL: function() {
		return this.remoteRpcBaseUrl;
	},

	/**
	 * Set the RPC base URL to use.
	 *
	 * @param {string} sid
	 * Sets the RPC URL endpoint to issue requests against.
	 */
	setBaseURL: function(url) {
		this.remoteRpcBaseUrl = url;
	},
})

var remoteRpc = new RemoteRpcClass();

var RemoteUciClass = uci.constructor.extend({

    callLoad: remoteRpc.declare({
		object: 'uci',
		method: 'get',
		params: [ 'config' ],
		expect: { values: { } },
		reject: true
	}),


	callOrder: remoteRpc.declare({
		object: 'uci',
		method: 'order',
		params: [ 'config', 'sections' ],
		reject: true
	}),

	callAdd: remoteRpc.declare({
		object: 'uci',
		method: 'add',
		params: [ 'config', 'type', 'name', 'values' ],
		expect: { section: '' },
		reject: true
	}),

	callSet: remoteRpc.declare({
		object: 'uci',
		method: 'set',
		params: [ 'config', 'section', 'values' ],
		reject: true
	}),

	callDelete: remoteRpc.declare({
		object: 'uci',
		method: 'delete',
		params: [ 'config', 'section', 'options' ],
		reject: true
	}),

	callApply: remoteRpc.declare({
		object: 'uci',
		method: 'apply',
		params: [ 'timeout', 'rollback' ],
		reject: true
	}),

	callConfirm: remoteRpc.declare({
		object: 'uci',
		method: 'confirm',
		reject: true
	}),

    changes: remoteRpc.declare({
		object: 'uci',
		method: 'changes',
		expect: { changes: { } }
	}),

    apply: function(){
        this.callApply(0, false);
    },
})

var Remote = baseclass.extend({
    remoteUrl: null,
    config: null,
    remoteRpc: remoteRpc,
    __init__: function(url){
        this.remoteUrl = 'http://' + url + '/ubus/';
        this.config = new RemoteUciClass();
        remoteRpc.setBaseURL(this.remoteUrl);
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
        var callIwinfoScan = remoteRpc.declare({
            object: 'iwinfo',
            method: 'scan',
            params: [ 'device' ],
            nobatch: true,
            expect: { results: [] }
        });
        
        var args = {
            "device": iface
        };
        
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
        var callNetworkDevice = remoteRpc.declare({
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
        .catch(() => {
            throw new Error('InternalError', {"message": "No morse device found on remote url."})
        });
    },

    /**
     * Dumps the contents of the escaped csv formatted regulatory database used
     * by Morse for all regions.
     *
     * @returns {Promise<String>}
     * Returns a promise resolving to an string containing the entire channel file.
     */
    channelMap: function(){
        var callChannelMap = remoteRpc.declare({
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
        .catch(() => { 
            throw new Error('InternalError', {"message": "No channel map found on remote url."}); 
        });
    }
});

var RemoteDeviceFactory = baseclass.extend({
    load: (url) => new Remote(url)
});

return RemoteDeviceFactory;