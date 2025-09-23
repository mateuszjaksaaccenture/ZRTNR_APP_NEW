sap.ui.define([
	"sap/ui/core/message/ControlMessageProcessor",
	"sap/ui/model/json/JSONModel",
	"cre/ret/app/model/formatter"
], function(ControlMessageProcessor, JSONModel, formatter) {
	"use strict";

	return {
		
		formatter: formatter,

		_addErrorMessage: function(oBatchResponse) {

			if (oBatchResponse) {
				var aRequests = oBatchResponse.getParameter("requests"),
					oMessageManager = sap.ui.getCore().getMessageManager(),
					oMessageProcessor = new ControlMessageProcessor();

				for (var i = 0; i < aRequests.length; i++) {
					if ((aRequests[i].response.statusCode === "400" || "500")) {
						if (aRequests[i].response.responseText) {
							var oMessageProperties = JSON.parse(aRequests[i].response.responseText);

							for (var m = 0; m < oMessageProperties.error.innererror.errordetails.length; m++) {
								if (!oMessageProperties.error.innererror.errordetails[m].message) {
									continue;
								}

								oMessageManager.addMessages(
									new sap.ui.core.message.Message({
										id: oMessageProperties.error.innererror.errordetails[m].code,
										message: oMessageProperties.error.innererror.errordetails[m].message,
										type: oMessageProperties.error.innererror.errordetails[m].severity,
										target: oMessageProperties.error.innererror.errordetails[m].target,
										processor: oMessageProcessor
									})
								);
							}
						}
					}
				}
			}
		},

		_addMessageFromData: function(aMessages) {
			var oMessageManager = sap.ui.getCore().getMessageManager(),
				oMessageProcessor = new ControlMessageProcessor();

			for (var i = 0; i < aMessages.length; i++) {
				if (!aMessages[i].Message) continue;
				oMessageManager.addMessages(
					new sap.ui.core.message.Message({
						id: aMessages[i].Code,
						message: aMessages[i].Message,
						type: aMessages[i].Type,
						processor: oMessageProcessor
					})
				);
			}
		},

		_addMessage: function(oBatchResponse) {

			if (oBatchResponse) {
				var aRequests = oBatchResponse.getParameter("requests"),
					oMessageManager = sap.ui.getCore().getMessageManager(),
					oMessageProcessor = new ControlMessageProcessor(),
					sDescription;

				oMessageManager.registerMessageProcessor(oMessageProcessor);

				for (var i = 0; i < aRequests.length; i++) {

					// if (aRequests[i].response.statusCode === "201" && aRequests[i].response.statusText === "Created") {
					if (aRequests[i].response.headers["sap-message"]) {
						var oMessageProperties = JSON.parse(aRequests[i].response.headers["sap-message"]);

						if (oMessageProperties.details.length > 0) {
							for (var m = 0; m < oMessageProperties.details.length; m++) {
								if (!sDescription) {
									sDescription = oMessageProperties.details[m].message;
								} else {
									sDescription = sDescription + "\n \n" + oMessageProperties.details[m].message;
								}

							}
						}

						oMessageManager.addMessages(
							new sap.ui.core.message.Message({
								id: oMessageProperties.code,
								message: oMessageProperties.message,
								counter: oMessageProperties.details.length,
								description: sDescription,
								type: oMessageProperties.severity,
								target: oMessageProperties.target,
								processor: oMessageProcessor
							})
						);
					}
				}
			}
		}
	};
});