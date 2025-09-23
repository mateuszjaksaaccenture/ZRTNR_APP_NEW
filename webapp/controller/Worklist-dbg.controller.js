sap.ui.define([
	"cre/ret/app/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"cre/ret/app/model/formatter",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/core/routing/History",
	"sap/m/MessageBox",
	"cre/ret/app/model/ErrProcessor"
], function(BaseController, JSONModel, formatter, Filter, FilterOperator, History, MessageBox, ErrProcessor) {
	"use strict";
	const STATUS_OPEN_RETURN_DOCS = 3;
	const STATUS_FULLY_RETURNED = 2;
	const STATUS_PARTIALLY_RETURNED = 1;
	const STATUS_NOT_RETURNED = 0;
	return BaseController.extend("cre.ret.app.controller.Worklist", {

		formatter: formatter,
		ErrProcessor: ErrProcessor,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		/**
		 * Called when the worklist controller is instantiated.
		 * @public
		 */
		onInit: function() {
			var oViewModel,
				iOriginalBusyDelay,
				oTable = this.byId("DOC_LIST");

			// Put down worklist table's original value for busy indicator delay,
			// so it can be restored later on. Busy handling on the table is
			// taken care of by the table itself.
			iOriginalBusyDelay = oTable.getBusyIndicatorDelay();
			this._oTable = oTable;
			this._oDocTypeList = this.byId("SELECT_SEARCH");
			// keeps the search state
			this._oTableSearchState = [];

			// Model used to manipulate control states
			oViewModel = new JSONModel({
				worklistTableTitle: this.getResourceBundle().getText("worklistTableTitle"),
				tableNoDataText: this.getResourceBundle().getText("tableNoDataText"),
				tableBusyDelay: 0,
				nipVisible: false,
				snVisible: true,
				invVisible: true,
				prodVisible: true,
				srchMaxLength: 0,
				searchResultAmount: 0
			});
			this.setModel(oViewModel, "worklistView");

			this.getOwnerComponent().getModel().metadataLoaded().then(this._onMetadataLoaded.bind(this));

			// Make sure, busy indication is showing immediately so there is no
			// break after the busy indication for loading the view's meta data is
			// ended (see promise 'oWhenMetadataIsLoaded' in AppController)
			oTable.attachEventOnce("updateFinished", function() {
				// Restore original busy indicator delay for worklist's table
				oViewModel.setProperty("/tableBusyDelay", iOriginalBusyDelay);
			});
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		/**
		 * Triggered by the table's 'updateFinished' event: after new table
		 * data is available, this handler method updates the table counter.
		 * This should only happen if the update was successful, which is
		 * why this handler is attached to 'updateFinished' and not to the
		 * table's list binding's 'dataReceived' method.
		 * @param {sap.ui.base.Event} oEvent the update finished event
		 * @public
		 */
		onUpdateFinished: function(oEvent) {
			// update the worklist's object counter after the table update
			var sTitle,
				oTable = oEvent.getSource(),
				iTotalItems = oEvent.getParameter("total");
			// only update the counter if the length is final and
			// the table is not empty
			if (iTotalItems && oTable.getBinding("items").isLengthFinal()) {
				sTitle = this.getResourceBundle().getText("worklistTableTitleCount", [iTotalItems]);

			} else {
				sTitle = this.getResourceBundle().getText("worklistTableTitle");
			}
			this.getModel("worklistView").setProperty("/searchResultAmount", iTotalItems);
			this.getModel("worklistView").setProperty("/worklistTableTitle", sTitle);
			this._checkReturnStatus(oTable);
		},

		/**
		 * Event handler when a table item gets pressed
		 * @param {sap.ui.base.Event} oEvent the table selectionChange event
		 * @public
		 */
		onItemPress: function(oEvent) {
			// The source is the list item that got pressed
			this._showObject(oEvent.getSource());
		},

		/**
		 * Event handler for navigating back.
		 * It there is a history entry or an previous app-to-app navigation we go one step back in the browser history
		 * If not, it will navigate to the shell home
		 * @public
		 */
		onNavBack: function() {
			var sPreviousHash = History.getInstance().getPreviousHash(),
				oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");

			if (sPreviousHash !== undefined || !oCrossAppNavigator.isInitialNavigation()) {
				history.go(-1);
			} else {
				oCrossAppNavigator.toExternal({
					target: {
						shellHash: "#Shell-home"
					}
				});
			}
		},

		onSearch: function(oEvent) {
			if (oEvent.getParameters().refreshButtonPressed) {
				// Search field's 'refresh' button has been pressed.
				// This is visible if you select any master list item.
				// In this case no new search is triggered, we only
				// refresh the list binding.
				this.onRefresh();
			} else {
				var sQuery = oEvent.getParameter("query"),
					sDocType = this._oDocTypeList.getSelectedItem().getKey();

				sQuery = sQuery.replace(/\s/g, '');

				if (sDocType === "VBELN_VA" || sDocType === "VBELN_VF") {
					if (sQuery.length > 10) {
						MessageBox.warning(this.getResourceBundle().getText("verifyDocLength"), {
							styleClass: this.getOwnerComponent().getContentDensityClass()
						});
						return;
					}
				}

				this._createFilter(sQuery);
			}
		},

		onShopSelect: function() {

			if (!this._oDialog) {
				// create dialog via fragment factory
				this._oDialog = sap.ui.xmlfragment("cre.ret.app.view.SelectShop", this);
				// connect dialog to view (models, lifecycle)
				this.getView().addDependent(this._oDialog);
				$.sap.syncStyleClass(this.getOwnerComponent().getContentDensityClass(), this.getView(), this._oDialog);
			}

			this._oDialog.open();
		},

		onSearchPressed: function() {
			var sQuery = this.byId("SEARCH_FIELD").getValue(),
				sDocType = this._oDocTypeList.getSelectedItem().getKey();

			if (sDocType === "VBELN_VA" || sDocType === "VBELN_VF") {
				if (sQuery.length > 10) {
					MessageBox.warning(this.getResourceBundle().getText("verifyDocLength"), {
						styleClass: this.getOwnerComponent().getContentDensityClass()
					});
					return;
				}
			}

			this._createFilter(sQuery);
		},

		onDocTypeChange: function(oEvent) {
			var sSelectedKey = oEvent.getParameter("selectedItem").getKey();

			switch (sSelectedKey) {
				case "STCD1":
					formatter.docTypeChange(this.getModel("worklistView"), sSelectedKey);
					break;
				case "ZXXSER50":
					formatter.docTypeChange(this.getModel("worklistView"), sSelectedKey);
					this._oTable.rerender();
					return;
				case "VBELN_VA":
					formatter.docTypeChange(this.getModel("worklistView"), sSelectedKey);
				default:
					formatter.docTypeChange(this.getModel("worklistView"), sSelectedKey);
			}

			this._oTable.rerender();
		},

		onCloseSelectShop: function() {
			this._oDialog.close();
		},

		onNoRefCreate: function() {
			this.getRouter().navTo("createNoRef");
		},

		/**
		 * Event handler for refresh event. Keeps filter, sort
		 * and group settings and refreshes the list binding.
		 * @public
		 */
		onRefresh: function() {
			this._oTable.getBinding("items").refresh();
		},

		/* =========================================================== */
		/* internal methods                                            */
		/* =========================================================== */

		/**
		 * Shows the selected item on the object page
		 * On phones a additional history entry is created
		 * @param {sap.m.ObjectListItem} oItem selected Item
		 * @private
		 */
		_showObject: function(oItem) {
			this.getRouter().navTo("object", {
				objectId: oItem.getBindingContext().getProperty("Invoice")
			});
		},

		_createFilter: function(sValue) {
			var oTableSearchState = [];

			var sDocType = this.byId("SELECT_SEARCH").getSelectedItem().getKey();

			if (sValue && sValue.length > 0) {
				//P2S-KSEF-SD: [KSEF_1_GAP_12]  Zmiany w apps Fiori dla eFakt startmj{
				// var sFilterOperator = (sDocType === "VBELN_VA" || sDocType === "VBELN_VF") ? FilterOperator.EQ : FilterOperator.Contains;
				var sFilterOperator = (sDocType === "VBELN_VA" || sDocType === "VBELN_VF" || sDocType === "NRKSEF") ? FilterOperator.EQ :
					FilterOperator.Contains; //}
				oTableSearchState = [
					new Filter("SrchString", sFilterOperator, sValue),
					new Filter("DocType", FilterOperator.EQ, sDocType)
				];
			}
			this._applySearch(oTableSearchState);
		},

		_onMetadataLoaded: function() {

			//startmj{
			var oModel = new sap.ui.model.odata.v2.ODataModel("/sap/opu/odata/sap/ZRETURN_CREA_SRV");
			var sRequest = "/IFSAuthSet";

			oModel.read(sRequest, {
				async: true,
				success: function(oRetrievedResult) {
					for (var i = 0; i <= oRetrievedResult.results.length - 1; i++) {
						if (oRetrievedResult.results[i].AUTH_NAME === 'IFSAuth' && oRetrievedResult.results[0].IS_AUTH === '') {
							sap.ui.getCore().byId('application-ZRTRN-create-component---worklist--createNoRef-button').setVisible(false);
						}
					}

				},
				error: function(oError) {
					console.log(oError);
				}
			}); //}

			var oModel = this.getOwnerComponent().getModel("CheckOut"),
				errorBSCS = this.getResourceBundle().getText('errorBSCS');

			oModel.setSizeLimit(1000);
			oModel.read("/UserDefaultsSet(Name='')", {
				success: function(oSucData, response) {
					this.getModel("appView").setProperty("/Shop", response.data.Shop);
					var sPath = "/ShopSet('" + response.data.Shop + "')";
					oModel.read(sPath, {
						async: true,
						success: function(oSucData, response) {

							if (response.data.Blocked) {
								this._handleBlockedShop();
								this.getModel("appView").setProperty("/ShopAvailable", false);
								sap.m.MessageBox.error(sMsg);
							} else {
								this.getModel("appView").setProperty("/ShopAvailable", true);
								if (response.data.Salid) {
									this.getModel("appView").setProperty('/Salid', response.data.Salid);
								} else {
									this.getModel("appView").setProperty('/Salid', errorBSCS);
									sap.m.MessageBox.show(errorBSCS);
								}
							}
						}.bind(this),
						error: function(oError) {
							sap.m.MessageBox.show("Error: " + oError);
						}
					});
				}.bind(this),
				error: function(oError) {
					ErrProcessor.showODataError(oError, this.getOwnerComponent());
				}.bind(this)
			});

		},

		_handleSaveShop: function(oEvent) {
			var sPath = oEvent.getSource().getParent().getContent()[0].getSelectedItem().getBindingContextPath(),
				oCheckModel = this.getView().getModel("CheckOut"),
				oShopData = oCheckModel.getData(sPath),
				errorBSCS = this.getResourceBundle().getText('errorBSCS');

			if (oShopData.Selected !== true) {
				oShopData.Selected = true;

				oCheckModel.update(sPath, oShopData, {
					async: false,
					success: function(oData, response) {
						var sShop = response.headers.shop,
							bBlocked = response.headers.blocked === "X",
							sMsg = this.getResourceBundle().getText("ShopSaved", [sShop]);
						if (bBlocked) {
							this.getModel("appView").setProperty("/Shop", sShop);
							sap.m.MessageToast.show(sMsg);
							this._handleBlockedShop();
						} else {
							this.getModel("appView").setProperty("/ShopAvailable", true);
							this.getModel("appView").setProperty("/Shop", sShop);
							this.getModel("appView").setProperty("/Salid", response.headers.bscs);
							sap.m.MessageToast.show(sMsg);
						}

					}.bind(this),
					error: function(oError) {
						this.getModel("appView").setProperty("/Salid", errorBSCS);
						ErrProcessor.showODataError(oError, this.getOwnerComponent());
					}.bind(this)

				});

			}
			//var opAmnt = parseFloat(this.getView().getModel("operations").getProperty("/NewOpAmount")).toFixed(2);
			this._oDialog.close();
			//this.createOperation(oEvent, opAmnt);
		},

		/**
		 * Internal helper method to apply both filter and search state together on the list binding
		 * @param {object} oTableSearchState an array of filters for the search
		 * @private
		 */
		_applySearch: function(oTableSearchState) {
			var oViewModel = this.getModel("worklistView");

			this.getOwnerComponent().getModel().attachEventOnce("requestFailed", function(oError) {
				try {
					var sError = JSON.parse(oError.getParameter("response").responseText).error.message.value;
					MessageBox.error(sError);
				} catch {

				}
			})

			this._oTable.getBinding("items").filter(oTableSearchState, "Application");
			// changes the noDataText of the list in case there are no filter results
			if (oTableSearchState.length !== 0) {
				oViewModel.setProperty("/tableNoDataText", this.getResourceBundle().getText("worklistNoDataWithSearchText"));
			}
		},
		_handleBlockedShop: function() {
			var sMsg = this.getResourceBundle().getText("ShopBlocked");
			this.getModel("appView").setProperty("/ShopAvailable", false);
			sap.m.MessageBox.error(sMsg);
		},
		_checkReturnStatus: function(oTable) {
			oTable.getItems().forEach(function(oItem) {
				var oCtx = oItem.getBindingContext();
				if (oCtx.getProperty("ReturnStatus") === STATUS_OPEN_RETURN_DOCS) {
					if (oCtx.getProperty("SalesDoc") === "BRAK REFERENCJI") {
						MessageBox.warning(this.getResourceBundle().getText("ORDER_RETURN_OPENED_NS", [oCtx.getProperty("SerialNums"), oCtx.getProperty(
							"OpenReturnDoc")]));
					} else {
						MessageBox.warning(this.getResourceBundle().getText("ORDER_RETURN_OPENED", [oCtx.getProperty("SalesDoc"), oCtx.getProperty(
							"OpenReturnDoc")]));
					}
				} else if (oCtx.getProperty("ReturnStatus") === STATUS_FULLY_RETURNED) {
					if (oCtx.getProperty("SalesDoc") === "BRAK REFERENCJI") {
						MessageBox.warning(this.getResourceBundle().getText("ORDER_FULLY_RETURNED_NS", [oCtx.getProperty("SerialNums")]));
					} else {
						MessageBox.warning(this.getResourceBundle().getText("ORDER_FULLY_RETURNED", [oCtx.getProperty("SalesDoc")]));
					}
					
				} else if (oCtx.getProperty("ReturnStatus") === STATUS_PARTIALLY_RETURNED) {
					MessageBox.warning(this.getResourceBundle().getText("ORDER_PARTIALLY_RETURNED", [oCtx.getProperty("SalesDoc")]));
				}

			}.bind(this));
		}
	});

});