sap.ui.define([
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox"
], function(JSONModel, MessageBox) {
  "use strict";

  return {

    init: function(oController) {
      this.i18nBundle = oController.getResourceBundle();
      this._styleClass = oController.getOwnerComponent().getContentDensityClass(),
        this._model = new sap.ui.model.odata.ODataModel(oController.getOwnerComponent().getModel().sServiceUrl, false);
    },

    creeateObjectViewModel: function(bBusy) {
      return new JSONModel({
        busy: bBusy,
        delay: 0,
        lineItemsTableHeader: this.i18nBundle.getText("PROD_HEADER"),
        createEnable: false,
        enableSubmit: false,
        enableAccount: false,
        requiredData: sap.ui.core.ValueState.None,
        snValueState: sap.ui.core.ValueState.None,
        returnAmount: "0.00",
        addReturnAmount: "0.00",
        possibleReturn: "0.00",
        dispoItemZlsch: "",
        zlsch: "",
        addItems: 0,
        additionalSN: "",
        enableDispoAccept: false,
        dispoPrint: false,
        disposition: false,
        pmntLevel: "MAIN",
        dispMethod: "",
        guid: "",
        pmntDialogTitle: this.i18nBundle.getText("SelectPmntMeth"),
        bussinessClient: false
      });
    },

    readPaymentMethods: function(oDeepData, fnSuccess, fnError) {
      this._model.create("/SalesItemDictionarySet", oDeepData, {
        async: true,
        success: function(oData, response) {
          if (typeof fnSuccess === "function") {
            fnSuccess(oData);
          }
        },
        error: function(oError) {
          if (typeof fnError === "function") {
            fnError(oError);
          }
        }
      });
    },

    createReturn: function(oDeepData, fnSuccess, fnError) {
      this._model.attachEventOnce("requestSent", function() {
        sap.ui.getCore().getMessageManager().removeAllMessages();
      });

      //PBI000000187860 -czesciowy zwrot FIORI nieser startmj{
      for (var i=0; i < oDeepData.DocToItem.length; i++) {
        oDeepData.DocToItem[i].PoQuan = (oDeepData.DocToItem[i].AppQty).toString();
        oDeepData.DocToItem[i].TargetQty = (parseFloat(oDeepData.DocToItem[i].TargetQty) - parseFloat(oDeepData.DocToItem[i].AppQty)).toString();
      } //}

      //oDeepData.IsDisposition = false;

      this._model.create("/Documents", oDeepData, {
        async: true,
        success: function(oData, response) {
          if (typeof fnSuccess === "function") {
            fnSuccess(response);
          }
        },
        error: function(oError) {
          if (typeof fnError === "function") {
            fnError(oError);
          }
        }
      });
    },

    createDispoPrintEntry: function(oDeepData, fnSuccess, fnError) {
      this._model.create("/TempPrint", oDeepData, {
        async: true,
        success: function(oData, response) {
          if (typeof fnSuccess === "function") {
            fnSuccess(oData, response);
          }
        },
        error: function(oError) {
          if (typeof fnError === "function") {
            fnError(oError);
          }
        }
      });
    },

    printDisposition: function(GUID, fnSuccess, fnError) {
      var oGUIDType = new sap.ui.model.odata.type.Guid();
      var sGUID = oGUIDType.parseValue(GUID, "string");
      if(!sGUID){
        MessageBox.warning(this.i18nBundle.getText("UUID_MISSING"), {
          styleClass: this._styleClass
          });
        return;
      }

      var sPath = "/DispositionPDFSet(Guid=guid'" + sGUID + "')/$value";

      this._model.read(sPath, {
        context: null,
        urlParameters: null,
        async: true,
        success: function(oData, response) {
          if (typeof fnSuccess === "function") {
            fnSuccess(response.requestUri);
          }
        },
        error: function(oError) {
          if (typeof fnError === "function") {
            fnError(oError);
          }
        }
      });
    },

    setPaymentMethodForItem: function(oViewModel, oItem){
      if(oViewModel.getProperty("/disposition")){
//        if(oItem.OwnPayment > 0){
        return oViewModel.getProperty("/dispoItemZlsch"); 
//        } else {
//          return oViewModel.getProperty("/dispMethod");
//        }
      } else {
        return oViewModel.getProperty("/zlsch");
      }
    },

    lowCashLevelWarning: function(sMessage, fnReturn, fnContinue, sMeth) {
      var sReturnBtnText = this.i18nBundle.getText("RETURN"),
        sDispoBtnText = this.i18nBundle.getText("Confirm");

      MessageBox.warning(sMessage, {
        styleClass: this._styleClass,
        actions: [sReturnBtnText, sDispoBtnText],
        onClose: function(sAction) {
          switch (sAction) {
            case sReturnBtnText:
              if (typeof fnReturn === "function") {
                fnReturn();
              }
              break;
            case sDispoBtnText:
              if (typeof fnContinue === "function") {
                fnContinue(sMeth);
              }
              break;
          }
        }
      });
    },

    lowCashLevelWarningNoRef: function(sMessage, fnReturn, fnContinue, sMeth) {
      var sReturnBtnText = this.i18nBundle.getText("RETURN"),
        sCardReturnBtnText = this.i18nBundle.getText("Confirm");

      MessageBox.warning(sMessage, {
        styleClass: this._styleClass,
        actions: [sReturnBtnText, sCardReturnBtnText],
        onClose: function(sAction) {
          switch (sAction) {
            case sReturnBtnText:
              if (typeof fnReturn === "function") {
                fnReturn();
              }
              break;
            case sCardReturnBtnText:
              if (typeof fnContinue === "function") {
                fnContinue(sMeth);
              }
              break;
          }
        }
      });
    },

    noAccountDocWarning: function(fnHandlePmntMethod) {
      var sMessage = this.i18nBundle.getText("noAccDoc");

      MessageBox.warning(sMessage, {
        styleClass: this._styleClass,
        actions: [MessageBox.Action.OK],
        onClose: function(sAction) {
            if (typeof fnHandlePmntMethod === "function") {
              fnHandlePmntMethod("8"); // 8 - Kompensata - nieopłacona FV"
            }
        }
      });
    },

    prepareParentObject: function(aItems, oModel){
      var oItem,
        aData = {};
      for(var i = 0; i < aItems.length; i++){
        oItem = oModel.getProperty(aItems[i].getBindingContextPath());
        if(oItem.Material){ // has Material property
          if(oItem.ParentMaterial === ""){ 
            if(!aData[oItem.Material]){
              aData[oItem.Material] = {Parent: oItem.Material, Quan: 1, Items: [oItem.Material], ParentName: oItem.ShortText};
            } 
          } else {
            if(!aData[oItem.ParentMaterial]){
              aData[oItem.ParentMaterial] = {
                  Parent: oItem.ParentMaterial, 
                  Quan: 1, 
                  Items: [oItem.Material] };
            } else {
              if(!aData[oItem.ParentMaterial].Items.includes(oItem.Material)){
                aData[oItem.ParentMaterial].Items.push(oItem.Material);
                aData[oItem.ParentMaterial].Quan += 1;
              }
            }
          }

        }

      }
      return aData;
    },

    prepareReturnMessage: function(aMaterials){
      var oBundle = this.i18nBundle,
        sMsg = oBundle.getText("WRN_MSG_SET"),
        oMaterial;
        for(var i = 0; i < aMaterials.length; i++){
          oMaterial = aMaterials[i];
          sMsg = sMsg + oBundle.getText("WRN_MSG_SET_POS", [oMaterial.MaterialName, oMaterial.Material, oMaterial.AllNo, oMaterial.SelectedNo]);
        }

        sMsg = sMsg + oBundle.getText("WRN_MSG_SET_VERIF");
        return sMsg;
    }

  };
});