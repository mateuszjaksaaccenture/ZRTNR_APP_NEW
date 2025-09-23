// _checkIfBatchRequestSucceeded: function(oEvent) {
// 	var oParams = oEvent.getParameters();
// 	var aRequests = oEvent.getParameters().requests;
// 	var oRequest;
// 	if (oParams.success) {
// 		if (aRequests) {
// 			for (var i = 0; i < aRequests.length; i++) {
// 				oRequest = oEvent.getParameters().requests[i];
// 				if (!oRequest.success) {
// 					return false;
// 				}
// 			}
// 		}
// 		return true;
// 	} else {
// 		return false;
// 	}
// },

// onCommentPress: function(oEvent) {
// 	var oButton = oEvent.getSource();

// 	// create popover
// 	if (!this._oPopover) {
// 		this._oPopover = sap.ui.xmlfragment("cre.ret.app.view.Comment", this);
// 		this.getView().addDependent(this._oPopover);
// 		this._oPopover.bindElement(oButton.getParent().getBindingContext().getPath());
// 	}

// 	// delay because addDependent will do a async rerendering and the actionSheet will immediately close without it.
// 	$.sap.delayedCall(0, this, function() {
// 		this._oPopover.openBy(oButton);
// 	});
// },