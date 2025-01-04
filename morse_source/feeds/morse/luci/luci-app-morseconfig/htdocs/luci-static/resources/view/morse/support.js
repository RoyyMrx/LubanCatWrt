'use strict';
'require view';
'require ui';
'require fs';
'require uci';
'require form';
'require tools.morse.morseconf as mmconf';
'require tools.morse.device.local as localDevice';

var m_morseItf = "wlan1"; //gets ovewritten on load if morse itf is fetched successfully
const dump_path = "/tmp/" //filepath for dumping the files

var CBIDownloadSnapshot;

CBIDownloadSnapshot = form.DummyValue.extend({

    dumpState: function(){
        ui.showModal(_('Getting snapshot...'), [
            E('p', { 'class': 'spinning' }, _('The system is gathering required information.'))
        ]);

        const temp_filename = "sys_dump";
        return fs.exec("/morse/scripts/mm_dumps.sh",["-c","-b","OpenWRT","-i",m_morseItf,"-o",temp_filename,"-d",dump_path]).then(
            (retVal) => 
            {
                if(retVal["code"] == 0)
                {
                    fs.read_direct(dump_path + temp_filename + ".tar.gz","blob").then(
                        (snapshotFile) =>
                        {
                            const filename = "mm_sysdump_" + new Date().toISOString().split(".")[0];
                            var body = [];
                            var snapshot = new Blob([snapshotFile],{type: 'application/x-tar'});
                            var url = URL.createObjectURL(snapshot);
                            body.push(E('p', _("Snapshot collected succesfully.")));
                            body.push(E('a',{"href":url,"download":filename},E('button', {'class': 'btn cbi-button-action important','click': ui.hideModal}, [_('Download')])));
                            ui.showModal(_('Export snapshot'), body);    
                        }
                    );
                }
                else
                {
                    var body = [];
                    body.push(E('p', _("Something went wrong, error: "+retVal["code"]+"\n stderr:",retVal["stderr"])));
                    body.push(E('button', {'class': 'btn cbi-button-action important','click': ui.hideModal,}, [_('Close')]));
                    ui.showModal(_('Failed to gather snapshot'), body);  
                    
                }
            }
        );
    },
    renderWidget: function(section_id, option_id) {
        return E([], [
            E('span', { 'class': 'control-group' }, [
                E('button', { 'class': 'cbi-button cbi-button-apply', 'click': ui.createHandlerFn(this, 'dumpState')}, _('Create Archive')),
                ' '
            ])
        ]);
    },
});


return view.extend({
    load: function() {
        mmconf.setDevice(localDevice.load());
        return Promise.all([
            uci.load('system'),
            mmconf.interface()
        ]);
    },

    render: function(data) {
        m_morseItf=data[1];
        var m, s, o;

        m = new form.Map('system',
            _('Support'));

        s = m.section(form.NamedSection, 'morse_snapshot', 'morse', _('Snapshots'));


        o = s.option(form.Flag, 'allow_upload', 
            _('Morse Crash Reporter'),
            _('I agree to send information (logs and debug command output) about this system and its configuration to Morse Micro servers when a problem is detected.  This is for the purpose of debugging and improving the system, and is an optional feature.'));

        o.rmempty = false;
        o.ucisection = 'morse_snapshot';
        o.default = o.disabled;

        o = s.option( CBIDownloadSnapshot, '_systime', 
            _('Snapshot'),
            _('Collect a snapshot of the system for the purpose of debugging any issues experienced. This can be sent to the support team for further analysis.'));
        
        return m.render();
    }
});
