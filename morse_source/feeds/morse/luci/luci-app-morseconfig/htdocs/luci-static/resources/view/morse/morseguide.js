'use strict';
'require view';

return view.extend({
    handleSaveApply: null,
    handleSave: null,
    handleReset: null,

    render: function(data) {
        var body = E([])
        var ifrm = document.createElement("iframe");
        ifrm.setAttribute("src", "/MM6108-Web GUI User Guide UG2.2.2.pdf");
        ifrm.style.overflow = "hidden";
        ifrm.style.margin = "0px";
        ifrm.style.padding = "0px";
        ifrm.style.height = "100%";
        ifrm.style.width = "100%";
        ifrm.style.position = "absolute";
        ifrm.style.top = "0px";
        ifrm.style.left = "0px";
        ifrm.style.right = "0px";
        ifrm.style.bottom = "0px";
        ifrm.height = "100%";
        ifrm.width = "100%";
        body.appendChild(ifrm);
        return body;
    }
});