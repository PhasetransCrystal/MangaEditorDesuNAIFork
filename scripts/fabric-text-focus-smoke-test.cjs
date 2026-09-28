// fabric の編集用 textarea がスクロールを起こさないことを検証する。
//
// 症状は 2 段階あった:
//   1) enterEditing() の focus() が文書をスクロールさせる
//   2) 入力のたび updateTextareaPosition() が textarea を
//      カーソル位置（文書座標・画面外）へ書き戻し、またスクロールする
// 対策は textarea を「固定・ゼロサイズ・overflow:clip」のホストへ
// 移して文書のスクロール領域から外すこと。ここではその構造と、
// focus の preventScroll、二重パッチ防止を検証する。
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/core/util/fabric-text-focus.js'),'utf8');

const scrollRoot={scrollLeft:0,scrollTop:0};

// --- 最小の DOM モデル ---
// lib.dom は使わず、パッチが必要とする範囲だけを実装する。
function createElement(tag){
  const el={
    tagName:String(tag).toUpperCase(),
    id:'',
    style:{},
    attributes:{},
    children:[],
    parentElement:null,
    setAttribute:function(key,value){this.attributes[key]=value;},
    getAttribute:function(key){return this.attributes[key];},
    appendChild:function(child){this.children.push(child);child.parentElement=this;return child;}
  };
  return el;
}

const body=createElement('body');
const doc={
  body:body,
  documentElement:body,
  scrollingElement:scrollRoot,
  createElement:createElement,
  getElementById:function(id){
    // body 配下だけを探す（ホストは body 直下に作られる）。
    const stack=[body];
    while(stack.length){
      const el=stack.shift();
      if(el.id===id)return el;
      for(const child of el.children)stack.push(child);
    }
    return null;
  }
};

// fabric 同様、initHiddenTextarea で作った textarea を
// enterEditing が focus() する。preventScroll 無しなら document がスクロールする。
function makePrototype(){
  return {
    initHiddenTextarea:function(){
      const textarea={
        tagName:'TEXTAREA',
        focusCalls:[],
        style:{},
        parentElement:null,
        focus:function(options){
          this.focusCalls.push(options===undefined?null:options);
          if(!(options&&options.preventScroll))scrollRoot.scrollTop+=200;
        }
      };
      // 実 fabric と同じく、コンテナがあればそこへ、無ければ body 直下へ置く。
      if(this.hiddenTextareaContainer){
        this.hiddenTextareaContainer.appendChild(textarea);
      }else{
        doc.body.appendChild(textarea);
      }
      this.hiddenTextarea=textarea;
    },
    // fabric の enterEditing 相当。textarea を focus する。
    enterEditing:function(){
      if(!this.hiddenTextarea)this.initHiddenTextarea();
      this.hiddenTextarea.focus();
    }
  };
}

const context={
  console,
  document:doc
};
context.window=context;
context.globalThis=context;
// 実際の fabric と同じ継承関係にする。
// initHiddenTextarea / enterEditing を持つのは IText だけで、
// Textbox は IText を、VerticalTextbox も IText を継承する。
const itextProto=makePrototype();
const textboxProto=Object.create(itextProto);
const textProto={};
delete textboxProto.initHiddenTextarea;
context.fabric={
  Text:{prototype:textProto},
  IText:{prototype:itextProto},
  Textbox:{prototype:textboxProto}
};
// 実行ファイルと同じに IText を継承するクラスを作る。
context.fabric.VerticalTextbox={prototype:Object.create(context.fabric.IText.prototype)};
vm.createContext(context);
vm.runInContext(source,context,{filename:'fabric-text-focus.js'});

const HOST_ID=context.NaiFabricTextFocus.hostId;
assert.equal(HOST_ID,'naiHiddenTextareaHost','ホスト id が想定と違う');

// --- パッチは入力を持つ IText に入り、Textbox はそれを継承する ---
assert.equal(context.fabric.IText.prototype.__naiFocusNoScrollPatched,true,'IText にパッチが入っていない');
assert.ok(context.fabric.Textbox.prototype.__naiFocusNoScrollPatched,
  'Textbox がパッチされた initHiddenTextarea を継承していない');
assert.ok(context.fabric.VerticalTextbox&&context.fabric.VerticalTextbox.prototype.__naiFocusNoScrollPatched,
  'VerticalTextbox が IText のパッチを継承していない');

// --- ホストは遅延生成され、body 直下に 1 つだけ ---
assert.equal(doc.getElementById(HOST_ID),null,'install だけでホストを作っている（遅延生成のはず）');

// --- 編集開始で document がスクロールしない ---
['IText','Textbox','VerticalTextbox'].forEach(function(name){
  scrollRoot.scrollTop=0;
  scrollRoot.scrollLeft=0;
  var instance=Object.create(context.fabric[name].prototype);
  instance.enterEditing();
  assert.equal(scrollRoot.scrollTop,0,name+' で編集開始時にスクロールしている');
  var calls=instance.hiddenTextarea.focusCalls;
  assert.equal(calls.length,1,name+' で focus が呼ばれていない');
  assert.equal(calls[0]&&calls[0].preventScroll,true,name+' で preventScroll が付いていない');
});

// --- textarea は固定ホストへ移り、body 直下には残らない（第 2 段の対策）---
(function(){
  var host=doc.getElementById(HOST_ID);
  assert.ok(host,'編集開始後もホストが作られていない');
  assert.ok(/position:fixed/.test(host.style.cssText),'ホストが fixed でない');
  assert.ok(/overflow:clip/.test(host.style.cssText),'ホストが overflow:clip でない');
  assert.equal(host.parentElement,doc.body,'ホストが body 直下にない');
  var instance=Object.create(context.fabric.IText.prototype);
  instance.enterEditing();
  assert.equal(instance.hiddenTextareaContainer,host,'initHiddenTextarea がホストを使っていない');
  assert.equal(instance.hiddenTextarea.parentElement,host,'textarea がホストへ入っていない');
  assert.equal(instance.hiddenTextarea.parentElement===doc.body,false,'textarea が body 直下に残っている');
})();

// --- 入力のたびの位置書き戻しでも文書がスクロールしない（第 2 段の再現）---
// 実 fabric は updateTextareaPosition() で textarea を文書座標へ書き戻す。
// body 直下にあるとブラウザが追従スクロールするため、ホスト内にある間は
// スクロールさせない、というモデルで検証する。
function moveTextareaToDocumentY(textarea,y){
  textarea.style.top=y+'px';
  // 文書フロー（body 直下）にある時だけ、ブラウザが追従スクロールする。
  if(textarea.parentElement===doc.body)scrollRoot.scrollTop+=300;
}
(function(){
  var instance=Object.create(context.fabric.IText.prototype);
  instance.enterEditing();
  scrollRoot.scrollTop=0;
  for(var i=0;i<10;i++)moveTextareaToDocumentY(instance.hiddenTextarea,1200+i*300);
  assert.equal(scrollRoot.scrollTop,0,'入力中の位置書き戻しでスクロールしている');
})();

// --- 対策無しなら 1) 2) とも再現すること（テスト自体の妥当性） ---
(function(){
  var bare=makePrototype();
  var instance=Object.create(bare);
  scrollRoot.scrollTop=0;
  instance.enterEditing();
  assert.equal(scrollRoot.scrollTop,200,'パッチ無しで 1) が再現しないとテストが意味をなさない');
  scrollRoot.scrollTop=0;
  for(var i=0;i<10;i++)moveTextareaToDocumentY(instance.hiddenTextarea,1200+i*300);
  assert.equal(scrollRoot.scrollTop,3000,'パッチ無しで 2) が再現しないとテストが意味をなさない');
})();

// --- preventScroll を黙って無視する実装でもスクロールしない ---
(function(){
  // focus({preventScroll:true}) を投げずに、無視してスクロールする実装。
  var rude={};
  rude.initHiddenTextarea=function(){
    var textarea={
      tagName:'TEXTAREA',
      style:{},
      parentElement:null,
      focus:function(){
        // preventScroll を渡されても無視する（例外は投げない）。
        scrollRoot.scrollTop+=200;
        scrollRoot.scrollLeft+=37;
      }
    };
    (this.hiddenTextareaContainer||doc.body).appendChild(textarea);
    this.hiddenTextarea=textarea;
  };
  // initHiddenTextarea を持つプロトタイプには enterEditing も自前で要る。
  rude.enterEditing=function(){
    if(!this.hiddenTextarea)this.initHiddenTextarea();
    this.hiddenTextarea.focus();
  };
  var api={IText:{prototype:rude},Text:{prototype:{}}};
  context.NaiFabricTextFocus.install(api);
  scrollRoot.scrollTop=500;
  scrollRoot.scrollLeft=80;
  var instance=Object.create(rude);
  instance.enterEditing();
  assert.equal(scrollRoot.scrollTop,500,'preventScroll 無視実装で縦スクロールが戻っていない');
  assert.equal(scrollRoot.scrollLeft,80,'preventScroll 無視実装で横スクロールが戻っていない');
})();

// --- 二重パッチしない ---
scrollRoot.scrollTop=0;
var proto=context.fabric.IText.prototype;
var beforeFn=proto.initHiddenTextarea;
context.NaiFabricTextFocus.install(context.fabric);
assert.equal(proto.initHiddenTextarea,beforeFn,'再実行で initHiddenTextarea が二重ラップされた');
var once=Object.create(proto);
once.enterEditing();
assert.equal(scrollRoot.scrollTop,0,'再実行後にスクロールした');

// --- ホストは 1 つだけ（使い回す）---
(function(){
  var host=doc.getElementById(HOST_ID);
  var beforeCount=host.children.length;
  var instance=Object.create(context.fabric.IText.prototype);
  instance.enterEditing();
  assert.equal(doc.getElementById(HOST_ID),host,'ホストが作り直されている');
  assert.equal(host.children.length,beforeCount+1,'新しい textarea が同じホストへ入っていない');
  assert.equal(instance.hiddenTextarea.parentElement,host,'textarea の親がホストでない');
})();

// --- index.html から fabric 直後・defer 無しで読まれる ---
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(html.includes('js/core/util/fabric-text-focus.js'),'index.html から読まれていない');
const fabricIdx=html.indexOf('third/Fabric.js/fabric.min_PlusEraser.js');
const patchIdx=html.indexOf('js/core/util/fabric-text-focus.js');
assert.ok(fabricIdx>=0&&patchIdx>fabricIdx,'fabric より後に読まないとパッチできない');
const tagStart=html.lastIndexOf('<script',patchIdx);
const tagEnd=html.indexOf('>',tagStart);
assert.ok(!html.slice(tagStart,tagEnd).includes('defer'),'defer 付きだと順序がずれる');
console.log('fabric text focus smoke test passed');
