Ysap.ui.define([
	"cre/ret/app/controller/BaseController",
	"sap/ui/model/json/JSONModel"
], function(BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("cre.ret.app.controller.App", {

		onInit: function() {
			var oViewModel,
				fnSetAppNotBusy,
				mati,
				iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
			oViewModel = new JSONModel({
				busy: true,
				delay: 0,
				ShopAvailable: true
			});
			this.setModel(oViewModel, "appView");
			mati = 'M1';
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