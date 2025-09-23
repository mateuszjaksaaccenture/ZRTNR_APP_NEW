sap.ui.define([
	"cre/ret/app/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"cre/ret/app/model/formatter",
	"cre/ret/app/model/PopoverMessages",
	"cre/ret/app/model/validation",
	"cre/ret/app/model/ErrProcessor",
	"sap/m/MessageBox",
	"cre/ret/app/model/Utilities"
], function(BaseController, JSONModel, History, formatter, PopoverMessage, validation, ErrProcessor, MessageBox, Utilities) {

	"use strict";

	return BaseController.extend("cre.ret.app.controller.CreateNoRef", {

		formatter: formatter,
		validation: validation,
		ErrProcessor: ErrProcessor,

		onInit: function() {
			var oViewModel = new JSONModel({
				enableCreate: false,
				busy: false,
				delay: 0,
				docState: sap.ui.core.ValueState.Warning,
				returnAmount: "0.00",
				agentPOS: false,
				enableAccount: false
			});

			this._oTable = this.byId("RTRN_ITEMS_TBL");
			this._oInvoiceInput = this.byId("ifsInvoice");
			this._oSalesOrderInput = this.byId("ifsSaleOrder");
			this.getView().setModel(oViewModel, "noRefView");
			this._noRefModel = this.getOwnerComponent().getModel("noRefData");
			this.getRouter().getRoute("createNoRef").attachPatternMatched(this._onObjectMatched, this);

			sap.ui.getCore().attachValidationError(function(oEvent) {
				oEvent.getParameter("element").setValueState(sap.ui.core.ValueState.Error);
			});

			sap.ui.getCore().attachValidationSuccess(function(oEvent) {
				oEvent.getParameter("element").setValueState(sap.ui.core.ValueState.None);
			});
			Utilities.init(this);
		},

		onNavBack: function() {
			var sPreviousHash = History.getInstance().getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

			this._beforeNav();

			if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
				history.go(-1);
			} else {
				this.getRouter().navTo("worklist", {}, true);
			}
		},

		onPosAdd: function() {
			if (this._noRefModel.getProperty("/DocToItem")) {
				var oRetItems = this._noRefModel.getProperty("/DocToItem");
				oRetItems.push({});
				this._noRefModel.setProperty("/DocToItem", oRetItems);
			} else {
				if (!this._noRefModel.getData()) {
					this._noRefModel.setData({});
				}

				this._noRefModel.setProperty("/DocToItem", [{}]);
				this._noRefModel.setProperty("/DocToBapi", [{
					"Id": "",
					"Number": "",
					"Row": 0,
					"Field": ""
				}]);
				this._noRefModel.setProperty("/RtrnToMsg", [{
					"ReturnDoc": ""
				}]);
			}
			this._validateCreateEnablement();
		},

		onMethodPress: function() {
			var aItems = this._oTable.getItems(),
				bCreateEnabled = true;

			for (var i = 0; i < aItems.length; i++) {
				var aCells = aItems[i].getCells();
				for (var m = 0; m < aCells.length; m++) {
					if (validation._validatePosition(aCells[m]) === false) {
						bCreateEnabled = false;
					}
				}
			}

			if (bCreateEnabled === false) {
				var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
				MessageBox.error(this.getResourceBundle().getText("validationError"), {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				});
				return;
			}

			var oView = this.getView();

			if (!this._oPmntMethDialog) {
				this._oPmntMethDialog = sap.ui.xmlfragment(oView.getId(), "cre.ret.app.view.PaymentMethod", oView.getController());
				this._oPmntMethDialog.addStyleClass(this.getOwnerComponent().getContentDensityClass());
				oView.addDependent(this._oPmntMethDialog);
			}

			this._oPmntMethDialog._oDialog.attachEventOnce("afterOpen", function(oEvent) {
				this.getModel("noRefView").setProperty("/busy", true);
				this._getPmntMethods();
			}.bind(this));

			this._oPmntMethDialog.open();
		},

		onMessageButtonPressed: function(oEvent) {
			var oMessagesButton = oEvent.getSource();

			if (!this._oMsgPopover) {
				this._oMsgPopover = sap.ui.xmlfragment("cre.ret.app.view.MessagePopover", this.getView().getController());
				this._oMsgPopover.addStyleClass(this.getOwnerComponent().getContentDensityClass());
				oMessagesButton.addDependent(this._oMsgPopover);
			}

			this._oMsgPopover.toggle(oMessagesButton);
		},

		onNoRefAgentCreate: function() {
			this.getModel("noRefView").setProperty("/agentPOS", true);
			this._createNoRefReturn();
		},

		onNoRefCreate: function() {
			this.getModel("noRefView").setProperty("/agentPOS", false);
			this._createNoRefReturn();
		},

		_createNoRefReturn: function() {
			var aItems = this._oTable.getItems(),
				sPmntMeth = this._noRefModel.getProperty("/Zlsch"),
				bCreateEnabled = true;

			for (var i = 0; i < aItems.length; i++) {
				var aCells = aItems[i].getCells();
				for (var m = 0; m < aCells.length; m++) {
					if (validation._validatePosition(aCells[m]) === false) {
						bCreateEnabled = false;
					}
				}
			}

			if (sPmntMeth === "P" && !this._noRefModel.getProperty("/Iban")) {
				MessageBox.error(this.getResourceBundle().getText("ibanError"), {
					styleClass: this._oComponent.getContentDensityClass()
				});
				bCreateEnabled = false;
			}

			if (sPmntMeth === "R" || sPmntMeth === "3") {
				bCreateEnabled = validation._validateMethodPayment(this.getView());
				if (bCreateEnabled === false) {
					MessageBox.error(this.getResourceBundle().getText("pmntMethFieldsVal"), {
						styleClass: this.getOwnerComponent().getContentDensityClass()
					});
				}
			}

			if (bCreateEnabled === false) {
				return;
			}

			var oData = this._noRefModel.getData(),
				oModel = new sap.ui.model.odata.ODataModel(this.getModel().sServiceUrl, false);

			if (oData) {
				oData.IsAgentProc = this.getModel("noRefView").getProperty("/agentPOS");

				var sPlant = this.getModel("appView").getProperty("/Shop"),
					oDeepData = formatter._fillNoRefDeepData(oData, sPlant);

				this.getModel("noRefView").setProperty("/busy", true);
			} else {
				return;
			}

			oModel.attachEventOnce("requestSent", function() {
				sap.ui.getCore().getMessageManager().removeAllMessages();
			});

			if (oDeepData) {
				oModel.create("/Documents", oDeepData, {
					async: true,
					success: function(data, response) {
						this._fnUpdateSuccess(response);
					}.bind(this),
					error: function(oError) {
						this.getModel("noRefView").setProperty("/busy", false);
						ErrProcessor.showODataError(oError, this.getOwnerComponent());
						// that._fnEntityCreationFailed(oEvent);
					}.bind(this)
				});
			}

		},

		onPosDelete: function(oEvent) {
			var sPosPath = oEvent.getParameter("listItem").getBindingContext("noRefData").getPath(),
				iIndex = parseInt(sPosPath.substring(sPosPath.lastIndexOf("/") + 1), 10), // sPosPath.split("/")[2],
				aItemsData = this._noRefModel.getData().DocToItem;

			if (aItemsData && aItemsData.length > 0) {
				aItemsData.splice(iIndex, 1);
			}
			this._noRefModel.updateBindings();
			this._validateCreateEnablement();
		},

		_getPmntMethods: function() {
			var sGrossVal = 0,
				aItems = this._oTable.getItems();

			for (var i = 0; i < aItems.length; i++) {
				var iItemQuan = parseInt(aItems[i].getBindingContext("noRefData").getObject().PoQuan, 10); //QuantityInput
				sGrossVal = iItemQuan * (parseFloat(sGrossVal) + parseFloat(aItems[i].getBindingContext("noRefData").getObject().BruttoValue)).toFixed(
					2);
			}

			this.getModel("noRefView").setProperty("/toPay", sGrossVal);

			this.getModel().callFunction("/GetReturnMethod", {
				method: "GET",
				urlParameters: {
					"GrossVal": sGrossVal
				},
				async: true,
				success: function(data) {
					this.getOwnerComponent().getModel("pmntMethods").setData(data);
					this.getModel("noRefView").setProperty("/busy", false);
				}.bind(this),
				error: function(oError) {
					var sMessage = JSON.parse(oError.response.body).error.message.value;
					MessageBox.error(sMessage);
					this.getModel("noRefView").setProperty("/busy", false);
				}.bind(this)
			});
		},

		_handlePmntMethConfirm: function(oEvent) {
			var sPmntMeth = oEvent.getParameter("selectedItem").getDescription(),
				bValidMoney = true;

			if (sPmntMeth === "W") {
				this._noRefModel.setProperty("/Iban", "");
				bValidMoney = this._checkMoneyAvailable(this.getModel("noRefView").getProperty("/toPay"),
					this.getOwnerComponent().getModel("pmntMethods").getData(), sPmntMeth);
			} else if (sPmntMeth === "P") {
				bValidMoney = false;
				this.callIbanField();
			} else {
				this._noRefModel.setProperty("/Iban", "");
			}

			if (bValidMoney) {
				this._setPaymentMethod(sPmntMeth);
			}
		},

		_setPaymentMethod: function(sPmntMeth) {
			var aItems = this._oTable.getItems();

			this._noRefModel.setProperty("/Zlsch", sPmntMeth);

			for (var i = 0; i < aItems.length; i++) {
				var sPath = aItems[i].getBindingContext("noRefData").getPath();
				this._noRefModel.setProperty(sPath + "/Zlsch", sPmntMeth);
			}

			this._validateCreateEnablement();
		},

		_checkMoneyAvailable: function(sToPay, oPmntData, sPmntMeth) {
			var iToPay = parseFloat(sToPay),
				iBalance, iEmergBalance,
				findEmergFunds = function(element){
					if (element.Key === "E") {
						return element;
					}
				},
				findBalance = function(element) {
					if (element.Key === "M") {
						return element;
					}
				};

			var oBalance = oPmntData.results.find(findBalance);
			var oEmergBalance = oPmntData.results.find(findEmergFunds);

			if (oBalance && oEmergBalance) {
				iBalance = parseFloat(oBalance.Value);
				iEmergBalance = parseFloat(oEmergBalance.Value);
				if ((iToPay > iBalance) || (iBalance > iToPay && (iBalance - iToPay < iEmergBalance))) {
					var sMessage;
					
					if(iToPay > iBalance){
						sMessage = this.getResourceBundle().getText("noCashNoRef", [iBalance]);
					} else {
						sMessage = this.getResourceBundle().getText("lowCashLevelNoRef", [iBalance, iEmergBalance]);
					}
					
					var fnContinue = function(sChosenMeth) {
						this._setPaymentMethod(sChosenMeth);
					}.bind(this);

					var fnReturn = function() {
						this.onMethodPress();
					}.bind(this);

					Utilities.lowCashLevelWarningNoRef(sMessage,
						fnReturn, fnContinue, sPmntMeth);
					return false;
				} else {
					return true;
				}
			} else {
				var bCompact = !!this.getView().$().closest(".sapUiSizeCompact").length;
				MessageBox.error(this.getResourceBundle().getText("couldntReadMoney"), {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				});
				return false;
			}
		},

		callIbanField: function() {
			if (!this._oIBANDialog) {
				// create dialog via fragment factory
				this._oIBANDialog = sap.ui.xmlfragment("cre.ret.app.view.AccountData", this);
				// connect dialog to view (models, lifecycle)
				this.getView().addDependent(this._oIBANDialog);
				$.sap.syncStyleClass(this.getOwnerComponent().getContentDensityClass(), this.getView(), this._oIBANDialog);
			}
			this._oIBANDialog.open();
		},

		_validateAccountData: function(oEvent) {
			this.getModel("noRefView").setProperty("/enableAccount", this._validIban(oEvent));
		},

		_validateMainIban: function(oEvent) {
			this.getModel("noRefView").setProperty("/enableCreate", this._validIban(oEvent));
		},

		_validIban: function(oEvent) {
			var sValue = oEvent.getParameters().newValue,
				bValid = false;

			if (sValue) {
				bValid = validation.validateIBAN(sValue);
				bValid ? oEvent.getSource().setValueState(sap.ui.core.ValueState.None) : oEvent.getSource().setValueState(sap.ui.core.ValueState.Error);
			}

			return bValid;
		},

		onAccountSubmit: function() {
			this._setPaymentMethod("P");
			this.onIbanClose();
		},

		onIbanClose: function() {
			if (this._oIBANDialog.isOpen()) {
				this._oIBANDialog.close();
			}
		},

		_fnUpdateSuccess: function(oResponse) {
			var sMessage;

			if (oResponse.data.hasOwnProperty("RtrnToMsg") && oResponse.data.RtrnToMsg.results !== undefined && oResponse.data.RtrnToMsg.results
				.length > 0) {
				var sDocNum = oResponse.data.RtrnToMsg.results[0].ReturnDoc,
					sPaymMeth = oResponse.data.RtrnToMsg.results[0].PaymntMeth,
					sNoteNum  = oResponse.data.RtrnToMsg.results[0].Znus;

				if (sPaymMeth === "X") {
					sMessage = this.getResourceBundle().getText("SCS_RT_MSG", [sDocNum, this.getResourceBundle().getText("SCS_RT_MSG_PAY_METH_1")]);
				} else {
					sMessage = this.getResourceBundle().getText("SCS_RT_MSG", [sDocNum, this.getResourceBundle().getText("SCS_RT_MSG_PAY_METH_2")]);
				}
				if(sNoteNum && sNoteNum.length > 0) {
					sMessage = this.getResourceBundle().getText("SCS_RT_MSG_NOTE_ZNUS", [sDocNum, sNoteNum]);
				}
			} else {
				sMessage = this.getResourceBundle().getText("SCS_RT_MSG_NO_DATA");
			}

			if (oResponse.data.hasOwnProperty("DocToBapi") && oResponse.data.DocToBapi.results !== undefined &&
				oResponse.data.DocToBapi.results.length > 0) {
				PopoverMessage._addMessageFromData(oResponse.data.DocToBapi.results);
			}

			MessageBox.success(sMessage, {
				id: "successReturnMessageBox",
				styleClass: this.getOwnerComponent().getContentDensityClass(),
				actions: [this.getResourceBundle().getText("close")],
				onClose: function(sAction) {
//					if (sAction === this.getResourceBundle().getText("return")) {
						this.onNavBack();
//					}
				}.bind(this)
			});

			this._finishAction();
			// this._beforeNav();
		},

		_beforeNav: function() {
			this._noRefModel.setData();
		},

		_finishAction: function() {
			this.getModel("noRefView").setProperty("/busy", false);
		},

		_onObjectMatched: function(oEvent) {
			this._noRefModel.setProperty("/Country", "PL");
			this.getModel("noRefView").setProperty("/agentPOS", false);

			if (sap.ui.getCore().getMessageManager().getMessageModel().getData().length > 0) {
				sap.ui.getCore().getMessageManager().removeAllMessages();
			}
		},

		_countryHelpRequest: function(oEvent) {
			var oInput = oEvent.getSource();

			if (!this._oCountryDialog) {
				this._oCountryDialog = sap.ui.xmlfragment("cre.ret.app.view.Country", this);
				this._oCountryDialog.setModel(this.getView().getModel());
			}

			// clear the old search filter
			this._oCountryDialog.getBinding("items").filter([]);

			this._oCountryDialog.attachEventOnce("confirm", function(oSelectEvent) {
				var sCountryKey = oSelectEvent.getParameter("selectedItem").getDescription();
				oInput.setValue(sCountryKey);
			});

			// toggle compact style
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._oCountryDialog);
			this._oCountryDialog.open();
		},

		_productHelpRequest: function(oEvent) {
			var oInput = oEvent.getSource(),
				sPath = oInput.getParent().getBindingContext("noRefData").getPath();

			if (!this._oProductDialog) {
				this._oProductDialog = sap.ui.xmlfragment("cre.ret.app.view.Products", this);
				this._oProductDialog.setModel(this.getView().getModel());
			}

			// clear the old search filter
			this._oProductDialog.getBinding("items").filter([]);

			this._oProductDialog.attachEventOnce("confirm", function(oSelectEvent) {
				var sProductID = oSelectEvent.getParameter("selectedItem").getDescription();
				this.getModel("noRefData").setProperty(sPath + "/Material", sProductID);
				oInput.setValueState(sap.ui.core.ValueState.None);
			}.bind(this));

			// toggle compact style
			jQuery.sap.syncStyleClass("sapUiSizeCompact", this.getView(), this._oProductDialog);
			this._oProductDialog.open();
		},

		_snChange: function(oEvent) {
			if (oEvent.getParameter("value")) {
				var sPath = oEvent.getSource().getParent().getBindingContext("noRefData").getPath();
				this.getModel("noRefData").setProperty(sPath + "/PoQuan", 1);
				return;
			}
		},

		_quanLive: function(oEvent) {
			if (oEvent.getParameter("value")) {
				oEvent.getSource().setValueState(sap.ui.core.ValueState.None);
			} else {
				oEvent.getSource().setValueState(sap.ui.core.ValueState.Error);
			}
		},

		_comboChange: function(oEvent) {
			if (oEvent.getParameter("selectedItem").getKey()) {
				oEvent.getSource().setValueState(sap.ui.core.ValueState.None);
			}
		},

		_checkItemsAvailable: function() {
			return (this._oTable.getItems().length > 0) ? true : false;
		},

		_validateCreateEnablement: function() {
			var aInputControls = this.formatter._getFromFields(this.byId("CUST_DATA_FORM"));

			var bDocNumsValid = this._validateDocNumbers(),
				oControl;

			for (var m = 0; m < aInputControls.length; m++) {
				oControl = aInputControls[m].control;
				if (aInputControls[m].required) {
					var sValue = oControl.getValue();
					if (!sValue) {
						this.getModel("noRefView").setProperty("/enableCreate", false);
						return;
					}
				}
			}
			if ((bDocNumsValid && this._checkItemsAvailable() && this._zipCodeIsValid()) === true) {
				var bValid = true;
				
				if(this._noRefModel.getProperty("/Zlsch") === "P"){
					bValid = validation.validateIBAN(this._noRefModel.getProperty("/Iban"));
				}
				
				this.getModel("noRefView").setProperty("/enableCreate", bValid);
			} else {
				this.getModel("noRefView").setProperty("/enableCreate", false);
			}
		},

		_validateDocNumbers: function() {
			var sInvoiceNumber = this._oInvoiceInput.getValue(),
				sSalesOrderNumber = this._oSalesOrderInput.getValue();

			if (sInvoiceNumber || sSalesOrderNumber) {
				this.getModel("noRefView").setProperty("/docState", sap.ui.core.ValueState.None);
				return true;
			} else {
				this.getModel("noRefView").setProperty("/docState", sap.ui.core.ValueState.Warning);
				return false;
			}
		},

		zipCodeChange: function(oEvent) {
			this._validateCreateEnablement();
			this._zipCodeIsValid();
		},

		_zipCodeIsValid: function() {
			var bValid = true,
				oControl = this.byId("zipCode"),
				aMaskValues = oControl._oTempValue._aContent,
				aInitialValues = oControl._oTempValue._aInitial,
				oRegExp = /^\d+$/;

			bValid = aMaskValues.every(function(oItem, iIndex) {
				if (iIndex !== 2 && !oRegExp.test(oItem)) {
					return false;
				}
				return true;
			}, this);

			if (bValid) {
				oControl.setValueState(sap.ui.core.ValueState.None);
			} else {
				oControl.setValueState(sap.ui.core.ValueState.Warning);
			}
			return bValid;
		},

		_handleCountrySearch: function(oEvent) {
			var sValue = oEvent.getParameter("value"),
				aFilters = [],
				sFilterValue;

			if (sValue) {
				sFilterValue = sValue.charAt(0).toUpperCase() + sValue.slice(1).toLowerCase();
				aFilters.push(new sap.ui.model.Filter("Landx", sap.ui.model.FilterOperator.StartsWith, sFilterValue));
			}

			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter(aFilters);
		},

		_handleProductSearch: function(oEvent) {
			var sValue = oEvent.getParameter("value"),
				aFilters = [];

			if (sValue) {
				var sFilterValue = sValue.toUpperCase();
				aFilters.push(new sap.ui.model.Filter("Maktx", sap.ui.model.FilterOperator.StartsWith, sFilterValue));
			}

			var oBinding = oEvent.getSource().getBinding("items");
			oBinding.filter(aFilters);
		}

	});
});