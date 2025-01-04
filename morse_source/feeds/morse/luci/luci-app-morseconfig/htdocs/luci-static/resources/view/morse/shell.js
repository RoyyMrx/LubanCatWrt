'use strict';
'require view';
'require network';

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    render: function(data) {
        var body = E([]);        
        var ifrm = document.createElement("iframe");
        ifrm.id = 'shell';
        ifrm.src = "http://" + window.location.host + ":4200/"
        ifrm.height = "870px";
        ifrm.width = "100%";
        ifrm.style.backgroundColor = 'black';
        body.appendChild(ifrm);
        return body;
    }
});