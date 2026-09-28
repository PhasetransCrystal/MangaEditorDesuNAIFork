// fabric の IText / Textbox は、入力用の 1px の textarea を
// 「文書座標」で置く（position: absolute + canvas._offset）。
// 既定の置き場所は document.body 直下なので、画布の外側（右 / 下）に
// テキストを置いて編集に入ると、ブラウザがその textarea を画面内へ
// 出そうとして document ごとスクロールし、編集画面全体がずれる。
//
// この問題は 2 段階で起きる:
//   1) enterEditing() の focus() が文書をスクロールさせる
//   2) 入力のたびに updateTextareaPosition() が textarea を
//      カーソル位置（文書座標・画面外）へ書き戻し、
//      ブラウザが再びスクロールして追従する
// 前回の修正は 1) だけを preventScroll で抑えたため、2) が残っていた。
//
// 対策は textarea を「固定・ゼロサイズ・overflow:clip」のホストへ移し、
// 文書のスクロール可能領域から外すこと。これで 1) 2) 両方が止まる。
// 併せて focus を preventScroll 付きにし、動いた分だけ戻す。
// 位置計算（_calcTextareaPosition）は fabric のまま使う。
// textarea の座標は IME 候補ウィンドウの基準になるため変えない。
(function(root){
"use strict";

var PATCHED_FLAG="__naiFocusNoScrollPatched";
var HOST_ID="naiHiddenTextareaHost";

// preventScroll を付けて focus する。付けられない・無視される環境でも
// スクロール位置を退避して戻すので、document は動かない。
function focusWithoutScroll(textarea){
if(!textarea||typeof textarea.focus!=="function")return;
if(textarea[PATCHED_FLAG])return;
textarea[PATCHED_FLAG]=true;
var originalFocus=textarea.focus;
textarea.focus=function(options){
var opts=options&&typeof options==="object"?options:{preventScroll:true};
if(opts.preventScroll===undefined)opts.preventScroll=true;
var scroller=document.scrollingElement||document.documentElement||document.body;
var left=scroller?scroller.scrollLeft:null;
var top=scroller?scroller.scrollTop:null;
var result;
try{
result=originalFocus.call(this,opts);
}catch(error){
result=originalFocus.call(this);
}
// preventScroll を黙って無視する実装への保険。動いた時だけ戻す。
if(scroller&&left!==null&&(scroller.scrollLeft!==left||scroller.scrollTop!==top)){
scroller.scrollLeft=left;
scroller.scrollTop=top;
}
return result;
};
}

// textarea の置き場所。固定・ゼロサイズ・overflow:clip なので、
// 中身が画面外へはみ出しても文書はスクロールしない。
function ensureHost(){
var host=document.getElementById(HOST_ID);
if(host)return host;
host=document.createElement("div");
host.id=HOST_ID;
host.setAttribute("aria-hidden","true");
host.style.cssText="position:fixed;top:0;left:0;width:0;height:0;z-index:-999;overflow:clip;pointer-events:none;";
(document.body||document.documentElement).appendChild(host);
return host;
}

// 位置計算は fabric のものをそのまま使う。
// 座標を変えると IME の候補ウィンドウ位置がずれる。
function patchTextPrototype(proto){
if(!proto)return false;
// 自分で initHiddenTextarea を持つプロトタイプだけパッチする。
// Textbox のように IText を継承するものは、継承先の
// パッチをそのまま使う（二重ラップも起こらない）。
if(!Object.prototype.hasOwnProperty.call(proto,"initHiddenTextarea"))return false;
var originalInit=proto.initHiddenTextarea;
if(typeof originalInit!=="function")return false;
if(proto[PATCHED_FLAG])return false;
proto[PATCHED_FLAG]=true;
proto.initHiddenTextarea=function(){
this.hiddenTextareaContainer=ensureHost();
originalInit.call(this);
focusWithoutScroll(this.hiddenTextarea);
};
return true;
}

function install(fabricApi){
if(!fabricApi)return false;
var patched=false;
if(patchTextPrototype(fabricApi.IText&&fabricApi.IText.prototype))patched=true;
if(patchTextPrototype(fabricApi.Textbox&&fabricApi.Textbox.prototype))patched=true;
if(patchTextPrototype(fabricApi.Text&&fabricApi.Text.prototype))patched=true;
return patched;
}

var target=root.fabric||(typeof fabric!=="undefined"?fabric:null);
install(target);
root.NaiFabricTextFocus={install:install,patchedFlag:PATCHED_FLAG,hostId:HOST_ID};

})(typeof window!=="undefined"?window:globalThis);
