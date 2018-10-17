import { Component, OnInit, Input, Output, EventEmitter} from '@angular/core';
import { FormGroup, FormControl, Validators, AbstractControl } from '@angular/forms';

import { LSCXContractService } from '../../../services/LSCX-contract.service';
import { FormsService } from '../../../services/forms.service';
import { SendDialogService } from '../../../services/send-dialog.service';
import { AccountService } from '../../../services/account.service';
import { DialogService } from '../../../services/dialog.service';
import { Router } from '@angular/router';
import { Web3 } from '../../../services/web3.service';

import BigNumber from 'bignumber.js/bignumber';
import { RawTx } from '../../../models/rawtx';


@Component({
  selector: 'app-show-contract',
  templateUrl: './showContract.component.html',
})
export class ShowContract implements OnInit{
  @Input() moreInfo;
  @Input() functions;
  @Input() contractType:string;
  @Input() contractInfo;

  @Output() back = new EventEmitter<boolean>();

  protected submited: boolean = false;
  protected functionForm: FormGroup;
  protected infoFunctions = [];
  protected transFunctions = [];
  protected funct: any;
  protected owner: string;
  protected response: any = null;
  protected function;

  constructor(public _LSCXcontract: LSCXContractService,protected _forms: FormsService, protected sendDialogService : SendDialogService, protected _account: AccountService, protected _dialog: DialogService, protected router : Router, protected _web3: Web3) {
    this.functionForm = new FormGroup({
      functionCtrl: new FormControl(null,Validators.required),
    })
  }

  ngOnInit(){
    this.moreInfo.forEach(info=>{
      if(info[0]=="owner"){
        this.owner=info[1]
      }
    })
  }

  getControl(controlName: string): AbstractControl{
    return this.functionForm.get(controlName);
  }

  showFunction(){
    let funct = this.getControl('functionCtrl').value
    if(funct != this.funct){
      this.submited = false;
      this.response = null;
      //Remove prev controls
      if(this.funct != null){
        this.functionForm = this._forms.removeControls(this.funct.inputs, this.functionForm);
        if(this.funct.payable){
          this.functionForm.removeControl('ethAmount');
        }
      }
      
      this.funct = funct;
      this.functionForm = this._forms.addControls(funct.inputs, this.functionForm);
      if(this.funct.payable){
        this.functionForm.addControl('ethAmount', new FormControl(0, [Validators.required, Validators.min(0)]));
      }
      setTimeout(()=>{
        let el = document.getElementById('button');
        if (el) el.scrollIntoView({behavior: "smooth", block: "start", inline: "end"});
      },50)
      

    }
  }

  async onSubmit(){
    this.submited = true;
    if(this.functionForm.invalid){
      return false
    }
    let params = this._forms.getValues(this.funct.inputs, this.functionForm, this.contractInfo.type);
    if(this.funct.constant){
      
      let response = await this._LSCXcontract.callFunction(this._LSCXcontract.contract, this.funct.name, params);
      
      let x = response.toString();
      let resBig = new BigNumber(x);
      
      
      if(this.funct.decimals == 'decimals'){
      
        let y = resBig.div(Math.pow(10,this.contractInfo.decimals));
      
        let number = y.toNumber();
        
				let zero = '0'
        this.response = number.toLocaleString('en') + "."+zero.repeat(this.contractInfo.decimals)

        
      }else if(this.funct.decimals == "eth"){
        let number = this._web3.web3.fromWei(parseInt(response.toString()),'ether')
        this.response = number.toLocaleString('en')

      }else{
        this.response = response;

      }
    }else{
      let dialogRef = this._dialog.openLoadingDialog();
      let data = await this._LSCXcontract.getFunctionData(this.funct.name, params);
      
      let gasLimit;
      try {
        gasLimit = await this._web3.estimateGas(this._account.account.address,this.contractInfo.address, data, 0);
      }catch(e){
        gasLimit = 1000000;
      }

      dialogRef.close();
      dialogRef = this._dialog.openGasDialog(gasLimit, 40);
      dialogRef.afterClosed().subscribe(async result=>{
        if(typeof(result) != 'undefined'){
          let options = JSON.parse(result);
          options.data = data;
          let amount = 0;
          if(this.funct.payable){
            amount =  parseInt(this._web3.web3.toWei(this.getControl('ethAmount').value, "ether"));
          }
          let tx = new RawTx(this._account,this.contractInfo.address,new BigNumber(amount),options.gasLimit, options.gasPrice, this._web3.network, data);

          dialogRef.close();
          //tx, to, amount, fees, total, action, token?
          this.sendDialogService.openConfirmSend(tx.tx, this.contractInfo.address, tx.amount,tx.gas, tx.cost, "send");
        }
      });
    }
  }

  decimalsOutput(value){
    let result = value/Math.pow(10,this.contractInfo.decimals);
    return result
  }

  changeValue(inputName){
    let value = parseFloat(this.getControl(inputName).value).toFixed(this.contractInfo.decimals);
    this.functionForm.controls[inputName].setValue(value);
  }

  goBack(){
    this.back.emit(true);
  }

}
