sap.ui.define([
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox",
	"cre/ret/app/model/Utilities"
], function(JSONModel, MessageBox, Utilities) {
	"use strict";

	return {
		
		validateIBAN: function(value) {
			// Remove spaces and to upper case
			var iban = value.replace(/ /g, "").toUpperCase(),
				ibancheckdigits = "",
				leadingZeroes = true,
				cRest = "",
				cOperator = "",
				countrycode, ibancheck, charAt, cChar, bbanpattern, bbancountrypatterns, ibanregexp, i, p;

			// Check for IBAN code length.
			// It contains:
			// country code ISO 3166-1 - two letters,
			// two check digits,
			// Basic Bank Account Number (BBAN) - up to 30 chars
			var minimalIBANlength = 5;
			if (iban.length < minimalIBANlength) {
				return false;
			}

			// Check the country code and find the country specific format
			countrycode = iban.substring(0, 2);
			if (countrycode !== "PL") {
				countrycode = "PL";
				iban = countrycode.concat(iban);
			}

			bbancountrypatterns = {
				"PL": "\\d{24}"
			};

			bbanpattern = bbancountrypatterns[countrycode];

			// As new countries will start using IBAN in the
			// future, we only check if the countrycode is known.
			// This prevents false negatives, while almost all
			// false positives introduced by this, will be caught
			// by the checksum validation below anyway.
			// Strict checking should return FALSE for unknown
			// countries.
			if (typeof bbanpattern !== "undefined") {
				ibanregexp = new RegExp("^[A-Z]{2}\\d{2}" + bbanpattern + "$", "");
				if (!(ibanregexp.test(iban))) {
					return false; // Invalid country specific format
				}
			}

			// Now check the checksum, first convert to digits
			ibancheck = iban.substring(4, iban.length) + iban.substring(0, 4);
			for (i = 0; i < ibancheck.length; i++) {
				charAt = ibancheck.charAt(i);
				if (charAt !== "0") {
					leadingZeroes = false;
				}
				if (!leadingZeroes) {
					ibancheckdigits += "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(charAt);
				}
			}

			// Calculate the result of: ibancheckdigits % 97
			for (p = 0; p < ibancheckdigits.length; p++) {
				cChar = ibancheckdigits.charAt(p);
				cOperator = "" + cRest + "" + cChar;
				cRest = cOperator % 97;
			}
			return cRest === 1;
		},

		_validateCombo: function(aSelectedItems) {
			var sResult = true;

			for (var i = 0; i < aSelectedItems.length; i++) {
				var aCells = aSelectedItems[i].getCells();
				for (var m = 0; m < aCells.length; m++) {
					if (aCells[m].getMetadata().getName() === "sap.m.ComboBox" && aCells[m].getEnabled() === true) {
						if (aCells[m].getSelectedItem()) {
							if (aCells[m].getSelectedItem().getKey()) {
								aCells[m].setValueState(sap.ui.core.ValueState.None);
							} else {
								aCells[m].setValueState(sap.ui.core.ValueState.Error);
								sResult = false;
							}
						} else {
							aCells[m].setValueState(sap.ui.core.ValueState.Error);
							sResult = false;
						}
					} else if (aCells[m].getMetadata().getName() === "sap.m.Input" && aCells[m].getEnabled() === true) {
						if(aCells[m].getId().search("addSerNr") > -1){
							if(!aCells[m].getValue()){
								aCells[m].setValueState(sap.ui.core.ValueState.Error);
								sResult = false;
							} else {
								aCells[m].setValueState(sap.ui.core.ValueState.None);
							}
						} else {
							var iQuan = parseInt(aCells[m].getValue(), 10),
							iPoQuan = parseInt(aCells[m].getBindingContext().getObject().PoQuan,10);
						
						if (iQuan > iPoQuan) {
							aCells[m].setValueState(sap.ui.core.ValueState.Error);
							sResult = false;
						} else {
							aCells[m].setValueState(sap.ui.core.ValueState.None);
						}
						}
						
					}
				}
			}

			return sResult;
		},
		
		/* Validation for set to confirm incomplete return */
		_validateSet: function(aItems, aSelectedItems, oController){
			var oModel = oController.getModel(),
				oBundle = oController.getResourceBundle(),
				oAllParents = Utilities.prepareParentObject(aItems, oModel),
				oSelectedParents = Utilities.prepareParentObject(aSelectedItems, oModel),
				aMaterials = [],
				sMsg;
			
			for(var key in oSelectedParents){
				if(oAllParents[key]){
					if(oSelectedParents[key].Quan !== oAllParents[key].Quan){
						aMaterials.push({ Material: key, 
										  SelectedNo: oSelectedParents[key].Quan, 
										  AllNo: oAllParents[key].Quan,
										  MaterialName: oAllParents[key].ParentName });
					}
				}
			}
			if(aMaterials.length > 0){
				sMsg = Utilities.prepareReturnMessage(aMaterials);
				MessageBox.warning(
						sMsg, {
							actions: [oBundle.getText("Confirm"), oBundle.getText("Cancel")],
							onClose: function(oAction){
								if(oAction === oBundle.getText("Confirm")){
									oController._getPmntMethods();
								} else {
									return;
								}
								
							}
						});
				return false;
			} else {
				oController._getPmntMethods();
				return true;
			}

		},
		
		_validateIfsSet: function(aSelectedItems, aAddItems, oController){
			var oModel = oController.getModel(),
			oBundle = oController.getResourceBundle(),
			oItem,
			iInvoiceLine,
			iSelectedLines = 0,
			sMsg = oBundle.getText("WRN_MSG_SET");
			for(var i = 0; i < aSelectedItems.length; i++){
				oItem = oModel.getProperty(aSelectedItems[i].getBindingContextPath());
				if(oItem.Serialno){
					iSelectedLines++;
					iInvoiceLine = oItem.InvoiceLines;
				}
			}
			//check additional products
			if(aAddItems){
				for(var j = 0; j < aAddItems.length; j++){
					oItem = aAddItems[j];
					if(oItem.Serialno){
						iSelectedLines++;
						iInvoiceLine = oItem.InvoiceLines;
					}
				}	
			}
	
			// change to not display message if there is no invoice line [AWi 10.08.2018]
			if(iInvoiceLine !== iSelectedLines && iInvoiceLine > 0){ // selected not the same as on attribute
				sMsg = sMsg + oBundle.getText("WRG_MSG_SET_IFS", [iInvoiceLine, iSelectedLines]);
				MessageBox.warning(
						sMsg, {
							actions: [oBundle.getText("Confirm"), oBundle.getText("Cancel")],
							onClose: function(oAction){
								if(oAction === oBundle.getText("Confirm")){
									oController._getPmntMethods();
								} else {
									return;
								}
								
							}
						});
				return false;
			} else {
				return true;
			}
		},

		
		_checkProductSet: function(aItems, sParentMaterial, sRefItmNumber) {
			for (var i = 0; i < aItems.length; i++) {
				if (aItems[i].getMetadata().getElementName() !== "sap.m.GroupHeaderListItem") {
					var oItemData = aItems[i].getBindingContext().getObject();
					if (oItemData.ParentMaterial && oItemData.ParentMaterial === sParentMaterial && oItemData.RefItmNumber === sRefItmNumber) {
						aItems[i].setSelected(true);
					} else {
						continue;
					}
				}
			}

		},
		
		_validateMethodPayment: function(oView) {
			var aInputs = ["noRefName", "noRefCity", "noRefHouse", "noRefStreet", "zipCode"],
				bPass = true;
			
			for(var i = 0; i < aInputs.length; i++) {
				var sValue = oView.byId(aInputs[i]).getValue();
				if (!sValue) {
					oView.byId(aInputs[i]).setValueState(sap.ui.core.ValueState.Error);
					bPass = false;
				} else {
					oView.byId(aInputs[i]).setValueState(sap.ui.core.ValueState.None);
				}
			}
			
			return bPass;
		},

		_validatePosition: function(oControl) {
			if (oControl.getVisible()) {
				var sType = oControl.getMetadata().getElementName();

				switch (sType) {
					case "sap.m.Input":
						if (oControl.getBinding("value").sPath === "Serialno") {
							oControl.setValueState(sap.ui.core.ValueState.None);
							break;
						}

						if (!oControl.getValue()) {
							oControl.setValueState(sap.ui.core.ValueState.Error);
							return false;
						} else {
							oControl.setValueState(sap.ui.core.ValueState.None);
						}
						break;
					case "sap.m.ComboBox":
						if (!oControl.getSelectedKey() && oControl.getEnabled() === true) {
							oControl.setValueState(sap.ui.core.ValueState.Error);
							return false;
						} else {
							oControl.setValueState(sap.ui.core.ValueState.None);
						}
						break;
				}

			}
			return true;
		},
		
		_validateCustomerData: function(oCustomer, oData, oBundle){
			var aVariables = [];
			
			if (!oCustomer.Invoice && oData.NoSapInvoice === false) {
				aVariables.push(oBundle.getText("INV_ID"));
			}
			if (!oCustomer.Name) {
				aVariables.push(oBundle.getText("Name"));
			}
			if (!oCustomer.PostlCod1 || ((oData.Zlsch === "R" || oData.DispMethod === "R") && oCustomer.PostlCod1 === "00-000")) {
				aVariables.push(oBundle.getText("PostCodeValidate"));
			}
			if (!oCustomer.City) {
				aVariables.push(oBundle.getText("CityValidate"));
			}
			if (!oCustomer.Country) {
				aVariables.push(oBundle.getText("Country"));
			}
			if (!oCustomer.Iban && ( oData.Zlsch === "P" || oData.DispMethod === "P" )) {
				aVariables.push(oBundle.getText("AccountID"));
			} else if(oCustomer.Iban && ( oData.Zlsch === "P" || oData.DispMethod === "P" )){
				this.validateIBAN(oCustomer.Iban) ? "" : aVariables.push(oBundle.getText("InvalidAccountID"));;
			}
			if ( oData.Zlsch === "R" || oData.DispMethod === "R" ){
				if (!oCustomer.Street || !oCustomer.HouseNo) {
					aVariables.push(oBundle.getText("Street"));
				}
			}
			
			return aVariables;
		}

	};
});