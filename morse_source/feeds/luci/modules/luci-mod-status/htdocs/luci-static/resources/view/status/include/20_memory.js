'use strict';
'require baseclass';
'require rpc';
"require fs"

var callSystemInfo = rpc.declare({
	object: 'system',
	method: 'info'
});

function getMemoryUsage(df_output)
{
    const regex1 = new RegExp(' [0-9]+');
    var total = 0;
    var used = 0;

    var lines = df_output.stdout.split('\n');
    
    for(var i=1;i<lines.length;i++)
    {
        var blocks = regex1.exec(lines[i]);
        if(blocks)
        {
            var blocks_used = regex1.exec(lines[i].substring(blocks['index']+blocks[0].length));
            total += parseInt(blocks)*1024; //1K blocks
            used += parseInt(blocks_used)*1024;
        }
    }
    return [total,used];
}

function progressbar(value, max, byte) {
	var vn = parseInt(value) || 0,
	    mn = parseInt(max) || 100,
	    fv = byte ? String.format('%1024.2mB', value) : value,
	    fm = byte ? String.format('%1024.2mB', max) : max,
	    pc = Math.floor((100 / mn) * vn);

	return E('div', {
		'class': 'cbi-progressbar',
		'title': '%s / %s (%d%%)'.format(fv, fm, pc)
	}, E('div', { 'style': 'width:%.2f%%'.format(pc) }));
}

return baseclass.extend({
	title: _('Memory'),

	load: function() {
        return Promise.all([L.resolveDefault(callSystemInfo(), {}),fs.exec('df')]);
	},

    render: function (data) {
        var systeminfo = data[0];
        var dfInfo = data[1];
		var mem = L.isObject(systeminfo.memory) ? systeminfo.memory : {},
		    swap = L.isObject(systeminfo.swap) ? systeminfo.swap : {};

		var fields = [
			_('Total Available'), (mem.available) ? mem.available : (mem.total && mem.free && mem.buffered) ? mem.free + mem.buffered : null, mem.total,
			_('Used'),            (mem.total && mem.free) ? (mem.total - mem.free) : null, mem.total,
		];

		if (mem.buffered)
			fields.push(_('Buffered'), mem.buffered, mem.total);

		if (mem.cached)
			fields.push(_('Cached'), mem.cached, mem.total);

		if (swap.total > 0)
			fields.push(_('Swap free'), swap.free, swap.total);

        var memUsage = getMemoryUsage(dfInfo);
        fields.push(_("Storage"),memUsage[1],memUsage[0]);
		var table = E('table', { 'class': 'table' });

		for (var i = 0; i < fields.length; i += 3) {
			table.appendChild(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left', 'width': '33%' }, [ fields[i] ]),
				E('td', { 'class': 'td left' }, [
					(fields[i + 1] != null) ? progressbar(fields[i + 1], fields[i + 2], true) : '?'
				])
			]));
		}

		return table;
	}
});
