sap.ui.define([
	"sap/ui/model/json/JSONModel"
], function(JSONModel) {
	"use strict";

	return {

		numberUnit: function(sValue) {
			if (!sValue) {
				return "";
			}
			return parseFloat(sValue).toFixed(2);
		},

		objectHeaderNumberUnit: function(sName, sValue) {
			if (sName && sValue) {
				var change = [];
				change.push(sValue);
				change.push("PLN");

				var oCurrType = new sap.ui.model.type.Currency({
					showMeasure: false
				});
				return sName + ": " + oCurrType.formatValue(change, "string");
			}
		},

		parseQuantity: function(sValue) {
			return parseInt(sValue, 10);
		},

		_formatTargetQuantity: function(sValue) {
			var oFormatOptions = {
				precision: 13,
				shortDecimals: 3,
				decimalSeparator: "."
			};
			var oDecimalOptions = {
				precision: 13,
				scale: 3
			};

			var oDecimalType = new sap.ui.model.odata.type.Decimal(oFormatOptions, oDecimalOptions);

			return oDecimalType.formatValue(sValue,
				"string");
		},

		fillObject: function(oData, oCustomerData) {

			if (oData && oCustomerData) {
				oData.Invoice = oCustomerData.Invoice;
				oData.Name = oCustomerData.Name;
				oData.Name2 = oCustomerData.Name2;
				oData.Name3 = oCustomerData.Name3;
				oData.Name4 = oCustomerData.Name4;
				oData.Street = oCustomerData.Street;
				oData.HouseNo = oCustomerData.HouseNo;
				oData.City = oCustomerData.City;
				oData.Country = oCustomerData.Country;
				oData.EMail = oCustomerData.EMail;
				oData.ZzpersId = oCustomerData.ZzpersId;
				oData.Taxnumber1 = oCustomerData.Taxnumber1;
				oData.Tel1Numbr = oCustomerData.Tel1Numbr;
				oData.PostlCod1 = oCustomerData.PostlCod1;
				oData.Iban = oCustomerData.Iban;
				oData.Remarks = oCustomerData.Remarks;
				oData.PoczetFvRemark = oCustomerData.PoczetFvRemark;
			}

			return oData;

		},

		_setInitialCustomerData: function(oData) {
			return new JSONModel({
				Invoice: oData.Invoice,
				Name: oData.Name,
				Name2: oData.Name2,
				Name3: oData.Name3,
				Name4: oData.Name4,
				Street: oData.Street,
				HouseNo: oData.HouseNo,
				City: oData.City,
				Country: oData.Country || "PL",
				EMail: oData.EMail,
				ZzpersId: oData.ZzpersId,
				Taxnumber1: oData.Taxnumber1,
				Tel1Numbr: oData.Tel1Numbr,
				PostlCod1: oData.PostlCod1,
				Iban: oData.Iban,
				Remarks: oData.Remarks,
				PoczetFvRemark: oData.PoczetFvRemark
			});
		},

		_setInitialAccData: function(sName) {
			return new JSONModel({
				AccountId: "",
				Name: sName
			});
		},

		_getFromFields: function(oSimpleForm) {
			var aControls = [];
			var aFormContent = oSimpleForm.getContent();
			var sControlType;
			for (var i = 0; i < aFormContent.length; i++) {
				sControlType = aFormContent[i].getMetadata().getName();
				if (sControlType === "sap.m.Input" || sControlType === "sap.m.FlexBox" ||
					sControlType === "sap.m.MaskInput") {
					if (sControlType === "sap.m.FlexBox") {
						aControls = this._addFromFlexBox(aControls, aFormContent[i]);
					} else {
						aControls.push({
							control: aFormContent[i],
							required: aFormContent[i - 1].getRequired && aFormContent[i - 1].getRequired()
						});
					}
				}
			}
			return aControls;
		},

		_addFromFlexBox: function(aControls, oFormContent) {
			var aItems = oFormContent.getItems();

			for (var i = 0; i < aItems.length; i++) {
				aControls.push({
					control: aItems[i],
					required: true
				});
			}

			return aControls;
		},

		_validateEmail: function(oEvent) {
			var sValue = oEvent.getParameter("value"),
				oRegExp = new RegExp(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/);

			if (!sValue) {
				oEvent.getSource().setValueState("None");
			} else if (!sValue.match(oRegExp)) {
				oEvent.getSource().setValueState("Error");
			} else {
				oEvent.getSource().setValueState("None");
			}
		},

		_setType: function(sType) {
			switch (sType) {
				case "E":
					return sap.ui.core.MessageType.Error;
				case "W":
					return sap.ui.core.MessageType.Warning;
				case "S":
					return sap.ui.core.MessageType.Success;
				case "I":
					return sap.ui.core.MessageType.Information;
			}
		},

		_fillDeepData: function(oHeader, aItems) {

			var oDeepData = oHeader;

			if (oDeepData.NoSapInvoice || oDeepData.InvoiceIsExt) {
				oDeepData.Invoice = "00000000";
			}

			//			for(var i = 0; i < aItems.length; i++){
			//				aItems[i].ItmNumber = this._generateItmNumber(i);
			//			}

			oDeepData.DocToItem = aItems;
			oDeepData.DocToBapi = [{
				"Id": "",
				"Number": "",
				"Row": 0,
				"Field": ""
			}];
			oDeepData.RtrnToMsg = [{
				"ReturnDoc": ""
			}];
			return oDeepData;
		},

		_fillNoRefDeepData: function(oData, sPlant) {
			if (!oData.Invoice) {
				oData.Invoice = "00000000";
			}

			var oDeepData = {
				Invoice: oData.Invoice,
				SalesDoc: oData.SalesOrder,
				CustNum: oData.CustomerNumber,
				NoSapInvoice: true,
				InvoiceIsExt: true,
				IsAgentProc: oData.IsAgentProc,
				Zlsch: oData.Zlsch
			};

			if (oData.Bstdk) {
				//				var TZOffsetMs = new Date(0).getTimezoneOffset()*60*1000;
				var iOffsetMs = 3600000 * 2;
				oData.Bstdk = new Date(oData.Bstdk.getTime() + iOffsetMs);
			}

			for (var i = 0; i < oData.DocToItem.length; i++) {
				oData.DocToItem[i].ItmNumber = this._generateItmNumber(i);
				oData.DocToItem[i].Name = oData.SupplierName;
				oData.DocToItem[i].Name2 = oData.Name2;
				oData.DocToItem[i].Name3 = oData.Name3;
				oData.DocToItem[i].Name4 = oData.Name4;
				oData.DocToItem[i].Bstdk = oData.Bstdk;
				oData.DocToItem[i].City = oData.City;
				oData.DocToItem[i].Country = oData.Country;
				oData.DocToItem[i].HouseNo = oData.HouseNumber;
				oData.DocToItem[i].PostlCod1 = oData.ZIPCode;
				oData.DocToItem[i].Street = oData.Street;
				oData.DocToItem[i].SalesDoc = oData.SalesOrder;
				oData.DocToItem[i].Invoice = oData.Invoice;
				oData.DocToItem[i].PoQuan = parseFloat(oData.DocToItem[i].PoQuan).toFixed(3);
				oData.DocToItem[i].Werks = sPlant;
				oData.DocToItem[i].Iban = oData.Iban;
				oData.DocToItem[i].Remarks = oData.Remarks;
				oData.DocToItem[i].RetReason = oData.RetReason; // 20.06.2018 added return reason on position
				if (oData.DocToItem[i].BruttoValue instanceof Array) {
					oData.DocToItem[i].BruttoValue = oData.DocToItem[i].BruttoValue[0].toFixed(2);
				} else {
					oData.DocToItem[i].BruttoValue = oData.DocToItem[i].BruttoValue;
				}
				if (oData.DocToItem[i].BruttoValue > 0 && (oData.Zlsch === "P" || oData.Zlsch === "R")) {
					oDeepData.IsDisposition = true;
				}
			}

			oDeepData.DocToItem = oData.DocToItem;
			oDeepData.DocToBapi = oData.DocToBapi;
			oDeepData.RtrnToMsg = oData.RtrnToMsg;

			return oDeepData;
		},

		calculateReturn: function(sRet1, sRet2, sCurrency) {
			var sResult = parseFloat(sRet1) + parseFloat(sRet2);
			return sResult.toFixed(2) + " " + sCurrency;
		},

		_calculateAddPrice: function(aItems) {
			var iRetAddAmount = 0;

			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getBindingContext("addData").getObject().BruttoValue) {
					iRetAddAmount = (parseFloat(iRetAddAmount) + parseFloat(aItems[i].getBindingContext("addData").getObject().BruttoValue)).toFixed(2);
				}
			}

			return parseFloat(iRetAddAmount).toFixed(2);
		},

		_generateItmNumber: function(iPos) {
			var sPos = (iPos + 1).toString() + "0",
				sPosLength = 6 - sPos.length,
				sAlphaIn = "";

			for (var i = 0; i < sPosLength; i++) {
				sAlphaIn = sAlphaIn + "0";
			}

			return sAlphaIn.concat("", sPos);
		},

		docTypeChange: function(oViewModel, sSelectedKey) {
			switch (sSelectedKey) {
				case "STCD1":
					oViewModel.setProperty("/nipVisible", true);
					oViewModel.setProperty("/snVisible", false);
					oViewModel.setProperty("/prodVisible", false);
					oViewModel.setProperty("/srchMaxLength", 0);
					break;
				case "ZXXSER50":
					oViewModel.setProperty("/nipVisible", false);
					oViewModel.setProperty("/snVisible", true);
					oViewModel.setProperty("/prodVisible", true);
					oViewModel.setProperty("/srchMaxLength", 0);
					break;
				case "VBELN_VA":
					oViewModel.setProperty("/nipVisible", false);
					oViewModel.setProperty("/snVisible", false);
					oViewModel.setProperty("/prodVisible", false);
					oViewModel.setProperty("/srchMaxLength", 20);
					break;
				default:
					oViewModel.setProperty("/nipVisible", false);
					oViewModel.setProperty("/snVisible", false);
					oViewModel.setProperty("/prodVisible", false);
					oViewModel.setProperty("/srchMaxLength", 0);
			}
		},

		_fillDeepDispoPrint: function(GUID, oHeader, aSelectedItems) {
			//			"guid'00000000-0000-0000-0000-0000-00000000'"
			//			var sGuid = ( GUID === "" || !GUID ) ? "" : GUID; 
			//			var oDeepPayload = {
			//				//				Guid: sGuid,
			//				SalesDoc: "",
			//				PrintToItem: aSelectedItems
			//			};

			//			if(oHeader.hasOwnProperty("DispMethod")){
			//				delete oHeader.DispMethod;
			//			}

			var oDeepPayload = oHeader;
			if (oDeepPayload.hasOwnProperty("OpenReturnDoc")) {
				delete oDeepPayload.OpenReturnDoc;
			}

			if (oDeepPayload.hasOwnProperty("ReturnStatus")) {
				delete oDeepPayload.ReturnStatus;
			}
			//KSEF{
			if (oDeepPayload.hasOwnProperty("DocToBapi")) {
				delete oDeepPayload.DocToBapi;
			}

			if (oDeepPayload.hasOwnProperty("DocToItem")) {
				delete oDeepPayload.DocToItem;
			}

			if (oDeepPayload.hasOwnProperty("RtrnToMsg")) {
				delete oDeepPayload.RtrnToMsg;
			}

			//}

			if (aSelectedItems) {
				aSelectedItems.forEach(function(oItem) {
					if (oItem.hasOwnProperty("ReturnDocStatus")) {
						delete oItem.ReturnDocStatus;
					}
				});
				oDeepPayload.PrintToItem = aSelectedItems;
			}

			if (GUID && !GUID === "") {
				oDeepPayload.Guid = GUID;
			}

			return oDeepPayload;
		},

		_fillDeepDataForPmnts: function(aSelectedItems, aPmntMethods, sPmntMeth) {
			var aMethods = aPmntMethods ? aPmntMethods : [{
				DictName: "ZLSCH",
				Key: "",
				Value: ""
			}];

			var aItems = aSelectedItems ? aSelectedItems : [{
				Invoice: "",
				ItmNumber: "",
				Serialno: ""
			}];

			return {
				DictName: "ZLSCH",
				Key: aPmntMethods ? "MAIN" : "DISP",
				Value: aPmntMethods ? sPmntMeth : "",
				MethodToItem: aItems,
				MethodToMethod: aMethods
			};
		},

		setDataFromPaymentRequest: function(oData, oViewModel, oPmntModel, oDispModel, oBonModel) {
			oViewModel.setProperty("/busy", false);
			if (oData.hasOwnProperty("MethodToMethod") && oData.MethodToMethod !== null) {
				if (oData.Key === "DISP") {
					oDispModel.setData(oData.MethodToMethod);
				} else if (oData.Key === "MAIN") {
					oPmntModel.setData(oData.MethodToMethod);
				//P2S-SD-PROJ: [CR_CORPO-1152] Zwroty Remoon startmj{
				} else if (oData.Key === "BON") {
					oBonModel.setData(oData.MethodToMethod);					
				} //}

				if (oData.Value.indexOf("||") >= 0) {
					var aData = oData.Value.split("||");
					oViewModel.setProperty("/disposition", aData[0] === 'X' ? true : false);
					//					oViewModel.setProperty("/possibleReturn", aData[1]);
					oViewModel.setProperty("/ownPayment", aData[1] ? parseFloat(aData[1]) : 0);

					var findEmergFunds = function(element) {
							if (element.Key === "E") {
								return element;
							}
						},
						findBalance = function(element) {
							if (element.Key === "M") {
								return element;
							}
						},
						checkWarning = function(element) {
							if (element.Key === "WARNING") {
								return element;
							}
						};
						//P2S-SD-PROJ: [CR_CORPO-1152] Zwroty Remoon startmj{
						findBon = function(element) {
							if (element.Key === "B") {
								return element;
							}
						}; //}				

					var oBalance = oData.MethodToMethod.results.find(findBalance),
						oEmergBalance = oData.MethodToMethod.results.find(findEmergFunds),
						oWarning = oData.MethodToMethod.results.find(checkWarning);

					oViewModel.setProperty("/emergencyFund", parseFloat(oEmergBalance.Value));
					oViewModel.setProperty("/shopBalance", parseFloat(oBalance.Value));
					oViewModel.setProperty("/noAccountDoc", oWarning ? true : false);
				}

				oViewModel.setProperty("/pmntLevel", oData.Key);
			}
		},

		getDataFromRequest: function(oData) {
			var oFormattedData;

			if (oData.Value.indexOf("||") > 0) {
				var aData = oData.Value.split("||");
				oFormattedData.disposition = aData[0] === 'X' ? true : false;
				oFormattedData.possibleReturn = aData[1];
			} else {
				oFormattedData.disposition = false;
				oFormattedData.possibleReturn = "0.00";
			}

			return oFormattedData;
		},

		setPmntMethDisplayText: function(sPmntKey) {
			var oMethModel = this.getModel("pmntMethods");

			return this.formatter._getPmntText(oMethModel, sPmntKey);
		},

		setDispoMethDisplayText: function(sPmntKey) {
			var oDispModel = this.getModel("dsipPmntMethods");

			return this.formatter._getPmntText(oDispModel, sPmntKey);
		},
		parseReturnDocVisibility: function(sReturnDoc, sNsStatus) {
			return !!sReturnDoc || sNsStatus === 'DOST';
		},

		_getPmntText: function(oMethModel, sPmntKey) {
			if (!sPmntKey) {
				return sPmntKey;
			}

			if (oMethModel) {
				var aMeths = oMethModel.getProperty("/results");
				if (aMeths === undefined) {
					return sPmntKey;
				}
			} else {
				return sPmntKey;
			}

			function getText(element) {
				if (element.Key === sPmntKey) {
					return element.Value;
				}
			}

			var oMethod = aMeths.find(getText);

			if (oMethod.Value) {
				return oMethod.Value;
			} else {
				return sPmntKey;
			}

		},

		setFieldRequiredBasedOnMeth: function(sPmntMeth, bDisposition, sDispoMeth) {
			var bRequired;
			//BOC 19.02.2019 PSy Added '5' to IBAN field
			if (bDisposition) {
				bRequired = (sPmntMeth === "P" || sDispoMeth === "P" || sPmntMeth === "5" || sDispoMeth === "5") ? true : false;
			} else {
				bRequired = (sPmntMeth === "P" || sPmntMeth === "5") ? true : false;
			}

			return bRequired;
		},
		parseReturnDocStatus: function(sStatus, sNsStatus) {
			if (sStatus === 'C') {
				return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("Returned");
			} else if (sStatus === 'N') {
				return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("Note");
			} else {
				if (sNsStatus === 'DOST') {
					return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("NSInactive");
				} else if (sStatus) {
					return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("OpenReturn");
				}
			}
		},
		parseReturnDocStatusState: function(sStatus, sNsStatus) {
			if (sStatus === 'C') {
				return "Success";
			} else if (sStatus === 'N') {
				return "Warning";
			} else {
					if (sNsStatus === 'DOST') {
					return "Warning";
				} else if (sStatus) {
					return "Error";
				}
			}
		}

	};

});