'use strict';

'require fs';
'require view';

const COLUMN_NAMES = {
	country_code: _('Country Code'), 
	bw: _('Bandwidth'),
	s1g_chan: _('Channel Center Frequency Index'),
	s1g_op_class: _('S1G Operating Class (802.11 Table E-5)'),
	global_op_class: _('Global Operating Class (802.11 Table E-4)'),
	centre_freq_mhz: _('Centre Frequency'), 
	duty_cycle_ap: _('AP Duty Cycle Per Hour'),
	duty_cycle_sta: _('STA Duty Cycle Per Hour'),
	country: _('Country'), 
	tx_power_max: _('Tx&nbsp;Power Max (EIRP in dBm)'),
	duty_cycle_omit_ctrl_resp: _('Omit control response frames from duty cycle'),
	pkt_spacing_ms: _('Pause length after transmit'),
	airtime_min_ms: _('Pause after transmit'),
	airtime_max_ms: _('Maximum transmit time'),
};

// Which columns to display in our table, in order.
const COLUMN_DISPLAY = [
	'bw', 's1g_chan', 's1g_op_class', 'global_op_class', 'centre_freq_mhz',
	'tx_power_max', 'duty_cycle_ap', 'duty_cycle_sta',
	'pkt_spacing_ms', 'airtime_min_ms', 'airtime_max_ms',
];

const COLUMN_UNITS = {
	bw: _(' MHz'),
	centre_freq_mhz: _(' MHz'),
	duty_cycle_ap: _('%'),
	duty_cycle_sta: _('%'),
	pkt_spacing_ms: _(' ms'),
	airtime_min_ms: _(' ms'),
	airtime_max_ms: _(' ms'),
};

// Hard to display table on mobile; limit columns.
const COLUMN_MOBILE_DISPLAY = new Set(['bw', 's1g_chan', 'centre_freq_mhz']);


return view.extend({
	handleSaveApply: null,
	handleSave: null,
	handleReset: null,

	load: function() {
		return fs.read_direct('/usr/share/morse-regdb/channels.csv')
			.then((csv) => {
				const [header, ...csv_lines] = csv.trim().split(/[\r\n]+/).map(line => line.split(','));
				// code -> [channelinfo]
				const channel_map = {};
				// code -> country
				const country_map = {};

				for (const csv_line of csv_lines) {
					const channel = {};

					if (csv_line.length < header.length) {
						throw Error(`Invalid channels.csv file ${csv_line.length} vs ${header.length}: ${csv_line}`);
					}

					for (let i = 0; i < header.length; ++i) {
						channel[header[i]] = `${csv_line[i]}${COLUMN_UNITS[header[i]] || ''}`;
					}

					if (channel_map[channel.country_code] === undefined) {
						channel_map[channel.country_code] = [];
					}
					channel_map[channel.country_code].push(COLUMN_DISPLAY.map(col => channel[col]));
					country_map[channel.country_code] = channel.country;
				}

				return [channel_map, country_map];
			});
	},

	render: function([channel_map, country_map]) {
		const country_options = Object.entries(country_map)
			.sort((a, b) => a[1].localeCompare(b[1]))
			.map(([code, country]) => E('option', { 'value': code }, [ `${country} (${code})` ]));
		const country_selector = E('select', {'id': 'country'},
			[E('option', {'disabled': '', 'selected': '', 'hidden': ''}, '--- select country ---')].concat(country_options),
		);

		const channel_info  = E('table', { 'class': 'table hidden', 'id': 'top_10' }, [
			E('tr', { 'class': 'tr table-titles' }, COLUMN_DISPLAY.map(col => 
				E('th', { 'class': 'th center ' + (COLUMN_MOBILE_DISPLAY.has(col) ? '' : 'hide-sm') }, COLUMN_NAMES[col]),
			))
		]);

		country_selector.addEventListener('change', ev => {
			channel_info.classList.remove('hidden');
			cbi_update_table(channel_info, channel_map[ev.currentTarget.value]);
		});

		return [
			E('h2', {}, 'Regulatory Information'),
			E('p', {}, [
				E('label', { 'style': 'margin-right: 5px', 'for': 'country' }, _('Country')),
				country_selector,
			]),
			channel_info
		];
	}
});