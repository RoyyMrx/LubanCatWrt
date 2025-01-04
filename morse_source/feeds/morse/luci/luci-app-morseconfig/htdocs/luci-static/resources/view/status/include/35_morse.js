'use strict';
'require baseclass';
'require fs';
'require network';

class MorseInfo {
	fields = { 'wired_ip': '', 'wired_mac': '', 'halow_ip': '', 'halow_mac': '' };

	tableHeaders = {
		'wired_ip': "Wired IP Address",
		'wired_mac': 'Wired MAC Address',
		'halow_ip': 'HaLow IP Address',
		'halow_mac': 'HaLow MAC Address'
	}

	id = 'morsetable'
	constructor(lan, wlan, fallback) {
		for (const key in this.fields) {
			this.fields[key] = 'N/A';
		}

		let lanips = lan?.getIPAddrs();
		let lanmac = lan?.getMAC();
		let wlanips = wlan?.getIPAddrs();
		let wlanmac = wlan?.getMAC();
		let fallbackips = fallback?.getIPAddrs();
		let fallbackmac = fallback?.getMAC();
		if(lan && lanmac && lanips.length > 0)
		{
			this.updateValue('wired_ip', lanips[0].split("/")[0]);
			this.updateValue('wired_mac', lanmac);
		}
		else if(fallback && fallbackmac && fallbackips.length > 0)
		{
			this.updateValue('wired_ip', fallbackips[0].split("/")[0]);
			this.updateValue('wired_mac', fallbackmac);
		}

		if (wlan && wlanmac && wlanips.length > 0)
		{
			this.updateValue('halow_ip', wlanips[0].split("/")[0]);
			this.updateValue('halow_mac', wlanmac);
		}
	}

	getTableData() {
		var table = E("table", { class: "table", id: this.id });
		for (const key in this.fields) {
			table.appendChild(E("tr", { class: "tr", id: key }, [E("td", { class: "td left", width: "33%" }, [this.tableHeaders[key]]), E("td", { class: "td left" }, [this.fields[key]])]));
		}
		return table;
	}

	updateValue(key, val) {
		this.fields[key] = val;
		var tableRow = document.getElementById(key);
		if (tableRow) {
			tableRow.childNodes[1].innerHTML = val;
		}
	}
}

return baseclass.extend({
	title: _('Interface Addresses'),

	load: function () {
		return Promise.all([
			network.getNetwork("privlan").then((privlan) => privlan.getDevice()),
			network.getNetwork("ahwlan").then((ahwlan) => ahwlan.getDevice()),
			network.getDevice('br0'),
		]);
	},

	render: function ([lan, wlan, bridge]) {
		this.morseInfo = new MorseInfo(lan, wlan, bridge);
		return E([this.morseInfo.getTableData()]);
	}
});
