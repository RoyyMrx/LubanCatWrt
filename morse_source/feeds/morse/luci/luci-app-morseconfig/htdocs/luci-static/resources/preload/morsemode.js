'use strict';
'require ui';
'require rpc';
'require poll';
'require baseclass';
'require tools.morse.morseui as morseui';
'require tools.morse.morseconf as mmconf';
'require tools.morse.device.local as localDevice';

var devices = {};

return baseclass.extend({
	__init__: function() {
		mmconf.setDevice(localDevice.load());
		this.updateIndicator();
		poll.add(L.bind(this.updateIndicator, this), 5);
	},

	updateIndicator: function() {
		return mmconf.get().then(
			(config) => {
				var info = {};
				info.status = config.config.mode == '' ? "none" : config.config.mode;
				info.state = "active";
				info.name = "morse-mode";
				ui.showIndicator(info.name, "HaLow Mode: " + info.status, null, info.state);
			}
		)
	}
});
