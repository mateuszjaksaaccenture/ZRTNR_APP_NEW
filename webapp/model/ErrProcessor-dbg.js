sap.ui.define([
	"sap/m/MessageBox"
], function(MessageBox) {
	"use strict";

	return {
		
		showODataError: function(oErr, oComponent) {
			this._sErrorText = oComponent.getModel("i18n").getResourceBundle().getText("ERR_RT_MSG");
			this._styleClass = oComponent.getContentDensityClass();
			
			this._showMessageBoxError(this._parseError(oErr));
		},
		
		_parseError: function(oError) {
			// JSON.parse(oError.responseText).error.message.value
			var parser = new DOMParser(),
				sMessage, xmlDoc,
				oResponseBody = oError.responseText || oError.response.body;

			if (oError.responseText) {
				sMessage = JSON.parse(oResponseBody).error.message.value;
			} else {
				xmlDoc = parser.parseFromString(oError.response.body, "text/xml");
				sMessage = xmlDoc.getElementsByTagName("message")[0].childNodes[0].nodeValue;
			}

			if (sMessage) {
				return sMessage;
			} else {
				return this._sErrorText;
			}
		},
		
		_showMessageBoxError : function (sDetails) {
			MessageBox.error(
				this._sErrorText,
				{
					id : "requestErrorMessageBox",
					details: sDetails,
					styleClass: this._styleClass,
					actions: [sap.m.MessageBox.Action.CLOSE]
				}
			);
		}
	}
});