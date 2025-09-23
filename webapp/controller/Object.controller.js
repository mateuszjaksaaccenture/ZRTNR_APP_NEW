/*global location*/
sap.ui.define([
	"cre/ret/app/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/ui/core/routing/History",
	"cre/ret/app/model/formatter",
	"cre/ret/app/model/validation",
	"cre/ret/app/model/PopoverMessages",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"cre/ret/app/model/ErrProcessor",
	"cre/ret/app/model/Utilities",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator"
], function(
	BaseController, JSONModel, History, formatter, validation, PopoverMessage, MessageBox, MessageToast, ErrProcessor, Utilities, Filter,
	FilterOperator) {
	"use strict";
	const ORDER_STATUS_NO_RETURN = 0;
	const ORDER_STATUS_PARTIALLY_RETURNED = 1;
	const ORDER_STATUS_FULLY_RETURNED = 2;
	const ORDER_STATUS_OPEN_RETURN_DOCS = 3;
	const ORDER_STATUS_NO_RETURN_INFO = 4;
	const ORDER_STATUS_DOST = 5;
	const ORDER_STATUS_OLD = 6;

	return BaseController.extend("cre.ret.app.controller.Object", {
		formatter: formatter,
		validation: validation,
		PopoverMessage: PopoverMessage,
		ErrProcessor: ErrProcessor,
		Utilities: Utilities,
		_oBinding: {},
		_mainPmntProc: "MAIN",
		_dispPmntProc: "DISP",
		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */
		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function() {
			Utilities.init(this);
			// Model used to manipulate control states. The chosen values make sure,
			// detail page is busy indication immediately so there is no break in
			// between the busy indication for loading the view's meta data
			this._markedTable = [];
			this._checkedTable = [];
			this._justSelected;
			this._justSelectedNS; //PBI000000185547 startmj{}
			var iOriginalBusyDelay,
				oViewModel = Utilities.creeateObjectViewModel(true);
			this._oLineTable = this.byId("PROD_TBL");
			//CR101 startmj{
			this._oLineTable._getSelectAllCheckbox().setVisible(false); // }
			this._oAddTable = this.byId("ADD_PROD_TBL");
			this._oModel = this.getOwnerComponent().getModel();
			this._oViewModel = oViewModel;
			this.getRouter().getRoute("object").attachPatternMatched(this._onObjectMatched, this);
			// Store original busy indicator delay, so it can be restored later on
			iOriginalBusyDelay = this.getView().getBusyIndicatorDelay();
			this.setModel(oViewModel, "objectView");
			this._oModel.metadataLoaded().then(function() {
				// Restore original busy indicator delay for the object view
				oViewModel.setProperty("/delay", iOriginalBusyDelay);
			});
			// Register the view with the message manager
			sap.ui.getCore().getMessageManager().registerObject(this.getView(), true);
			var oMessagesModel = sap.ui.getCore().getMessageManager().getMessageModel();
			this._oBinding = new sap.ui.model.Binding(oMessagesModel, "/", oMessagesModel.getContext("/"));
		},
		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */
		/**
		 * Event handler  for navigating back.
		 * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
		 * If not, it will replace the current entry of the browser history with the worklist route.
		 * @public
		 */
		onNavBack: function() {
			var sPreviousHash = History.getInstance().getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
			this._beforeNav();
			this.cleanup();
			if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
				this.getRouter().navTo("worklist", {}, true);
				//window.location.reload();
			} else {
				this.getRouter().navTo("worklist", {}, true);
			}
		},
		onPosAdd: function(oEvent) {
			var oAddModel = this.getModel("addData"),
				oTempData = oAddModel.getData(),
				sItemNumber;
			if (!oTempData.addItems) {
				oTempData.addItems = [];
				sItemNumber = formatter._generateItmNumber(1);
			} else {
				sItemNumber = formatter._generateItmNumber(oTempData.addItems.length + 1);
			}
			oTempData.addItems.push({
				ItmNumber: sItemNumber,
				PoQuan: "1.000"
			});
			oAddModel.setData(oTempData);
			this._oViewModel.setProperty("/addItems", oTempData.addItems.length);
		},
		onDispPrint: function(oEvent) {
			var oViewModel = this._oViewModel,
				oDeepData;
			this._customerData = oEvent.getSource().getParent().getContent()[0].getModel("customer").getData();
			var bPass = this._checkCustomerData(this._customerData);
			if (bPass === false) {
				return;
			}
			/*      
			     var title = this.getResourceBundle().getText("confirmDialogTitle"),
			     message = this.getResourceBundle().getText("confirmMSG"),
			     buttonText = this.getResourceBundle().getText("confirmButtonText"); */

			var fnSuccess = function(oData, response) {
				if (oData.Guid) {
					oViewModel.setProperty("/guid", oData.Guid);
					/* MessageBox.success(message, {
					     actions: [buttonText],
					     title: title,
					     onClose:  (oAction) => {
					      
					     this._printDispo(oData.Guid);
					     }
					     }); */

					this._printDispo(oData.Guid);
				}
				oViewModel.setProperty("/busy", false);
			}.bind(this);
			var fnError = function(oError) {
				oViewModel.setProperty("/busy", false);
				ErrProcessor.showODataError(oError, this.getOwnerComponent());
			}.bind(this);
			this.oHeaderData = this.aDocToItems = undefined;
			this._getSelectedData();
			if (this.aDocToItems) {
				oViewModel.setProperty("/busy", true);
				oDeepData = formatter._fillDeepDispoPrint(oViewModel.getProperty("/guid"), this.oHeaderData, this.aDocToItems);
				Utilities.createDispoPrintEntry(oDeepData, fnSuccess, fnError);
			}
		},
		_printDispo: function(GUID) {
			var fnSuccess = function(pdfURL) {
				window.open(pdfURL);
				this._oViewModel.setProperty("/dispoPrint", true);
				this._validateSubmitEnablement();
			}.bind(this);
			var fnError = function(oError) {
				this._oViewModel.setProperty("/dispoPrint", true);
				this._validateSubmitEnablement();
				ErrProcessor.showODataError(oError, this.getOwnerComponent());
			}.bind(this);
			Utilities.printDisposition(GUID, fnSuccess, fnError);
		},
		onGetSNDialog: function(oEvent) {
			this.oAddSNInput = oEvent.getSource();
			this.snAddPath = this.oAddSNInput.getBindingContext("addData").getPath();
			this.instQuan = this._getItemProperty("InstQuantity");
			this.Invoice = this._getItemProperty("Invoice");
			this.ItmNumber = oEvent.getSource().getBindingContext("addData").getObject("ItmNumber");
			this.Zzbillacc = this._getItemProperty("Zzbillacc");
			if (!this._oSNDialog) {
				// create dialog via fragment factory
				this._oSNDialog = sap.ui.xmlfragment("cre.ret.app.view.SerialNumber", this);
				// connect dialog to view (models, lifecycle)
				this.getView().addDependent(this._oSNDialog);
			}
			this._oSNDialog.open();
		},
		onConfirmSN: function(oEvent) {
			this._oViewModel.setProperty("/busy", true);
			this._getProductBySerial(this._oViewModel.getProperty("/additionalSN"));
		},
		onCancelSN: function() {
			this._oViewModel.setProperty("/snValueState", sap.ui.core.ValueState.None);
			this._oViewModel.setProperty("/additionalSN", "");
			this._oSNDialog.close();
		},
		onAddProdDelete: function(oEvent) {
			var sPosPath = oEvent.getParameter("listItem").getBindingContext("addData").getPath(),
				iIndex = parseInt(sPosPath.substring(sPosPath.lastIndexOf("/") + 1), 10), // sPosPath.split("/")[2],
				aItemsData = this.getModel("addData").getData().addItems;
			if (aItemsData && aItemsData.length > 0) {
				aItemsData.splice(iIndex, 1);
			}
			this._oViewModel.setProperty("/addItems", aItemsData.length);
			this.getModel("addData").updateBindings();
			this._oViewModel.setProperty("/addReturnAmount", formatter._calculateAddPrice(this._oAddTable.getItems()));
		},
		onUpdateFinished: function(oEvent) {
			// update the worklist's object counter after the table update
			var sTitle,
				oTable = oEvent.getSource(),
				iTotalItems = oEvent.getParameter("total");
			// only update the counter if the length is final and
			// the table is not empty
			if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
				sTitle = this.getResourceBundle().getText("PROD_HEADER_COUNT", [iTotalItems]);
			} else {
				sTitle = this.getResourceBundle().getText("PROD_HEADER");
			}
			this._oViewModel.setProperty("/lineItemsTableHeader", sTitle);
			this._setTableLinesUnenabled(oTable);
		},
		onMethodPress: function() {
			var oView = this.getView();
			if (validation._validateCombo(this._oLineTable.getSelectedItems()) === false) {
				var bCompact = !!oView.$().closest(".sapUiSizeCompact").length;
				MessageBox.error(this.getResourceBundle().getText("validationError"), {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				});
				return;
			}
			if (this._oViewModel.getProperty("/addItems") > 0) {
				if (validation._validateCombo(this._oAddTable.getItems()) === false) {
					var bCompact = !!oView.$().closest(".sapUiSizeCompact").length;
					MessageBox.error(this.getResourceBundle().getText("validationError"), {
						styleClass: bCompact ? "sapUiSizeCompact" : ""
					});
					return;
				}
			}
			//      Validate return reason 20.06.2018
			if (!this.getModel("addData").getProperty("/RetReason")) {
				var bCompact = !!oView.$().closest(".sapUiSizeCompact").length;
				MessageBox.error(this.getResourceBundle().getText("validationError"), {
					styleClass: bCompact ? "sapUiSizeCompact" : ""
				});
				return;
			}
			// Validate by attribute invoice lines
			if (this.getModel().getProperty(oView.getBindingContext().getPath() + "/InvoiceIsExt")) {
				if (validation._validateIfsSet(this._oLineTable.getSelectedItems(), this.getModel("addData").getData().addItems, this) === false) {
					return;
				} else {
					this._getPmntMethods();
				}
			} else {
				this._getPmntMethods();
			}
			// [03.08.2018 AWi]
			/*      // Extra validation for set [AWi]
			      if(validation._validateSet(this._oLineTable.getItems(), this._oLineTable.getSelectedItems(), this) === false){
			        return;
			      }*/
			//this._getPmntMethods();
		},
		_getPmntMethods: function(sGetType) {   
			var oViewModel = this._oViewModel,
				oPmntModel = this.getModel("pmntMethods"),
				oDispModel = this.getModel("dsipPmntMethods"),
				oBonModel = this.getModel("bonPmntMethods"), //P2S-SD-PROJ: [CR_CORPO-1152] Zwroty Remoon startmj{}
				aMeths;
			var fnSuccess = function(oData) {
				formatter.setDataFromPaymentRequest(oData, oViewModel, oPmntModel, oDispModel, oBonModel);
				if (oViewModel.getProperty("/ownPayment") > 0 && oData.Key === this._dispPmntProc) {
					oViewModel.setProperty("/pmntDialogTitle", this.getResourceBundle().getText("SelectPmntMethDisp"));
					this._openDispPmntDialog();
				}
				//P2S-SD-PROJ: [CR_CORPO-1152] Zwroty Remoon startmj{}
				else if( oViewModel.getProperty("/bonMethod") == '?' ) {
					this._openBonDialog();
				} 
				else {
					if (oViewModel.getProperty("/noAccountDoc")) {
						var fnHandlePmntMethod = function(sPmntMeth) {
							this._handlePmntMethConfirm(null, true, sPmntMeth);
						}.bind(this);
						Utilities.noAccountDocWarning(fnHandlePmntMethod);
						return;
					}
					if (oViewModel.getProperty("/ownPayment") == 0 && oViewModel.getProperty("/disposition")) {
						oViewModel.setProperty("/pmntDialogTitle", this.getResourceBundle().getText("SelectPmntMethDisp"));
					} else if (oViewModel.getProperty("/disposition")) {
						oViewModel.setProperty("/pmntDialogTitle", this.getResourceBundle().getText("SelectPmntMethOwnPay"));
					} else {
						oViewModel.setProperty("/pmntDialogTitle", this.getResourceBundle().getText("SelectPmntMeth"));
					}					
					this._openPmntDialog();					
				}
			}.bind(this);
			var fnError = function(oError) {
				oViewModel.setProperty("/busy", false);
				ErrProcessor.showODataError(oError, this.getOwnerComponent());
			}.bind(this);
			this.oHeaderData = this.aDocToItems = undefined;
			if (oDispModel.getData().hasOwnProperty("results") && sGetType === this._mainPmntProc) {
				aMeths = oDispModel.getData().results;
			}
			//      else { PSy 30.10.2018 PayU
			this._getSelectedData();
			//      }
			if (this.aDocToItems || aMeths) {
				var oDeepData = formatter._fillDeepDataForPmnts(this.aDocToItems, aMeths, oViewModel.getProperty("/dispMethod"));
				oViewModel.setProperty("/busy", true);
				oViewModel.setProperty("/dispoPrint", false);
				Utilities.readPaymentMethods(oDeepData, fnSuccess, fnError);
			}
		},
		_handleDispMethConfirm: function(oEvent) {
			var sPmntMeth = oEvent.getParameter("selectedItem").getDescription(),
				oViewModel = this._oViewModel;
			oViewModel.setProperty("/dispMethod", sPmntMeth);
			this._getPmntMethods(this._mainPmntProc);
		},
		//P2S-SD-PROJ: [CR_CORPO-1152] Zwroty Remoon startmj{
		_handleBonMethConfirm: function(oEvent) {
			var sPmntMeth = oEvent.getParameter("selectedItem").getDescription(),
				oViewModel = this._oViewModel;
			oViewModel.setProperty("/bonMethod", sPmntMeth);
			this._getPmntMethods(this._mainPmntProc);
		}, // }

		_handlePmntMethConfirm: function(oEvent, bContinue, sMeth) {
			var sPmntMeth = bContinue ? sMeth : oEvent.getParameter("selectedItem").getDescription(),
				oContext = this.getView().getBindingContext(),
				sFirstPayment = oContext.getProperty("FirstPayment"),
				aSelectedItems = this._oLineTable.getSelectedItems(),
				oViewModel = this._oViewModel,
				aTextAttr = [],
				iToReturn = parseFloat(oViewModel.getProperty("/returnAmount")) + parseFloat(oViewModel.getProperty("/addReturnAmount")),
				iOwnPayment = oViewModel.getProperty("/ownPayment") ? parseFloat(oViewModel.getProperty("/ownPayment")) : 0,
				iShopBalance = oViewModel.getProperty("/shopBalance"),
				iEmergFunds = oViewModel.getProperty("/emergencyFund");
			this.getModel("addData").setProperty("/Zlsch", sPmntMeth);
			//12.04.18 PSy
			//'P' or 'R' = IsDisposotion
			//Odkomentowanie startmj{
			if (sPmntMeth === "P" || sPmntMeth === "R") {
				oViewModel.setProperty("/disposition", true);
			} //}
			oViewModel.setProperty("/zlsch", sPmntMeth);
			var fnReturn = function() {
				this._getPmntMethods(this._mainPmntProc);
			}.bind(this);
			var fnContinue = function(meth) {
				this._handlePmntMethConfirm(null, true, meth);
			}.bind(this);
			var sMessage, i18nProperty;
			if (oViewModel.getProperty("/disposition") === true) {
				oViewModel.setProperty("/enableSubmit", false);
				if (!oViewModel.getProperty("/dispMethod")) {
					oViewModel.setProperty("/dispMethod", sPmntMeth);
				}
				oViewModel.setProperty("/dispoItemZlsch", sPmntMeth);
				if (sPmntMeth === "W" &&
					((iOwnPayment > iShopBalance) ||
						(iShopBalance > iOwnPayment && (iShopBalance - iOwnPayment < iEmergFunds))
					)) {
					i18nProperty = iOwnPayment > iShopBalance ? "noCash" : "lowCashLevel";
					i18nProperty === "lowCashLevel" ? aTextAttr.push(iShopBalance, iEmergFunds) : aTextAttr.push(iShopBalance);
				}
			} else {
				if (sPmntMeth === "W" &&
					((iToReturn > iShopBalance) ||
						(iShopBalance > iToReturn && (iShopBalance - iToReturn < iEmergFunds))
					)) {
					i18nProperty = iToReturn > iShopBalance ? "noCashNoRef" : "lowCashLevelNoRef";
					i18nProperty === "lowCashLevelNoRef" ? aTextAttr.push(iShopBalance, iEmergFunds) : aTextAttr.push(iShopBalance);
				}
			}
			sMessage = i18nProperty ? this.getResourceBundle().getText(i18nProperty, aTextAttr) : "";
			if (i18nProperty && !bContinue) {
				Utilities.lowCashLevelWarning(sMessage,
					fnReturn, fnContinue, sPmntMeth);
				return;
			}
			for (var i = 0; i < aSelectedItems.length; i++) {
				var sPath = aSelectedItems[i].getBindingContext().getPath(),
					oData = this.getModel("addData").getProperty(sPath);
				this.getModel().setProperty(sPath + "/Zlsch", sPmntMeth, null, true);
				if (!oData) {
					oData = {
						Zlsch: sPmntMeth
					};
				} else {
					oData.Zlsch = sPmntMeth;
				}
				this.getModel("addData").setProperty(sPath, oData);
				if (oData.RetReason) {
					this._oLineTable.getSelectedItems()[i].getCells()[4].setSelectedKey(oData.RetReason);
				}
			}
			this.getModel().setProperty(oContext.getPath() + "/Zlsch", sPmntMeth);
			this.getModel().setProperty(oContext.getPath() + "/IsDisposition", oViewModel.getProperty("/disposition"));
			var aItemsData = this.getModel("addData").getData().addItems;
			if (aItemsData && aItemsData.length > 0) {
				for (var m = 0; m < aItemsData.length; m++) {
					aItemsData[m].Zlsch = sPmntMeth;
				}
				this.getModel("addData").updateBindings();
			}
			//      this.getModel().updateBindings();

			this.returnCreate(oContext);
		},
		_openPmntDialog: function() {
			//			//P2S-KSEF-SD: [KSEF_1_GAP_12]  Zmiany w apps Fiori dla eFakt startmj{
			//			var sKseftrue = this.getView().getBindingContext().getObject().ZZKSEFTRUE;
			//			var sKsefid = this.getView().getBindingContext().getObject().ZZKSEFID;
			//			if(sKseftrue === 'X' && (sKsefid === undefined || sKsefid === '') ){
			//				var sMsg = this.getView().getModel("i18n").getResourceBundle().getText("KsefError");
			//				sap.m.MessageToast.show(sMsg);
			//				return;
			//			} // }

			if (!this._oPmntMethDialog) {
				this._oPmntMethDialog = this._createDialog(this._oPmntMethDialog, "cre.ret.app.view.PaymentMethod");
			}
			this._oPmntMethDialog.open();
		},
		_openDispPmntDialog: function() {
			if (!this._oDispPmntMethDialog) {
				this._oDispPmntMethDialog = this._createDialog(this._oDispPmntMethDialog, "cre.ret.app.view.DispPaymentMethod");
			}
			this._oDispPmntMethDialog.open();
		},

        //P2S-SD-PROJ: [CR_CORPO-1152] Zwroty Remoon startmj{
		_openBonDialog: function() {
			if (!this._oBonMethDialog) {
				this._oBonMethDialog = this._createDialog(this._oBonMethDialog, "cre.ret.app.view.BonMethod");
			}
			this._oBonMethDialog.open(); // }
		},        
		_createDialog: function(oDialog, fragmentName) {
			var oView = this.getView();
			oDialog = sap.ui.xmlfragment(oView.getId(), fragmentName, oView.getController());
			oDialog.addStyleClass(this.getOwnerComponent().getContentDensityClass());
			oView.addDependent(oDialog);
			$.sap.syncStyleClass(this.getOwnerComponent().getContentDensityClass(), oView, oDialog);
			return oDialog;
		},
		returnCreate: function(oContext) {
			var oObject = oContext.getObject(),
				sCustNum = oObject.CustNum,
				sNIP = oObject.Taxnumber1,
				bInvExt = oObject.InvoiceIsExt,
				sPmntMeth = this._oViewModel.getProperty("/zlsch"),
				sDispoCashPmntMeth = this._oViewModel.getProperty("/dispoItemZlsch");
			/*  // >>>>>>>>>> ZEBROJA2 [‎10.‎03.‎2018 12:53] FEN 4864 10.03.2018: showing Customer data popup is independent of payment/disposition method  
			      if (!sCustNum || !sNIP || bInvExt === true) {
			        this._callCreateCustomerData();
			      } else {
			        if(sPmntMeth === "R" || sPmntMeth === "P" || sDispoCashPmntMeth === "R" || sDispoCashPmntMeth === "P"){
			          this._callCreateCustomerData();
			        } else {
			          this._callCreateReturnFunction();
			        }
			      } SYNIAPAV - Added comment to submit changes 10.03*/
			this._callCreateCustomerData();
			/*  // <<<<<<<<<< ZEBROJA2 [‎10.‎03.‎2018 12:53] FEN 4864 10.03.2018: showing Customer data popup is independent of payment/disposition method  */
		},
		_getProductBySerial: function(sSerialNum) {
			if (!this._checkSNisNotExist(sSerialNum)) {
				this._oViewModel.setProperty("/busy", false);
				return;
			}
			if (sSerialNum) {
				this.getModel().callFunction("/GetSerialProduct", {
					method: "GET",
					urlParameters: {
						"Serialno": sSerialNum
					},
					async: true,
					success: function(data) {
						if ((!data.Zzbillacc || data.Zzbillacc != this.Zzbillacc) || data.InstQuantity != this.instQuan || data.Invoice != this.Invoice) {
							this._oViewModel.setProperty("/snValueState", sap.ui.core.ValueState.Error);
							MessageBox.error(this.getResourceBundle().getText("billingKontoError"));
						} else {
							data.ItmNumber = this.ItmNumber;
							data.AppQty = "1"; // P2S-MAINT-SD: [PBI*194694] Zwroty NS z IFS startmj{}
							this.getModel("addData").setProperty(this.snAddPath, data);
							this._oViewModel.setProperty("/snValueState", sap.ui.core.ValueState.None);
							this._oViewModel.setProperty("/additionalSN", "");
							this.oAddSNInput.setValueState(sap.ui.core.ValueState.None);
							this._oSNDialog.close();
						}
						this._oViewModel.setProperty("/addReturnAmount", formatter._calculateAddPrice(this._oAddTable.getItems()));
						this._oViewModel.setProperty("/busy", false);
					}.bind(this),
					error: function(oError) {
						this._oViewModel.setProperty("/busy", false);
						ErrProcessor.showODataError(oError, this.getOwnerComponent());
					}.bind(this)
				});
			} else {
				MessageBox.error(this.getResourceBundle().getText("emptySernNr"));
				this._oViewModel.setProperty("/snValueState", sap.ui.core.ValueState.Error);
			}
			this._oViewModel.setProperty("/busy", false);
		},
		_checkSNisNotExist: function(sSerialNum) {
			var aItems = this._oAddTable.getItems();
			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getBindingContext("addData").getObject().Serialno === sSerialNum) {
					this._oViewModel.setProperty("/snValueState", sap.ui.core.ValueState.Error);
					MessageBox.error(this.getResourceBundle().getText("snAlreadyExist", [sSerialNum]));
					return false;
				}
			}
			if (this._getItemProperty("Serialno") === sSerialNum) {
				this._oViewModel.setProperty("/snValueState", sap.ui.core.ValueState.Error);
				MessageBox.error(this.getResourceBundle().getText("snAlreadyExist", [sSerialNum]));
				return false;
			}
			return true;
		},
		_getItemProperty: function(sPropertyName) {
			var aItems = this._oLineTable.getItems();
			for (var i = 0; aItems.length; i++) {
				if (aItems[i].getMetadata().getName() === "sap.m.ColumnListItem") {
					return aItems[i].getBindingContext().getObject(sPropertyName);
				}
			}
		},
		checkReturnPossible: function() {
			//Sprawdz czy istnieje jakiś zaznaczony element na view i mozna zrobic zwrot
			var oTable = this.byId("PROD_TBL");
			var aItems = oTable.getItems();
			var iRetAmount = 0,
				bEnabled = false,
				iItemQuan, oObject;
			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
					if (aItems[i].getSelected() === true) {
						bEnabled = true;
						oObject = aItems[i].getBindingContext().getObject();
						if (!oObject.ParentMaterial) {
							//iItemQuan = parseInt(aItems[i].getCells()[2].getValue(), 10); //QuantityInput
							iItemQuan = parseInt(oObject.AppQty, 10); //CR101 change startmj{}
							iRetAmount = parseFloat(iRetAmount) +
								//(iItemQuan * (parseFloat(oObject.BruttoValue) / parseFloat(oObject.PoQuan)));
								(iItemQuan * (parseFloat(oObject.BruttoValue) / parseFloat(oObject.AppQty))); //CR101 change startmj{}
						}
					}
				}
			}
			if (bEnabled) {
				this._oViewModel.setProperty("/createEnable", bEnabled);
				this._oViewModel.setProperty("/returnAmount", parseFloat(iRetAmount));
				return;
			} else {
				this._oViewModel.setProperty("/returnAmount", parseFloat(0));
				this._oViewModel.setProperty("/createEnable", bEnabled);
			}
		},
		onCustomerSubmit: function(oEvent) {
			this._customerData = oEvent.getSource().getParent().getContent()[0].getModel("customer").getData();
			var bPass = this._checkCustomerData(this._customerData);
			if (bPass === false) {
				return;
			}
			this._callCreateReturnFunction();
		},
		onCloseDialog: function() {
			this._oCustDialog.close();
		},
		onScanerAction: function(oEvent) {
			this._selectItemFromScaner(oEvent);
		},
		onRowSelected: function(oEvent) {
			var oTable = this.byId("PROD_TBL");
			var aItems = oTable.getItems();
			var sParentMaterial = oEvent.getParameter("listItem").getBindingContext().getObject().ParentMaterial;
			var sInvoice = oEvent.getParameter("listItem").getBindingContext().getObject().Invoice;
			var sMaterial = oEvent.getParameter("listItem").getBindingContext().getObject().Material;
			var sRefItmNumber = oEvent.getParameter("listItem").getBindingContext().getObject().RefItmNumber;
			var sSalesDoc = oEvent.getParameter("listItem").getBindingContext().getObject().SalesDoc;
			var sSerialno = oEvent.getParameter("listItem").getBindingContext().getObject().Serialno;
			var sReturnNotAllowedZfdate = oEvent.getParameter("listItem").getBindingContext().getObject().ReturNotAllowedZfdate; //P2S-PROJ-SD: [CR_P2S_322] Blokada kor. faktur po upływie 25m startmj{}

			var sQty;
			//ktory checkbox byl nacisniety
			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
					var oItemData = aItems[i].getBindingContext().getObject();
					if (oItemData.ParentMaterial === sParentMaterial && oItemData.RefItmNumber === sRefItmNumber && oItemData.Material === sMaterial &&
						oItemData.Serialno === sSerialno) {
						var selectedIndex = i;
						this._justSelected = aItems[i];
						this._justSelectedNS = sSerialno; //PBI000000185547 startmj{}
						var isSelected = aItems[i].getSelected();
					} else {
						continue;
					}
				}
			};
			//czy istnieje jakis podrzedny material dla kliknietego materialu
			var openWindowFlag = false;
			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
					var oItemData = aItems[i].getBindingContext().getObject();
					if (oItemData.ParentMaterial === sMaterial && oItemData.RefItmNumber === sRefItmNumber) {
						var openListFlag = true;
					}
				}
			};
			//CR101 startmj{
			//			//P2S-PROJ-SD: [CR_P2S_322] Blokada kor. faktur po upływie 25m startmj{
						if (isSelected && sReturnNotAllowedZfdate === 'X' ) {
							MessageBox.error(this.getResourceBundle().getText("unableReturnZfdate"), {
									styleClass: this.getOwnerComponent().getContentDensityClass() }); 		
							for (var i = 0; i < aItems.length; i++) {
								if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
									var oItemData = aItems[i].getBindingContext().getObject();
								if (oItemData.ParentMaterial === sParentMaterial && oItemData.RefItmNumber === sRefItmNumber && oItemData.Material === sMaterial &&
									oItemData.Serialno === sSerialno) {
										aItems[i].setSelected(false);
									}
								}
							};	
						//}
									
						} else if (isSelected && openListFlag === true) {
				// if (isSelected && openListFlag === true) {
				//wywolanie view
				if (!this._oDialog) {
					// create dialog via fragment factory
					this._oDialog = sap.ui.xmlfragment("cre.ret.app.view.Dialog", this);
					// connect dialog to view (models, lifecycle)
					this.getView().addDependent(this._oDialog);
					$.sap.syncStyleClass(this.getOwnerComponent().getContentDensityClass(), this.getView(), this._oDialog);
				}
				this.onDialogDisplay(sInvoice, sMaterial, sRefItmNumber, sSalesDoc, sSerialno);
				this._oDialog.open();
				if (document.querySelector('#DialogID-ok-content')) {
					var confirmButtonCaption = this.getView().getModel("i18n").getResourceBundle().getText("confirmButton");
					document.querySelector('#DialogID-ok-content').textContent = confirmButtonCaption;
					$("#DialogID-ok-content").css("font-size", "10px");
				}
				sap.ui.core.BusyIndicator.show(0)
			} else if (!isSelected && openListFlag === true) {
				//Odznaczenie tylko tych materiałów które były zaznaczone dla ParentMaterial = Material SN startmj { 
				for (var i = 0; i < aItems.length; i++) {
					if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
						var oItemData = aItems[i].getBindingContext().getObject();
						var sPath = aItems[i].getBindingContext().sPath; //fiori upgrade startmj{}
						if (oItemData.ParentMaterial === sMaterial && oItemData.RefItmNumber === sRefItmNumber) {
							if (sSerialno) {
								for (var k = 0; k < this._checkedTable.length; k++) {
									if (oItemData.ParentMaterial === this._checkedTable[k].ParentMaterial && oItemData.Material === this._checkedTable[k].Material &&
										oItemData.RefItmNumber === this._checkedTable[k].RefItmNumber && sSerialno === this._checkedTable[k].Serialno && this._checkedTable[
											k].Serialno === oItemData.Serialno) {
										if (parseInt(oItemData.AppQty) === 1) {
											//oItemData.PoQuan = oItemData.TargetQty;
											//fiori upgrade startmj{
											//oItemData.AppQty = 0;
											sQty = "0";
											aItems[i].getBindingContext().getModel().setProperty(sPath + "/AppQty", sQty); //}
											aItems[i].setSelected(false);
											this._checkedTable.splice(k, 1);
										} else if (parseInt(oItemData.AppQty) > 1) {
											//fiori upgrade startmj{
											//oItemData.AppQty = (parseInt(oItemData.AppQty) - 1).toString();
											sQty = (parseInt(oItemData.AppQty) - 1).toString();
											aItems[i].getBindingContext().getModel().setProperty(sPath + "/AppQty", sQty); //}
											this._checkedTable.splice(k, 1);
										}
									}
								}
							} else {
								for (var k = 0; k < this._checkedTable.length; k++) {
									if (oItemData.ParentMaterial === this._checkedTable[k].ParentMaterial && oItemData.Material === this._checkedTable[k].Material &&
										oItemData.RefItmNumber === this._checkedTable[k].RefItmNumber) {
										if (parseInt(oItemData.AppQty) === 1) {
											//oItemData.PoQuan = oItemData.TargetQty;
											//fiori upgrade startmj{
											//oItemData.AppQty = 0;
											sQty = "0";
											aItems[i].getBindingContext().getModel().setProperty(sPath + "/AppQty", sQty); //}
											aItems[i].setSelected(false);
											this._checkedTable.splice(k, 1);
										} else if (parseInt(oItemData.AppQty) > 1) {
											//fiori upgrade startmj{
											//oItemData.AppQty = (parseInt(oItemData.AppQty) - 1).toString();
											sQty = (parseInt(oItemData.AppQty) - 1).toString();
											aItems[i].getBindingContext().getModel().setProperty(sPath + "/AppQty", sQty); //}
											this._checkedTable.splice(k, 1);
										}
									}
								}
							}
						}
					}
				};
				oTable.updateItems();
			} else if (!isSelected) {
				for (var i = 0; i < aItems.length; i++) {
					if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
						oItemData = aItems[i].getBindingContext().getObject();
						sPath = aItems[i].getBindingContext().sPath; //fiori upgrade startmj{}          
						if (oItemData.ParentMaterial === sParentMaterial && oItemData.RefItmNumber === sRefItmNumber && oItemData.Material === sMaterial &&
							oItemData.Serialno === sSerialno) {
							//fiori upgrade startmj{}
							//oItemData.AppQty = oItemData.PoQuan;
							sQty = oItemData.PoQuan.toString();
							aItems[i].getBindingContext().getModel().setProperty(sPath + "/AppQty", sQty); //}
							oTable.updateItems();
							break;
						}
					}
				}
			}
			this.checkReturnPossible();
		},
		onDialogDisplay: function(sInvoice, sMaterial, sRefItmNumber, sSalesDoc, sSerialno) {
			var oView = this.getView();
			var dialogFragment = sap.ui.getCore().byId("DialogID-dialog");
			var oElementBinding = oView.getElementBinding();
			var oJSModel = new sap.ui.model.json.JSONModel();
			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZRETURN_CREA_SRV");
			var filter1 = new sap.ui.model.Filter({
				path: "SalesDoc",
				operator: sap.ui.model.FilterOperator.EQ,
				value1: sSalesDoc
			});
			var sRequest = "/DocumentsChild(Invoice='" + sInvoice + "',MatAndQuan='" + sMaterial + "+" + sRefItmNumber + "',SerialNums='" +
				sSerialno + "')/DocToItemChild";

			oModel.read(sRequest, {
				filters: [filter1],
				success: function(oRetrievedResult) {
					oJSModel.setData(oRetrievedResult);
					dialogFragment.setBusy(false); //P2S-MAINT-SD: [PBI*223465] App:zwroty wyszukiwarka SN startmj{}
					dialogFragment.setModel(oJSModel, "myModel");
					sap.ui.core.BusyIndicator.hide();
				},
				error: function(oError) {
					dialogFragment.setBusy(false); //P2S-MAINT-SD: [PBI*223465] App:zwroty wyszukiwarka SN startmj{}
					console.log(oError);
				}
			});

			dialogFragment.setModel(oJSModel, "myModel");

			//P2S-MAINT-SD: [PBI*223465] App:zwroty wyszukiwarka SN startmj{}
			dialogFragment.setBusyIndicatorDelay(100);
			dialogFragment.setBusy(true); //}

			console.log(this.getView());
		},
		//CR101 startmj{
		_configDialog: function(oButton) {
			// Multi-select if required
			var bMultiSelect = !!oButton.data("multi");
			this._oDialog.setMultiSelect(bMultiSelect);
			var sCustomConfirmButtonText = oButton.data("confirmButtonText");
			this._oDialog.setConfirmButtonText(sCustomConfirmButtonText);
			// Remember selections if required
			var bRemember = !!oButton.data("remember");
			this._oDialog.setRememberSelections(bRemember);
			//add Clear button if needed
			var bShowClearButton = !!oButton.data("showClearButton");
			this._oDialog.setShowClearButton(bShowClearButton);
			// Set growing property
			var bGrowing = oButton.data("growing");
			this._oDialog.setGrowing(bGrowing == "true");
			// Set growing threshold
			var sGrowingThreshold = oButton.data("threshold");
			if (sGrowingThreshold) {
				this._oDialog.setGrowingThreshold(parseInt(sGrowingThreshold));
			}
			// Set draggable property
			var bDraggable = oButton.data("draggable");
			this._oDialog.setDraggable(bDraggable == "true");
			// Set draggable property
			var bResizable = oButton.data("resizable");
			this._oDialog.setResizable(bResizable == "true");
			// Set style classes
			var sResponsiveStyleClasses =
				"sapUiResponsivePadding--header sapUiResponsivePadding--subHeader sapUiResponsivePadding--content sapUiResponsivePadding--footer";
			var sResponsivePadding = oButton.data("responsivePadding");
			if (sResponsivePadding) {
				this._oDialog.addStyleClass(sResponsiveStyleClasses);
			} else {
				this._oDialog.removeStyleClass(sResponsiveStyleClasses);
			}
			// clear the old search filter
			this._oDialog.getBinding("items").filter([]);
			// toggle compact style
			syncStyleClass("sapUiSizeCompact", this.getView(), this._oDialog);
		},
		onSearch: function(oEvent) {
			var sValue = oEvent.getParameter("value");
			var oFilter = new sap.ui.model.Filter("Material", FilterOperator.Contains, sValue);

			var oBinding = oEvent.getParameter("itemsBinding");
			oBinding.filter([oFilter]);
		},

		//CR101 startmj{
		handleClose: function(oEvent) {
			var aContexts = oEvent.getParameter("selectedContexts");
			if (aContexts && aContexts.length) {
				this._markedTable = [];
				for (var i = 0; i < aContexts.length; i++) {
					var sIndex = aContexts[i].sPath.split("/")[2];
					var res = {
							Material: oEvent.getParameters().selectedContexts[i].getModel().getData().results[sIndex].Material,
							RefItmNumber: oEvent.getParameters().selectedContexts[i].getModel().getData().results[sIndex].RefItmNumber,
							ParentMaterial: oEvent.getParameters().selectedContexts[i].getModel().getData().results[sIndex].ParentMaterial,
							//Serialno: this._justSelected.getBindingContext().getObject().Serialno};
							Serialno: this._justSelectedNS
						} //PBI000000185547 startmj{}
					this._markedTable.push(res);
					this._checkedTable.push(res);
				};
				this.markParentWindow();
			}
		},

		handleCloseCancel: function(oEvent) {
			this._justSelected.setSelected(false);
		},
		markParentWindow: function() {
			//Przenies zaznaczone elementy z fragmentu na view
			var oTable = this.byId("PROD_TBL"),
				aItems = oTable.getItems();
			var sQty;
			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
					var oItemData = aItems[i].getBindingContext().getObject();
					var sPath = aItems[i].getBindingContext().sPath; //fiori upgrade startmj{}
					for (var k = 0; k < this._markedTable.length; k++) {
						if (oItemData.ParentMaterial === this._markedTable[k].ParentMaterial && oItemData.Material === this._markedTable[k].Material &&
							oItemData.RefItmNumber === this._markedTable[k].RefItmNumber && (oItemData.Serialno === this._markedTable[k].Serialno || !this._markedTable[
								k].Serialno)) {
							if (aItems[i].getSelected() === true) {
								//fiori upgrade startmj{
								//oItemData.AppQty =  (parseInt(oItemData.AppQty) + 1).toString();                                    
								sQty = (parseInt(oItemData.AppQty) + 1).toString();
								aItems[i].getBindingContext().getModel().setProperty(sPath + "/AppQty", sQty); //}
							} else {
								aItems[i].setSelected(true);
								//fiori upgrade startmj{
								//oItemData.AppQty = 1;
								sQty = "1";
								aItems[i].getBindingContext().getModel().setProperty(sPath + "/AppQty", sQty); //}
							}
						}
					}
				}
			};
			oTable.updateItems();
			this.checkReturnPossible();
		},
		onMessageButtonPressed: function(oEvent) {
			var oMessagesButton = oEvent.getSource();
			if (!this._oMsgPopover) {
				this._oMsgPopover = sap.ui.xmlfragment("cre.ret.app.view.MessagePopover", this.getView().getController());
				oMessagesButton.addDependent(this._oMsgPopover);
				$.sap.syncStyleClass(this.getOwnerComponent().getContentDensityClass(), this.getView(), this._oMsgPopover);
			}
			this._oMsgPopover.toggle(oMessagesButton);
		},
		onShopSelect: function() {
			try { // P2S-MAINT-SD: [PBI*199006] App: Zwroty znika pole zakład {
				this._oWorklistDialog = this.getRouter().getView("cre.ret.app.view.Worklist").getController()._oDialog;
			} catch (e) {}
			if (!this._oDialog && !this._oWorklistDialog) {
				// create dialog via fragment factory
				this._oDialog = sap.ui.xmlfragment("cre.ret.app.view.SelectShop", this);
				// connect dialog to view (models, lifecycle)
				this.getView().addDependent(this._oDialog);
			}
			this._oDialog = this._oDialog || this._oWorklistDialog;
			$.sap.syncStyleClass(this.getOwnerComponent().getContentDensityClass(), this.getView(), this._oDialog);
			this._oDialog.open();
		},
		onCloseSelectShop: function() {
			this._oDialog.close();
		},
		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */
		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {sap.ui.base.Event} oEvent pattern match event in route 'object'
		 * @private
		 */
		_onObjectMatched: function(oEvent) {
			var sObjectId = oEvent.getParameter("arguments").objectId;
			this._oModel.metadataLoaded().then(function() {
				var sObjectPath = this.getModel().createKey("Documents", {
					Invoice: sObjectId
				});
				this._bindView("/" + sObjectPath);
			}.bind(this));
			this._checkedTable = [];
		},
		/**
		 * Binds the view to the object path.
		 * @function
		 * @param {string} sObjectPath path to the object to be bound
		 * @private
		 */
		_bindView: function(sObjectPath) {
			var oViewModel = this.getModel("objectView"),
				oDataModel = this.getModel();
			this.getView().bindElement({
				path: sObjectPath,
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function() {
						oDataModel.metadataLoaded().then(function() {
							oViewModel.setProperty("/busy", true);
						});
					},
					dataReceived: function() {
						oViewModel.setProperty("/busy", false);
					}
				}
			});
		},
		_onBindingChange: function() {
			var oView = this.getView(),
				oElementBinding = oView.getElementBinding(),
				oLineItemsTemplate,
				aFilters = [];
			if (this.oTemplate) {
				oLineItemsTemplate = this.oTemplate.clone();
			} else {
				oLineItemsTemplate = new sap.ui.xmlfragment("cre.ret.app.view.LineItemTemplate", this);
			}
			// No data for the binding
			if (!oElementBinding.getBoundContext()) {
				this.getRouter().getTargets().display("objectNotFound");
				return;
			}
			if (oElementBinding.getBoundContext().getObject().InvoiceIsExt === true) {
				if (oElementBinding.getBoundContext().getObject().SerialNums) {
					aFilters.push(new sap.ui.model.Filter("Serialno", sap.ui.model.FilterOperator.EQ,
						oElementBinding.getBoundContext().getObject().SerialNums));
				}
			} else if (oElementBinding.getBoundContext().getObject().NoSapInvoice === true) {
				aFilters.push(new sap.ui.model.Filter("SalesDoc", sap.ui.model.FilterOperator.EQ,
					oElementBinding.getBoundContext().getObject().SalesDoc));
			} else {
				aFilters.push(new sap.ui.model.Filter("SalesDoc", sap.ui.model.FilterOperator.EQ,
					oElementBinding.getBoundContext().getObject().SalesDoc));
			}
			var fnSetCreateEnabled = function(oTable) {
				this._setCreateEnabled(oTable);
			}.bind(this);
			if (sap.ui.getCore().getMessageManager().getMessageModel().getData().length > 0) {
				sap.ui.getCore().getMessageManager().removeAllMessages();
			}
			this._oLineTable.bindItems({
				path: oElementBinding.sPath + "/DocToItem",
				sorter: new sap.ui.model.Sorter("ItmNumber", true, true),
				filters: aFilters,
				template: oLineItemsTemplate
			});
			this._oLineTable._getSelectAllCheckbox().attachSelect(function(oEvent) {
				fnSetCreateEnabled(oEvent.getSource().getParent());
			});
			this._oLineTable.attachUpdateFinished(function(oEvent) {
				if (oEvent.getSource().getItems()[1]) {
					var oData = oEvent.getSource().getItems()[1].getBindingContext().getObject(),
						oCustomerModelData = this.formatter._setInitialCustomerData(oData);
					this.getModel("customer").setData(oCustomerModelData.getData());
				}
				this._setReturnStatus(oEvent.getSource().getItems());
			}.bind(this));
			// Everything went fine.
			this._oViewModel.setProperty("/busy", false);
			this._oViewModel.setProperty("/returnAmount", "0.00");
			this._oViewModel.setProperty("/isReturnable", oElementBinding.getBoundContext().getObject().IsReturnable);

			// 19.12.2018 PSy Old flow -> 2 orders -> Show message "Unable to return"
			if (!this._oViewModel.getProperty("/isReturnable")) {
				//P2S-PROJ-SD:[CR_P2S_254] Zablokowanie zrotow z IFS {
				if (oElementBinding.getBoundContext().getObject().DocType === 'ZIFS') {
					MessageBox.error(this.getResourceBundle().getText("unableReturnIFSblock"), {
						styleClass: this.getOwnerComponent().getContentDensityClass()
					});
				} else { //}
					MessageBox.error(this.getResourceBundle().getText("unableReturn2SOExists"), {
						styleClass: this.getOwnerComponent().getContentDensityClass()
					});
				}
			}

			// P2S-MAINT-SD: [PBI*199006] App: Zwroty znika pole zakład {
			if (!this.getModel("appView").getProperty("/Shop")) {
				var oModel = this.getOwnerComponent().getModel("CheckOut");
				oModel.read("/UserDefaultsSet(Name='')", {
					success: function(oSucData, response) {
						this.getModel("appView").setProperty("/Shop", response.data.Shop);
					}.bind(this),
					error: function(oError) {}.bind(this)
				});
			} //}

		},
		_checkCustomerData: function(oCustomer) {
			var oBundle = this.getResourceBundle(),
				oData = this.getView().getBindingContext().getObject();
			var fnShowMsg = function(vMessage) {
				MessageBox.error(vMessage, {
					styleClass: this.getOwnerComponent().getContentDensityClass()
				});
			}.bind(this);
			oData.DispMethod = oData.IsDisposition ? this._oViewModel.getProperty("/dispMethod") : "";
			var aVariables = validation._validateCustomerData(oCustomer, oData, oBundle);
			if (oData.hasOwnProperty("DispMethod")) {
				delete oData.DispMethod;
			}
			if (oData.hasOwnProperty("OpenReturnDoc")) {
				delete oData.OpenReturnDoc;
			}
			if (oData.hasOwnProperty("ReturnStatus")) {
				delete oData.ReturnStatus;
			}
			if (oCustomer.PostlCod1) {
				if (!this._validateZipCode()) {
					aVariables.push(oBundle.getText("PostCodeValidate"));
				}
			}
			var iVars = aVariables.length;
			if (iVars > 0) {
				var sMessage = this.getResourceBundle().getText("LACK_OF_CUST_DATA_" + iVars, aVariables);
				fnShowMsg(sMessage);
				return false;
			}
			return true;
		},
		_reasonChange: function(oSelectedItem) {
			var oItem = oSelectedItem.getParameter("selectedItem"),
				oAddModel = this.getModel("addData"),
				sPath = oItem.getParent().getBindingContext().getPath(),
				sRetReason = oItem.getKey(),
				oData = oAddModel.getProperty(sPath);
			if (!oData) {
				oData = {
					RetReason: sRetReason
				};
			} else {
				oData.RetReason = sRetReason;
			}
			oSelectedItem.getSource().setValueState(sap.ui.core.ValueState.None);
			oAddModel.setProperty(sPath, oData);
			if (!oAddModel.getProperty(sPath)) {
				oAddModel.setData({});
				oAddModel.setProperty(sPath, oData);
			}
		},
		_handleSaveShop: function(oEvent) {
			var sPath = oEvent.getSource().getParent().getContent()[0].getSelectedItem().getBindingContextPath(),
				oCheckModel = this.getView().getModel("CheckOut"),
				oShopData = oCheckModel.getData(sPath);
			if (oShopData.Selected !== true) {
				oShopData.Selected = true;
				oCheckModel.update(sPath, oShopData, {
					async: false,
					success: function(oData, response) {
						var sShop = response.headers.shop,
							bBlocked = response.headers.blocked === "X",
							sMsg = this.getResourceBundle().getText("ShopSaved", [sShop]);
						if (bBlocked) {
							this._handleBlockedShop();
						} else {
							this.getModel("appView").setProperty("/ShopAvailable", true);
							this.getModel("appView").setProperty("/Shop", sShop);
							sap.m.MessageToast.show(sMsg);
						}

					}.bind(this),
					error: function(oError) {
						ErrProcessor.showODataError(oError, this.getOwnerComponent());
					}.bind(this)
				});
			}
			this._oDialog.close();
		},
		_handleBlockedShop: function() {
			var sMsg = this.getResourceBundle().getText("ShopBlocked");
			this.getModel("appView").setProperty("/ShopAvailable", false);
			this.getRouter().navTo("worklist", {}, true);
			sap.m.MessageBox.error(sMsg, {
				actions: [MessageBox.Action.CLOSE],
				onClose: function() {
					this.getRouter().navTo("worklist", {}, true);
				}.bind(this)
			});
		},
		_setTableLinesUnenabled: function(oTable) {
			var aItems = oTable.getItems();
			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
					var oData = aItems[i].getBindingContext().getObject();
					if (oData) {
						if (oData.ReturnDoc || oData.ReturnNotAllowed === true) {
							aItems[i]._oMultiSelectControl.setEnabled(false);
							oTable._getSelectAllCheckbox().setEnabled(false);
						} else if (oData.ReturnNotAllowedZtad === true) {
							aItems[i]._oMultiSelectControl.setEnabled(false);
							oTable._getSelectAllCheckbox().setEnabled(false);
						} //startmj{}
						else if (oData.ParentMaterial) {
							aItems[i]._oMultiSelectControl.setEnabled(false); //}
						} else {
							aItems[i]._oMultiSelectControl.setEnabled(true);
						}
					}
				}
			}
		},
		_setCreateEnabled: function(oTable, sParentMaterial) {
			var aItems = oTable.getItems(),
				iRetAmount = 0,
				bEnabled = false,
				iItemQuan, oObject;
			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
					if (aItems[i].getSelected() === true) {
						oObject = aItems[i].getBindingContext().getObject();
						if (!oObject.ParentMaterial) {
							iItemQuan = parseInt(aItems[i].getCells()[3].getValue(), 10); //QuantityInput
							iRetAmount = parseFloat(iRetAmount) +
								(iItemQuan * (parseFloat(oObject.BruttoValue) / parseFloat(oObject.AppQty)));
						}
						if (!sParentMaterial) {
							validation._checkProductSet(aItems, oObject.Material, oObject.RefItmNumber);
						}
						bEnabled = true;
					}
				}
			}
			if (bEnabled) {
				this._oViewModel.setProperty("/createEnable", bEnabled);
				this._oViewModel.setProperty("/returnAmount", parseFloat(iRetAmount));
				return;
			} else {
				this._oViewModel.setProperty("/returnAmount", parseFloat(0));
				this._oViewModel.setProperty("/createEnable", bEnabled);
			}
		},
		_callCreateReturnFunction: function() {
			// Begin PSy 29.01.2018
			// Clear global data first
			this.oHeaderData = this.aDocToItems = undefined;
			// Get selected items and fill header
			this._getSelectedData();
			// End PSy 29.01.2018
			var fnSuccess = function(oResponse) {
				this._fnUpdateSuccess(oResponse);
			}.bind(this);
			var fnError = function(oError) {
				this._fnEntityCreationFailed(oError);
			}.bind(this);
			if (this.oHeaderData && this.aDocToItems) {
				var oDeepData = formatter._fillDeepData(this.oHeaderData, this.aDocToItems);
				if (oDeepData) {
					this._oViewModel.setProperty("/busy", true);
					Utilities.createReturn(oDeepData, fnSuccess, fnError);
				}
			}
		},
		_getSelectedData: function() {
			var aSelectedItems = this._oLineTable.getSelectedItems(),
				aAllItems = this._oLineTable.getItems(),
				aAddItems = this._oAddTable.getItems();
			for (var i = 0; i < aSelectedItems.length; i++) {
				this._createEntity(aSelectedItems[i]);
			}
			aAllItems.forEach(function(oItem) {
				if (oItem.getBindingContext() && oItem.getBindingContext().getObject().ReturnNotAllowedZtad === true) {
					this._createEntity(oItem);
				}
			}.bind(this));
			if (aAddItems) {
				for (i = 0; i < aAddItems.length; i++) {
					this._createEntity(aAddItems[i], "addData");
				}
			}
		},
		_createEntity: function(oItem, sModelName) {
			var oData = oItem.getBindingContext(sModelName).getObject(),
				sPath = oItem.getBindingContext(sModelName).getPath(),
				oObject = this.getView().getBindingContext().getObject(),
				sCustNum = oObject.CustNum,
				sNIP = oObject.Taxnumber1,
				bInvExt = oObject.InvoiceIsExt,
				oViewModel = this._oViewModel;
			if (!oData.Serialno) {
				if (parseInt(oData.TargetQty, 10) === 1 && !oItem.getCells()[3].getEnabled()) {
					//oData.TargetQty = this.formatter._formatTargetQuantity(0);
				} else {
					//PBI000000187860 -czesciowy zwrot FIORI nieser startmj{
					//var sRetQuan = (oData.PoQuan - this.formatter._formatTargetQuantity(oItem.getCells()[2].getValue()));
					//oData.TargetQty = parseFloat(sRetQuan).toFixed(3);
					oData.AppQty = parseFloat(this.formatter._formatTargetQuantity(oItem.getCells()[3].getValue())).toFixed(3); //}
				}
			} else {
				//oData.TargetQty = this.formatter._formatTargetQuantity(0);
			}
			oData = this._fillDataFromAddModel(oData, sPath);
			oData.Werks = this.getModel("appView").getProperty("/Shop");
			//      if()this._oViewModel.getProperty("/dispoItemZlsch")
			//      this._oViewModel.getProperty("/zlsch");
			oData.Zlsch = Utilities.setPaymentMethodForItem(oViewModel, oData);
			//  Begin: Add return reason on position 20.60.2018
			oData.RetReason = this.getModel("addData").getProperty("/RetReason");
			//  End: Add return reason on position 20.60.2018
			/* 16.03.2018 SYNIAPAV We call create customer data each time, no need to check CustNum, Nip, Extearnal flag
			      if (!sCustNum || !sNIP || bInvExt === true) { */
			oData = this._fillCustomerInfo(oData);
			/*      }
			End of 16.03.2018 SYNIAPAV */
			if (!this.oHeaderData) {
				oObject.IsDisposition = oViewModel.getProperty("/disposition");
				oObject.Zlsch = oObject.IsDisposition ? oViewModel.getProperty("/dispMethod") : oViewModel.getProperty("/zlsch");
				this.oHeaderData = oObject;
			}
			if (!this.aDocToItems) {
				this.aDocToItems = [];
			}
			this.aDocToItems.push(oData);
			return true;
		},
		_fillDataFromAddModel: function(oData, sPath) {
			//      var oAddData = this.getModel("addData").getProperty(sPath);
			var oAddData = this.getModel("addData").getData();
			if (oData.ReturnNotAllowedZtad === true) {
				oData.RetReason = "";
				oData.Zlsch = "W";
			} else {
				if (!oData.ParentMaterial) {
					this.sRetReason = oAddData.RetReason; // 20.06.2018
					this.sPmntMeth = oAddData.Zlsch;
				}
				oData.RetReason = this.sRetReason;
				oData.Zlsch = this.Zlsch;
			}
			return oData;
		},
		_fillCustomerInfo: function(oData) {
			var oCustomerData = this._customerData;
			if (oCustomerData) {
				var oFilledDataObject = this.formatter.fillObject(oData, oCustomerData);
			} else {
				return oData;
			}
			return oFilledDataObject;
		},
		_changeQty: function(oEvent) {
			var sValue = oEvent.getParameter("value");
			if (sValue) {
				var iQuan = parseInt(sValue, 10),
					iPoQuan = parseInt(oEvent.getSource().getBindingContext().getObject().PoQuan, 10),
					aItems = this._oLineTable.getSelectedItems();
				if (iQuan !== 0 && iQuan <= iPoQuan && aItems.length >= 1) {
					//PBI000000187860 -czesciowy zwrot FIORI nieser startmj{
					//oEvent.getSource().getBindingContext().getObject().PoQuan = iQuan.toString();
					oEvent.getSource().getBindingContext().getObject().AppQty = iQuan.toString(); //} 
					this.byId("PROD_TBL").updateItems();
					oEvent.getSource().setValueState("None");
					this._setCreateEnabled(this._oLineTable);
					this._oViewModel.setProperty("/createEnable", true);
					return;
				} else if (iQuan < iPoQuan && aItems.length < 1) {
					//PBI000000187860 -czesciowy zwrot FIORI nieser startmj{
					//oEvent.getSource().getBindingContext().getObject().PoQuan = iQuan.toString();
					oEvent.getSource().getBindingContext().getObject().AppQty = iQuan.toString(); //}
					this.byId("PROD_TBL").updateItems();
					oEvent.getSource().setValueState("None");
					this._oViewModel.setProperty("/createEnable", false);
					return;
				}
				oEvent.getSource().setValueState("Error");
				this._oViewModel.setProperty("/createEnable", false);
			} else {
				oEvent.getSource().setValueState("Error");
				this._oViewModel.setProperty("/createEnable", false);
			}
		},
		_beforeNav: function() {
			this._oLineTable._getSelectAllCheckbox().setEnabled(true);
			this._oLineTable.removeSelections();
			this.oTemplate = this._oLineTable.getBindingInfo("items").template;
			this._oViewModel.setProperty("/createEnable", false);
			this._oViewModel.setProperty("/addReturnAmount", formatter._calculateAddPrice(this._oAddTable.getItems()));
			this.getModel("customer").setData({});
			this.getModel("addData").setData({});
			this._oViewModel.setProperty("/addItems", 0);
		},
		onExit: function() {
			this._oLineTable.removeSelections();
		},
		_callCreateCustomerData: function() {
			var oView = this.getView(),
				oData = this._oLineTable.getItems()[1].getBindingContext().getObject(),
				oCustomerModelData = this.formatter._setInitialCustomerData(oData);
			this._oViewModel.setProperty("/bussinessClient", oData.Taxnumber1 ? true : false);
			if (!this._oCustDialog) {
				this._oCustDialog = sap.ui.xmlfragment(oView.getId(), "cre.ret.app.view.AddCustomer", oView.getController());
				this._oCustDialog.addStyleClass(this.getOwnerComponent().getContentDensityClass());
				oView.addDependent(this._oCustDialog);
				$.sap.syncStyleClass(this.getOwnerComponent().getContentDensityClass(), this.getView(), this._oCustDialog);
			}
			this._oCustDialog.attachEventOnce("afterOpen", function() {
				if (!this.getModel("customer").getData()) {
					this.getModel("customer").setData(oCustomerModelData.getData());
				}
				this._validateSubmitEnablement();
			}.bind(this));
			if (this.getView().getBindingContext().getObject().InvoiceIsExt === true) {
				this._oViewModel.setProperty("/enableSubmit", false);
				this._oViewModel.setProperty("/requiredData", sap.ui.core.ValueState.Warning);
			} else {
				this._oViewModel.setProperty("/enableSubmit", true);
				this._oViewModel.setProperty("/requiredData", sap.ui.core.ValueState.None);
			}
			this._oCustDialog.open();
		},
		_selectItemFromScaner: function(oEvent) {
			var aItems = this._oLineTable.getItems(),
				sValue = oEvent.getParameter("value"),
				sStyleClass = this.getOwnerComponent().getContentDensityClass();
			this._justSelectedNS = sValue; //PBI000000185547 startmj{}
			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
					var oData = aItems[i].getBindingContext().getObject(),
						sSerialNum = oData.Serialno,
						sRetDoc = oData.ReturnDoc,
						sReturnNotAllowed = oData.ReturnNotAllowed;
					// 10.04.2019 AWi: Check only if serial numer is not initial (do not check unserialized position)
					if (sSerialNum && sSerialNum.trim !== "") {

						//P2S-MAINT-SD: [PBI*223465] App:zwroty wyszukiwarka SN startmj{
						// zmiana miejsca sprawdzenia dla pól sRetDoc i sReturnNotAllowed

						// 08.01.2019 AWi: Added condition to check serial number
						//          if ((sRetDoc || sReturnNotAllowed === true) && sSerialNum !== "" && sSerialNum === sValue.trim()) {
						// 25.03.2019 AWi: Removed check by serial number, serial number verification below
						//if (sRetDoc || sReturnNotAllowed) {
						//	sap.m.MessageBox.warning(
						//		this.getResourceBundle().getText("SCAN_UNABLE"), {
						//		styleClass: sStyleClass
						//	}
						//);
						//oEvent.getSource().setValue();
						//return;
						//} else if (sSerialNum === sValue.trim()) {
						if (sSerialNum === sValue.trim()) {
							if (sRetDoc || sReturnNotAllowed) {
								sap.m.MessageBox.warning(
									this.getResourceBundle().getText("SCAN_UNABLE"), {
										styleClass: sStyleClass
									}
								);
								oEvent.getSource().setValue();
								return;
							} //}

							aItems[i].setSelected(true);
							this._justSelected = aItems[i]; //PBI000000189929 startmj{}
							//PBI000000187799 wyszukiwarka SN startmj{
							//czy istnieje jakis podrzedny material dla kliknietego materialu
							var openWindowFlag = false;
							for (var i = 0; i < aItems.length; i++) {
								if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
									var oItemData = aItems[i].getBindingContext().getObject();
									if (oItemData.ParentMaterial === oData.Material && oItemData.RefItmNumber === oData.RefItmNumber) {
										var openWindowFlag = true;
										break;
									}
								}
							}
							//Odznaczenie tylko tych materiałów które były zaznaczone dla ParentMaterial = Material SN startmj { 
							for (var i = 0; i < aItems.length; i++) {
								if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
									var oItemData = aItems[i].getBindingContext().getObject();
									if (oItemData.ParentMaterial === oData.Material && oItemData.RefItmNumber === oData.RefItmNumber) {
										if (oData.Serialno) {
											for (var k = 0; k < this._checkedTable.length; k++) {
												if (oItemData.ParentMaterial === this._checkedTable[k].ParentMaterial && oItemData.Material === this._checkedTable[k].Material &&
													oItemData.RefItmNumber === this._checkedTable[k].RefItmNumber && oData.Serialno === this._checkedTable[k].Serialno) {
													if (parseInt(oItemData.AppQty) === 1) {
														//oItemData.PoQuan = oItemData.TargetQty;
														oItemData.AppQty = 0;
														aItems[i].setSelected(false);
														this._checkedTable.splice(k, 1);
													} else if (parseInt(oItemData.AppQty) > 1) {
														oItemData.AppQty = (parseInt(oItemData.AppQty) - 1).toString();
														this._checkedTable.splice(k, 1);
													}
												}
											}
										}
									}
								}
							}
							var oTable = this.byId("PROD_TBL");
							oTable.updateItems();

							if (openWindowFlag === true) {
								if (!this._oDialog) {
									// create dialog via fragment factory
									this._oDialog = sap.ui.xmlfragment("cre.ret.app.view.Dialog", this);
									// connect dialog to view (models, lifecycle)
									this.getView().addDependent(this._oDialog);
									$.sap.syncStyleClass(this.getOwnerComponent().getContentDensityClass(), this.getView(), this._oDialog);
								}
								this.onDialogDisplay(oData.Invoice, oData.Material, oData.RefItmNumber, oData.SalesDoc, oData.Serialno);
								this._oDialog.open();
								if (document.querySelector('#DialogID-ok-content')) {
									var confirmButtonCaption = this.getView().getModel("i18n").getResourceBundle().getText("confirmButton");
									document.querySelector('#DialogID-ok-content').textContent = confirmButtonCaption;
									$("#DialogID-ok-content").css("font-size", "10px");
								}
							} //}
							//this._setCreateEnabled(aItems[i].getParent());
							oEvent.getSource().setValue(); //PBI000000189929 startmj{}
							return;
						}
					}
				}
			}
			sap.m.MessageBox.warning(
				this.getResourceBundle().getText("PROD_UNABLE", [sValue]), {
					styleClass: sStyleClass
				}
			);
			oEvent.getSource().setValue();
		},
		_validateSubmitEnablement: function() {
			var aInputControls = this.formatter._getFromFields(this.byId("customerData")),
				oViewModel = this._oViewModel;
			if (this.getView().getBindingContext().getObject().InvoiceIsExt === true) {
				aInputControls[8].required = true; //City
				aInputControls[7].required = true; //PostalCode
			}
			var oControl;
			for (var m = 0; m < aInputControls.length; m++) {
				oControl = aInputControls[m].control;
				if (aInputControls[m].required) {
					var sValue = oControl.getValue();
					if (!sValue) {
						oViewModel.setProperty("/enableSubmit", false);
						return;
					}
				}
			}
			this._checkForErrorMessages(oViewModel);
			this._checkDispositionPrint(oViewModel);
		},
		_checkForErrorMessages: function(oViewModel) {
			var aMessages = this._oBinding.oModel.oData;
			if (aMessages.length > 0) {
				var bEnableCreate = true;
				for (var i = 0; i < aMessages.length; i++) {
					if (aMessages[i].type === "Error" && !aMessages[i].technical) {
						bEnableCreate = false;
						break;
					}
				}
				oViewModel.setProperty("/enableSubmit", bEnableCreate);
			} else {
				oViewModel.setProperty("/enableSubmit", true);
			}
		},
		_checkDispositionPrint: function(oViewModel) {
			if (oViewModel.getProperty("/disposition")) {
				oViewModel.setProperty("/enableSubmit", oViewModel.getProperty("/dispoPrint"));
			} else {
				oViewModel.setProperty("/enableSubmit", true);
			}
		},
		_validateZipCode: function() {
			var aInputControls = this.formatter._getFromFields(this.byId("customerData")),
				oZipInput = aInputControls[7].control,
				aMaskValues = oZipInput._oTempValue._aContent,
				aInitialValues = oZipInput._oTempValue._aInitial,
				oRegExp = /^\d+$/;
			var bValid = aMaskValues.every(function(oItem, iIndex) {
				if (iIndex !== 2 && !oRegExp.test(oItem)) {
					return false;
				}
				return true;
			}, this);
			return bValid;
		},
		_countryHelpRequest: function(oEvent) {
			var oInput = oEvent.getSource();
			if (!this._oCountryDialog) {
				this._oCountryDialog = sap.ui.xmlfragment("cre.ret.app.view.Country", this);
				this._oCountryDialog.setModel(this.getView().getModel());
				// toggle style (compact / cozy)
				$.sap.syncStyleClass(this.getOwnerComponent().getContentDensityClass(), this.getView(), this._oCountryDialog);
			}
			// clear the old search filter
			this._oCountryDialog.getBinding("items").filter([]);
			this._oCountryDialog.attachEventOnce("confirm", function(oSelectEvent) {
				var sCountryKey = oSelectEvent.getParameter("selectedItem").getDescription();
				oInput.setValue(sCountryKey);
			});
			this._oCountryDialog.open();
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
		//     !!!!!!!!! W1 !!!!!!!!!!! START
		//    _printDisposition: function(sSoNum, sOwnPayment) {
		//      var oModel = new sap.ui.model.odata.ODataModel(this.getModel().sServiceUrl),
		//        sPDFPath = "/DispositionPDFSet(SoNum='" + sSoNum + "',HasOwnPayment=" + false + ")" + "/$value";
		//
		//      oModel.read(sPDFPath, {
		//        context: null,
		//        urlParameters: null,
		//        async: true,
		//        success: function(oData, oResponse) {
		//          var pdfURL = oResponse.requestUri;
		//          window.open(pdfURL);
		//          if (sOwnPayment === true){
		//            var pdfUrl2 = "/DispositionPDFSet(SoNum='" + sSoNum + "',HasOwnPayment=" + true + ")" + "/$value";
		//            this._printDispos2(oModel, pdfUrl2)
		//          }
		//        }.bind(this),
		//        error: function(oError) {
		//          ErrProcessor.showODataError(oError, this.getOwnerComponent());
		//        }.bind(this)
		//      });
		//    },
		//
		//    _printDispos2: function(oModel, sPDFPath){
		//      oModel.read(sPDFPath, {
		//        context: null,
		//        urlParameters: null,
		//        async: true,
		//        success: function(oData, oResponse) {
		//          var pdfURL = oResponse.requestUri;
		//          window.open(pdfURL);
		//        }.bind(this),
		//        error: function(oError) {
		//          ErrProcessor.showODataError(oError, this.getOwnerComponent());
		//        }.bind(this)
		//      });
		//    },
		//       !!!!!!!!! W1 !!!!!!!!!!! END
		_fnUpdateSuccess: function(oResponse) {
			var oBundle = this.getResourceBundle(),
				sCloseBtnText = oBundle.getText("close"),
				sReturnBtnText = oBundle.getText("return"),
				sMessage = oBundle.getText("EmptySuccessMsg");
			//        sPrintBtnText = oBundle.getText("disposition"); W1 !!!
			if (oResponse.data.hasOwnProperty("RtrnToMsg") && oResponse.data.RtrnToMsg.results !== undefined && oResponse.data.RtrnToMsg.results
				.length > 0) {
				var sDocNum = oResponse.data.RtrnToMsg.results[0].hasOwnProperty("ReturnDoc") ? oResponse.data.RtrnToMsg.results[0].ReturnDoc : "",
					sZnos = oResponse.data.RtrnToMsg.results[0].hasOwnProperty("Znos") ? oResponse.data.RtrnToMsg.results[0].Znos : "",
					sZnus = oResponse.data.RtrnToMsg.results[0].hasOwnProperty("Znus") ? oResponse.data.RtrnToMsg.results[0].Znus : "";
				if (sZnos) {
					sMessage = oBundle.getText("SCS_RT_MSG_NOTE", [sDocNum, sZnos]);
				} else if (sZnus) {
					sMessage = oBundle.getText("SCS_RT_MSG_NOTE_ZNUS", [sDocNum, sZnus]);
				} else {
					sMessage = oBundle.getText("SCS_RT_MSG", [sDocNum]);
				}

				//P2S-PROJ-FI: [CR_P2S_260] zwroty dla bonów za dekodery startmj{
				if (oResponse.data.RtrnToMsg.results[0].hasOwnProperty("LongText")) {
					sMessage = sMessage + " " + oResponse.data.RtrnToMsg.results[0].LongText;
				} //}

			}
			if (oResponse.data.hasOwnProperty("DocToBapi") && oResponse.data.DocToBapi.results !== undefined &&
				oResponse.data.DocToBapi.results.length > 0) {
				PopoverMessage._addMessageFromData(oResponse.data.DocToBapi.results);
			}
			//      sPrintBtnText , W1 !!!
			MessageBox.success(sMessage, {
				id: "successReturnMessageBox",
				styleClass: this.getOwnerComponent().getContentDensityClass(),
				actions: [sCloseBtnText],
				onClose: function(sAction) {
					if (sAction === sCloseBtnText) {
						this.cleanup();
						this.getRouter().navTo("worklist", {}, true);
						window.location.reload(); //PBI000000189929 startmj{}
					}
					//          this._oModel.refresh(true, false);
					// W1 !!!!!!! START
					//          else if (sAction = sPrintBtnText) {
					//            this._printDisposition(sDocNum, sOwnPayment);
					//          }
					// W1 !!!!!!! END
				}.bind(this)
			});
			this._finishAction();
			this._beforeNav();
		},
		_fnEntityCreationFailed: function(oError) {
			ErrProcessor.showODataError(oError, this.getOwnerComponent());
			this._finishAction();
		},
		_finishAction: function() {
			this._oViewModel.setProperty("/busy", false);
			this._oViewModel.setProperty("/createEnable", false);
			if (this._oCustDialog.isOpen()) {
				this._oCustDialog.close();
			}
			this.aDocToItems = [];
			this.oHeaderData = null;
		},
		_setReturnStatus: function(aPositions) {
			var iNotReturnablePositionsCount = 0,
				iDostPositions = 0,
				iOldPositions = 0,
				oDocument = this.getView().getBindingContext().getObject();
			aPositions.forEach(function(oPosition) {
				var oData = oPosition.getBindingContext().getObject();
				if ((oData.ReturnDoc || oData.ReturnNotAllowed === true) && !oData.ReturnNotAllowedMatnr) {
					iNotReturnablePositionsCount++;
				} else if (oData.NsStatus === "DOST") {
					iDostPositions++;
				} else if (oData.ReturnDocOld) {
					iOldPositions++;
				}
			});
			var iStatus = 0;

			if (iNotReturnablePositionsCount === 0) {
				iStatus = ORDER_STATUS_NO_RETURN;
			} else if (oDocument.ReturnStatus === 0) {
				iStatus = ORDER_STATUS_NO_RETURN_INFO;
			} else {
				iStatus = oDocument.ReturnStatus;
			}
			
			if (iStatus === ORDER_STATUS_NO_RETURN){
				if (iDostPositions){
					iStatus = ORDER_STATUS_DOST;
				} else if (iOldPositions){
					iStatus = ORDER_STATUS_OLD;
				}
			}
			this._oViewModel.setProperty("/returnStatus", this.getResourceBundle().getText(`DOCUMENT_STATUS${iStatus}`));
			this._oViewModel.setProperty("/returnStatusState", (iStatus === ORDER_STATUS_NO_RETURN || iStatus === ORDER_STATUS_FULLY_RETURNED) ?
				"Success" :
				(iStatus === ORDER_STATUS_NO_RETURN_INFO || iStatus === ORDER_STATUS_PARTIALLY_RETURNED || iStatus === ORDER_STATUS_DOST || iStatus === ORDER_STATUS_OLD) ? "Warning" : "Error");

		},
		cleanup: function() {
			this._oViewModel = Utilities.creeateObjectViewModel(false);
			this.setModel(this._oViewModel, "objectView");
			this.oAddSNInput = null;
			this.snAddPath = "";
			this.instQuan = "";
			this.Invoice = "";
			this.ItmNumber = "";
			this.Zzbillacc = "";
			//PBI000000187860 -czesciowy zwrot FIORI nieser startmj{
			this._markedTable = [];
			this._checkedTable = [];
			this._justSelected = "";
			this._justSelectedNS = ""; //}
		}
	});
});