'use strict';
'require baseclass';
'require dom';
'require network';
'require uci';
'require fs';
'require rpc';

return baseclass.extend({
	title: _('EasyMesh'),

	callSessionAccess: rpc.declare({
		object: 'session',
		method: 'access',
		params: [ 'scope', 'object', 'function' ],
		expect: { 'access': false }
	}),

	load: async function() {
		// NB if the prplmesh config file doesn't exist, this errors out
		// and the caller of the status module doesn't include us.
		await uci.load('prplmesh');
		const enabled = uci.get('prplmesh', 'config', 'enable') === '1';
		const managementMode = uci.get('prplmesh', 'config', 'management_mode');

		if (enabled && managementMode === 'Multi-AP-Controller-and-Agent') {
			await this.callSessionAccess('access-group', 'luci-mod-status-index-prplmesh', 'read');

			return Promise.all([
				fs.exec('/opt/prplmesh/bin/beerocks_cli', ['-c', 'bml_get_agent_status']),
				fs.exec('/opt/prplmesh/bin/prplmesh_cli', ['-c', 'conn_map']),
			]);
		} else {
			return Promise.resolve([null, null])
		}
	},

	render: function([agentStatusOutput, connMapOutput]) {
		if (uci.get('prplmesh', 'config', 'enable') === '0') {
			return E('strong', {}, 'Disabled.');
		}

		const managementMode = uci.get('prplmesh', 'config', 'management_mode');

		const table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, _('Management mode')),
				E('td', { 'class': 'td left' }, managementMode),
			]),
			E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, _('Operating mode')),
				E('td', { 'class': 'td left' }, uci.get('prplmesh', 'config', 'operating_mode')),
			]),
		]);

		const sections = [table];

		if (managementMode === 'Multi-AP-Controller-and-Agent') {
			const agentOperational = agentStatusOutput.code === 0 && agentStatusOutput.stdout.includes('Agent is Operational');
			let colorStyle = `color: var(${agentOperational ? '--success-color-high' : '--error-color-high'})`;
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, _('Agent operational')),
				E('td', { 'class': 'td left', style: colorStyle }, agentOperational ? _('yes') : _('no')),
			]));

			sections.push(E('pre', {}, connMapOutput.stdout));
		}

		return sections;
	},
});
