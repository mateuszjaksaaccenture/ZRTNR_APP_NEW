sap.ui.define([
	"cre/ret/app/controller/BaseController",
	"sap/ui/model/json/JSONModel"
], function(BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("cre.ret.app.controller.App", {

		onInit: function() {
			var oViewModel,
				fnSetAppNotBusy,
				iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
			oViewModel = new JSONModel({
				busy: true,
				delay: 0,
				ShopAvailable: true
			});
			this.setModel(oViewModel, "appView");
			fnSetAppNotBusy = function() {
				oViewModel.setProperty("/busy", false);
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			};

			this.getOwnerComponent().getModel().metadataLoaded().
			then(fnSetAppNotBusy);

			// apply content density mode to root view
			this.getView().addStyleClass(this.getOwnerComponent().getContentDensityClass());
		}
	});
//asdasdasdasdasdasAA
});