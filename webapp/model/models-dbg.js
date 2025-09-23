sap.ui.define([
		"sap/ui/model/json/JSONModel",
		"sap/ui/Device"
	], function (JSONModel, Device) {
		"use strict";

		return {

			createDeviceModel : function () {
				var oModel = new JSONModel(Device);
				oModel.setDefaultBindingMode("OneWay");
				return oModel;
			},

			createFLPModel : function () {
				var fnGetUser = jQuery.sap.getObject("sap.ushell.Container.getUser"),
					bIsShareInJamActive = fnGetUser ? fnGetUser().isJamActive() : false,
					oModel = new JSONModel({
						isShareInJamActive: bIsShareInJamActive
					});
				oModel.setDefaultBindingMode("OneWay");
				return oModel;
			},
			
			createCustomerModel: function() {
				var oModel = new JSONModel();
				oModel.setSizeLimit("2000"); //P2S-MAINT-SD: [PBI*223465] App:zwroty wyszukiwarka SN startmj{}
				oModel.setDefaultBindingMode("TwoWay");
				return oModel;
			}

		};

	}
);