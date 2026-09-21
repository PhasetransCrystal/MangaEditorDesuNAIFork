const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/core/util/image-util.js'),'utf8');

// image-util.js は関数定義のみをトップレベルで実行するため、DOM を最小スタブで読み込める。
const calls=[];
const selectValues={outputImageFormat:'png',outputImageQuality:'0.92',outputDpi:'300'};
const canvasStub={
width:1654,
height:2339,
toDataURL:function(options){calls.push(options);return 'data:image/'+(options.format||'png')+';base64,AAAA';},
};

const context={
console,
canvas:canvasStub,
document:{createElement:function(){return {click:function(){},set href(v){this._href=v;},get href(){return this._href;}};}},
fabric:{},
$:function(id){return selectValues[id]===undefined?null:{value:selectValues[id]};},
createToast:function(){},
createToastError:function(){},
fetch:function(){return Promise.resolve({blob:function(){return Promise.resolve({});}});},
removeGrid:function(){},
drawGrid:function(){},
isGridVisible:false,
};
context.window=context;
context.globalThis=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'image-util.js'});

const ImageUtil=context.ImageUtil;
assert.ok(ImageUtil,'ImageUtil must be defined');

// --- 形式の正規化 ---
assert.equal(ImageUtil.resolveExportFormat('jpg'),'jpeg');
assert.equal(ImageUtil.resolveExportFormat('JPEG'),'jpeg');
assert.equal(ImageUtil.resolveExportFormat('webp'),'webp');
assert.equal(ImageUtil.resolveExportFormat('png'),'png');
assert.equal(ImageUtil.resolveExportFormat('bmp'),'png','未対応形式は png にフォールバック');
assert.equal(ImageUtil.resolveExportFormat(undefined),'png');

// --- 品質の正規化/クランプ ---
assert.equal(ImageUtil.normalizeExportQuality(0.92),0.92);
assert.equal(ImageUtil.normalizeExportQuality('0.85'),0.85);
assert.equal(ImageUtil.normalizeExportQuality(92),0.92,'パーセント指定も受け付ける');
assert.equal(ImageUtil.normalizeExportQuality(98),0.98,'2桁のパーセント指定');
assert.equal(ImageUtil.normalizeExportQuality(100),0.98,'100 は上限クランプ');
assert.equal(ImageUtil.normalizeExportQuality(0.1),0.5,'下限クランプ');
assert.equal(ImageUtil.normalizeExportQuality(5),0.5,'小さいパーセントは下限クランプ');
assert.equal(ImageUtil.normalizeExportQuality('abc'),0.92,'不正値は既定値');
assert.equal(ImageUtil.normalizeExportQuality(undefined),0.92,'未指定は既定値');

// --- 倍率の上限（長辺・総ピクセル）---
const small=ImageUtil.resolveExportMultiplier(1.5,1000,1500);
assert.equal(small,1.5,'上限内はそのまま');
const capped=ImageUtil.resolveExportMultiplier(10,4096,4096);
assert.ok(capped<10,'上限を超える倍率は縮小される');
assert.ok(4096*capped<=8192+1,'長辺上限を超えない: '+(4096*capped));
assert.ok(4096*capped*4096*capped<=40*1000*1000+1,'総ピクセル上限を超えない: '+(4096*capped*4096*capped));

// 実描画と同じ整数丸めをしても上限を超えないこと
[[1654,2339],[4096,4096],[8192,8192],[20000,20000],[60000,1200],[1200,60000],[100000,100000]].forEach(function(dim){
const m=ImageUtil.resolveExportMultiplier(50,dim[0],dim[1]);
const w=Math.round(dim[0]*m),h=Math.round(dim[1]*m);
assert.ok(Math.max(w,h)<=8192,'長辺上限: '+dim.join('x')+' -> '+w+'x'+h);
assert.ok(w*h<=40*1000*1000,'総ピクセル上限: '+dim.join('x')+' -> '+w+'x'+h+' = '+(w*h));
});
assert.ok(ImageUtil.resolveExportMultiplier(0,1000,1000)>0,'0 は既定値で処理');
assert.ok(ImageUtil.resolveExportMultiplier(NaN,1000,1000)>0,'NaN は既定値で処理');

// --- 書き出しオプションの組み立て ---
calls.length=0;
ImageUtil.exportCanvasDataURL(1.06,'jpeg','0.9');
assert.equal(calls.length,1);
assert.equal(calls[0].format,'jpeg');
assert.equal(calls[0].quality,0.9);
assert.ok(Math.abs(calls[0].multiplier-1.06)<1e-9);

calls.length=0;
ImageUtil.exportCanvasDataURL(1.06,'png','0.9');
assert.equal(calls[0].format,'png');
assert.equal(calls[0].quality,undefined,'png に quality を渡さない');

calls.length=0;
ImageUtil.exportCanvasDataURL(50,'png');
assert.ok(calls[0].multiplier<50,'exportCanvasDataURL は倍率を上限内に収める');
assert.equal(ImageUtil.lastExportWasCapped,true,'上限に当たったことを記録する');

calls.length=0;
ImageUtil.exportCanvasDataURL(1,'png');
assert.equal(ImageUtil.lastExportWasCapped,false,'上限内なら印を付けない');

// --- ダウンロードリンクが選択中の形式を反映する ---
selectValues.outputImageFormat='webp';
selectValues.outputImageQuality='0.8';
calls.length=0;
const link=ImageUtil.getCropAndDownloadLink();
assert.equal(calls[0].format,'webp','UI の形式選択が反映される');
assert.equal(calls[0].quality,0.8,'UI の品質選択が反映される');
assert.ok(link.download.endsWith('.webp'),'拡張子が形式に一致する: '+link.download);

selectValues.outputImageFormat='jpeg';
const jpegLink=ImageUtil.getCropAndDownloadLink();
assert.ok(jpegLink.download.endsWith('.jpeg'),'jpeg 拡張子: '+jpegLink.download);

// --- クリップボードコピーは常に PNG（ClipboardItem が image/png 宣言のため）---
selectValues.outputImageFormat='jpeg';
calls.length=0;
ImageUtil.clipCopy();
assert.equal(calls[calls.length-1].format,'png','clipCopy は PNG 固定');

// --- UI/翻訳の存在確認 ---
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert.ok(html.includes('id="outputImageFormat"'),'形式セレクトが未定義');
assert.ok(html.includes('id="outputImageQuality"'),'品質セレクトが未定義');
assert.ok(/id="outputDpi"[^>]*max="/.test(html),'outputDpi に max 属性が必要');

const langs=['ja','en','ko','fr','zh','ru','es','de'];
langs.forEach(function(lang){
const file=fs.readFileSync(path.join(root,'js/ui/third/base-translation/base-'+lang+'.js'),'utf8');
assert.ok(file.includes('"outputImageFormat"'),lang+' に outputImageFormat が無い');
assert.ok(file.includes('"outputImageQuality"'),lang+' に outputImageQuality が無い');
});

// --- 設定が永続化対象に含まれる ---
const projectManagement=fs.readFileSync(path.join(root,'js/project-management.js'),'utf8');
assert.ok(projectManagement.includes("outputImageFormat:{id:'outputImageFormat'"),'形式が設定スキーマに無い');
assert.ok(projectManagement.includes("outputImageQuality:{id:'outputImageQuality'"),'品質が設定スキーマに無い');

// --- プレビュー JPEG は品質指定つきで書き出す ---
const compression=fs.readFileSync(path.join(root,'js/core/compression/project-compression.js'),'utf8');
assert.ok(/getCropAndDownloadLinkByMultiplier\(1,'jpeg',[\d.]+\)/.test(compression),'プレビュー JPEG に品質指定が必要');

// --- 形式が PNG のとき品質セレクトを無効化する ---
const canvasManager=fs.readFileSync(path.join(root,'js/canvas-manager.js'),'utf8');
assert.ok(canvasManager.includes('syncExportQualityAvailability'),'品質セレクト同期が未実装');

console.log('image export smoke test passed');
