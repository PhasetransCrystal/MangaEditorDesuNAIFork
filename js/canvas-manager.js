var initialCanvasWidth=0;
var initialCanvasHeight=0;
var aspectRatio=0;
var viewUserScale=1;
var resizableContainer=0;

let resizeTimer;
function initResizeCanvas(event) {
canvasLogger.debug("initResizeCanvas");
if(event){
event.stopPropagation();
event.preventDefault();
}
var parent=getCanvasViewParent();
if(!parent)return;
var containerWidth=parent.clientWidth;
var containerHeight=parent.clientHeight;

if (
containerWidth<minCanvasSizeWidth||
containerHeight<minCanvasSizeHeight
) {
return;
}

if (resizeTimer) {
clearTimeout(resizeTimer);
}
resizeTimer=setTimeout(function () {
if(typeof canvas==="undefined"||!canvas||!canvas.getWidth()){
if(typeof loadBookSize==="function"){
var page=typeof NaiMangaPageSize!=="undefined"?NaiMangaPageSize.defaultMangaPageSize(false):{width:1654,height:2339};
loadBookSize(page.width,page.height,false);
}
}
fitCanvasViewToContainer(true);
if(typeof initMessage==="function")initMessage();
},15);
}

function getCanvasViewParent(){
return $("resizable-container")||$("canvas-container");
}

function resolvePagePixels(width,height){
if(typeof NaiMangaPageSize!=="undefined"&&typeof NaiMangaPageSize.resolveMangaPageSize==="function"){
return NaiMangaPageSize.resolveMangaPageSize(width,height);
}
return {width:parseFloat(width)||1654,height:parseFloat(height)||2339};
}

function updatePageSizeBadge(){
var badge=$("naiPageSizeBadge");
if(!badge||typeof canvas==="undefined"||!canvas)return;
var w=Math.round(canvas.getWidth()||0);
var h=Math.round(canvas.getHeight()||0);
badge.textContent=w&&h?("底图 "+w+"\u00d7"+h):"底图";
badge.title="组装漫画用的页面分辨率。出图单格仍按 NovelAI 安全尺寸，不会因为底图变大而多花积分。";
}

function fitCanvasViewToContainer(forced){
var parent=getCanvasViewParent();
var container=$("canvas-container");
if(!parent||!container||typeof canvas==="undefined"||!canvas)return;
var cw=canvas.getWidth();
var ch=canvas.getHeight();
var pw=parent.clientWidth;
var ph=parent.clientHeight;
if(!cw||!ch||!pw||!ph)return;
var fit=Math.min(pw/cw,ph/ch);
if(!isFinite(fit)||fit<=0)fit=1;
if(!viewUserScale||viewUserScale<0.2)viewUserScale=1;
var scale=fit*viewUserScale;
if(!forced&&Math.abs((canvasContinerScale||0)-scale)<0.0005){
updatePageSizeBadge();
updateZoomLabel();
return;
}
canvasContinerScale=scale;
container.style.maxWidth="none";
container.style.maxHeight="none";
container.style.width=cw+"px";
container.style.height=ch+"px";
container.style.transformOrigin="top left";
container.style.transform="scale("+scale+")";
container.style.marginRight=(cw*(scale-1))+"px";
container.style.marginBottom=(ch*(scale-1))+"px";
updatePageSizeBadge();
updateZoomLabel();
}

function resizeCanvasByNum(newWidth,newHeight) {
var size=resolvePagePixels(newWidth,newHeight);
canvas.setWidth(size.width);
canvas.setHeight(size.height);
initialCanvasWidth=canvas.getWidth();
initialCanvasHeight=canvas.getHeight();
aspectRatio=initialCanvasWidth/initialCanvasHeight;
canvas.renderAll();
fitCanvasViewToContainer(true);
syncExportPagePlan();
scheduleExportSizeEstimate();
}

function resizeCanvas(newWidth,newHeight) {
if(!newWidth||!newHeight||isNaN(newWidth)||isNaN(newHeight)){
return;
}
canvas.setDimensions({width: newWidth,height: newHeight});
canvas.getObjects().forEach((obj)=>{
if(!obj||!obj.initial)return;

var scaleX=newWidth/obj.initial.canvasWidth;
var scaleY=newHeight/obj.initial.canvasHeight;

obj.set({
scaleX: obj.initial.scaleX*scaleX,
scaleY: obj.initial.scaleY*scaleY,
left: obj.initial.left*scaleX,
top: obj.initial.top*scaleY,
strokeWidth: obj.initial.strokeWidth*scaleX,
});

if (obj.clipPath&&obj.clipPath.initial) {
scaleX=newWidth/obj.clipPath.initial.canvasWidth;
scaleY=newHeight/obj.clipPath.initial.canvasHeight;
const clipPath=obj.clipPath;
clipPath.set({
scaleX: obj.clipPath.initial.scaleX*scaleX,
scaleY: obj.clipPath.initial.scaleY*scaleY,
left: obj.clipPath.initial.left*scaleX,
top: obj.clipPath.initial.top*scaleY,
});
clipPath.setCoords();
}
saveInitialState(obj);
obj.setCoords();
});
canvas.renderAll();
fitCanvasViewToContainer(true);
syncExportPagePlan();
scheduleExportSizeEstimate();
}

function forcedAdjustCanvasSize() {
adjustCanvasSize(true);
}


function adjustCanvasSize(forced) {
if(typeof canvas==="undefined"||!canvas||!canvas.getWidth())return;
aspectRatio=canvas.getWidth()/Math.max(1,canvas.getHeight());
initialCanvasWidth=canvas.getWidth();
initialCanvasHeight=canvas.getHeight();
fitCanvasViewToContainer(!!forced);
}

window.addEventListener("resize",function(){
adjustCanvasSize(true);
});

function adjustCanvasSizeWithContainer(windowWidth,windowHeight) {
fitCanvasViewToContainer(true);
}

function addInitialImageToCanvas(img) {
resizeCanvasByNum(img.width,img.height);
initialPutImage(img);
fitCanvasViewToContainer(true);
}


function resizeCanvasToObject(objectWidth,objectHeight) {
var size=resolvePagePixels(objectWidth,objectHeight);
if(!size.width||!size.height)return;
canvas.setDimensions({width:size.width,height:size.height});
initialCanvasWidth=size.width;
initialCanvasHeight=size.height;
aspectRatio=initialCanvasWidth/initialCanvasHeight;
canvas.renderAll();
viewUserScale=1;
fitCanvasViewToContainer(true);
syncExportPagePlan();
scheduleExportSizeEstimate();
}

document.addEventListener('DOMContentLoaded',function() {
$('bg-color').addEventListener('input',function (event) {
var color=event.target.value;
canvas.setBackgroundColor(color,canvas.renderAll.bind(canvas));
syncExportBackgroundLabel();
});
$('bg-color').addEventListener('input',function (event) {
resizableContainer=getCanvasViewParent();
});
resizableContainer=getCanvasViewParent();
bindExportBackgroundButton();
syncExportBackgroundLabel();
syncExportBitDepthState();
syncExportQualityAvailability();
syncExportPagePlan();
syncExportSizeEstimate();
});

// 画布背景の入力本体は 1px の不可視入力なので、行のボタンからピッカーを開く。
function bindExportBackgroundButton(){
var picker=$('bg-color');
var button=$('bgColorButton');
if(!picker||!button||button.dataset.pickerBound==='1')return;
button.dataset.pickerBound='1';
var open=function(event){
if(event){event.preventDefault();event.stopPropagation();}
if(picker.jscolor&&typeof picker.jscolor.show==='function')picker.jscolor.show();
};
button.addEventListener('click',open);
button.addEventListener('mousedown',function(event){event.preventDefault();event.stopPropagation();});
}

// 画布背景の六十六進値ラベルと色の四角形を同期する。
function formatExportColorHex(color){
if(typeof rgbToHex==='function'){
return rgbToHex(String(color||'')).toUpperCase();
}
return String(color||'').toUpperCase();
}

function syncExportBackgroundLabel(){
var picker=$('bg-color');
var label=$('bgColorValue');
if(!picker)return;
var hex=formatExportColorHex(picker.value);
if(label)label.textContent=hex;
var preview=$('bgColorSwatch');
if(preview)preview.style.backgroundColor=hex;
}

// 位深度は PNG のときだけ有効。jpeg/webp では無効だと分かるようにする。
function syncExportBitDepthState(){
var formatElement=$('outputImageFormat');
var bitDepthElement=$('outputBitDepth');
if(!formatElement||!bitDepthElement)return;
var update=function(){
var isPng=typeof resolveExportFormat==='function'
? resolveExportFormat(formatElement.value)==='png'
: formatElement.value==='png';
bitDepthElement.disabled=!isPng;
bitDepthElement.title=isPng?'PNG 实际写出的位深度。灰度 / 24位 RGB 会丢弃透明度。':'当前输出格式不是 PNG，位深度不生效。';
var hint=$('outputBitDepthHint');
if(hint)hint.style.display=isPng?'':'none';
syncExportPagePlan();
};
formatElement.addEventListener('change',update);
update();
}

var exportPagePlanSyncing=false;
var exportPixelRevertTimer=null;

function currentExportDpi(){
var element=$('outputDpi');
return typeof NaiMangaPageSize!=='undefined'
?NaiMangaPageSize.resolveExportDpi(element?element.value:300)
:parseFloat(element?element.value:300)||300;
}

function setExportDpi(value){
var element=$('outputDpi');
if(!element)return;
element.value=String(value);
}

function currentCanvasSizeForPreview(){
var width=Math.max(1,Math.round(
typeof canvas!=='undefined'&&canvas?canvas.getWidth():1654
));
var height=Math.max(1,Math.round(
typeof canvas!=='undefined'&&canvas?canvas.getHeight():2339
));
return {width:width,height:height};
}

// 横/竖それぞれの mm 寸法から、その向きの実出力画素を返す。
function exportPlanForOrientation(dpi,landscape){
if(typeof NaiMangaPageSize==='undefined')return null;
var mm=landscape?NaiMangaPageSize.PAGE_MM.landscape:NaiMangaPageSize.PAGE_MM.portrait;
return NaiMangaPageSize.planExportPage(dpi,mm.width,mm.height);
}

// 出力画素のプレビュー。編集中の欄には触らない。
// force を渡すとフォーカス中でも書き換える（入力が受け付けられなかった時用）。
function updateExportPagePlanDisplay(dpi,force){
if(typeof NaiMangaPageSize==='undefined')return;
var active=force?null:document.activeElement;
[false,true].forEach(function(landscape){
var plan=exportPlanForOrientation(dpi,landscape);
if(!plan)return;
var prefix=landscape?'exportPxLandscape':'exportPxPortrait';
var widthField=$(prefix+'Width');
var heightField=$(prefix+'Height');
if(widthField&&active!==widthField)widthField.value=plan.width;
if(heightField&&active!==heightField)heightField.value=plan.height;
});
var note=$('exportPxCappedNote');
var portraitPlan=exportPlanForOrientation(dpi,false);
if(note)note.style.display=(portraitPlan&&portraitPlan.capped)?'':'none';
}

function syncExportPagePlan(){
if(typeof NaiMangaPageSize==='undefined')return;
if(exportPagePlanSyncing)return;
exportPagePlanSyncing=true;
try{
updateExportPagePlanDisplay(currentExportDpi());
}finally{
exportPagePlanSyncing=false;
}
}

// 画素欄の編集から DPI を逆算し、他の欄とプレビューを追隨させる。
// 各欄の data-edge と向きから、下地寸法のどちらの軸かを一意に決める。
function applyExportPixelEdge(input){
if(exportPagePlanSyncing)return;
if(!input)return;
if(typeof NaiMangaPageSize==='undefined')return;
var typed=Math.round(parseFloat(input.value));
if(!isFinite(typed)||typed<=0){
syncExportPagePlan();
return;
}
clearExportPixelRevert();
var size=currentCanvasSizeForPreview();
var landscape=input.id.indexOf('Landscape')>=0;
var isWidth=input.getAttribute('data-edge')==='width';
// 横向きの幅は長辺、縦向きの高さが長辺。それ以外は短辺として扱う。
var longEdgeIsWidth=landscape;
var useShortEdge=isWidth?!longEdgeIsWidth:longEdgeIsWidth;
var dpi=NaiMangaPageSize.resolveDpiForPixelEdge(size.width,size.height,typed,useShortEdge);
if(dpi===null){
syncExportPagePlan();
// 打鍵の途中で毎回戻すと入力できないので、手が止まってから元の計画値へ戻す。
scheduleExportPixelRevert(input);
return;
}
clearExportPixelRevert();
setExportDpi(dpi);
exportPagePlanSyncing=true;
try{
updateExportPagePlanDisplay(dpi);
scheduleExportSizeEstimate();
}finally{
exportPagePlanSyncing=false;
}
}

function clearExportPixelRevert(){
if(exportPixelRevertTimer){
clearTimeout(exportPixelRevertTimer);
exportPixelRevertTimer=null;
}
}

// 範囲外の値を手が止まった頃に計画値へ戻す。
function scheduleExportPixelRevert(input){
clearExportPixelRevert();
exportPixelRevertTimer=setTimeout(function(){
exportPixelRevertTimer=null;
updateExportPagePlanDisplay(currentExportDpi(),true);
if(input.dataset.planRejectNotified!=='1'){
input.dataset.planRejectNotified='1';
var size=currentCanvasSizeForPreview();
var capLong=NaiMangaPageSize.exportMaxLongEdge(Math.max(size.width,size.height),Math.min(size.width,size.height));
if(typeof createToastError==='function'){
createToastError('画布像素','输入的像素超出输出范围。画布最长边最多约 '+capLong+' 像素（输出上限）。',5000);
}
}
},800);
}

function bindExportPagePlanEvents(){
var dpiElement=$('outputDpi');
if(dpiElement&&dpiElement.dataset.planBound!=='1'){
dpiElement.dataset.planBound='1';
dpiElement.addEventListener('input',function(){
syncExportPagePlan();
scheduleExportSizeEstimate();
});
dpiElement.addEventListener('change',function(){
var normalized=currentExportDpi();
if(dpiElement.value!==String(normalized))dpiElement.value=String(normalized);
syncExportPagePlan();
scheduleExportSizeEstimate();
});
}
['exportPxPortraitWidth','exportPxPortraitHeight','exportPxLandscapeWidth','exportPxLandscapeHeight'].forEach(function(id){
var element=$(id);
if(!element||element.dataset.planBound==='1')return;
element.dataset.planBound='1';
element.addEventListener('input',function(){applyExportPixelEdge(element);});
// 無効な値を書き戻した後は、次の入力で通知を出し直せる。
element.addEventListener('blur',function(){delete element.dataset.planRejectNotified;});
});
}

// PNG はロスレスなので品質は効かない。選べないことが分かるように無効化する。
function syncExportQualityAvailability(){
var formatElement=$('outputImageFormat');
var qualityElement=$('outputImageQuality');
if(!formatElement||!qualityElement)return;
var update=function(){
var lossless=typeof resolveExportFormat==='function'
? resolveExportFormat(formatElement.value)==='png'
: formatElement.value==='png';
qualityElement.disabled=lossless;
qualityElement.title=lossless?'PNG 是无损格式，品质设置不生效。':'JPEG / WebP 的压缩品质。';
syncExportSizeEstimate();
};
formatElement.addEventListener('change',update);
update();
}

// 出力サイズの概算表示。実際に数タイル書き出すため重い。連打と編集中の連続更新を避けるため遅延させる。
var exportEstimateTimer=null;
var exportEstimateRunning=false;
var exportEstimatePending=false;

function renderExportSizeEstimate(){
var label=$('outputImageEstimate');
if(!label)return;
if(typeof estimateExportSize!=='function'||typeof formatByteSize!=='function'){
label.textContent='-';
return;
}
if(exportEstimateRunning){
exportEstimatePending=true;
return;
}
var formatElement=$('outputImageFormat');
var qualityElement=$('outputImageQuality');
var dpiElement=$('outputDpi');
var dpi=parseFloat(dpiElement?dpiElement.value:300);
if(!isFinite(dpi)||dpi<=0){
label.textContent='-';
label.title='';
return;
}
var format=formatElement?formatElement.value:'png';
var quality=qualityElement?qualityElement.value:0.92;
var multiplier=resolveExportMultiplierForDpi(dpi,canvas.width,canvas.height);
label.textContent='计算中…';
exportEstimateRunning=true;
// 直前の描画を先に反映させてから、同期処理の書き出しに入る。
setTimeout(function(){
var result=null;
try{
result=estimateExportSize(format,quality,multiplier,canvas.width,canvas.height);
}catch(error){
result=null;
}
exportEstimateRunning=false;
var node=$('outputImageEstimate');
if(!node)return;
if(!result){
node.textContent='-';
node.title='画布尺寸无法用于估算。';
}else{
var isUpperBound=result.upperBound!==null&&result.upperBound!==undefined;
node.textContent=(isUpperBound?'至多 ':'')+formatByteSize(result.bytes)+(isUpperBound?'':' 左右');
var dimension=Math.round(canvas.width*result.multiplier)+' x '+Math.round(canvas.height*result.multiplier);
var detail;
if(isUpperBound){
detail='当前画面接近纯色，压缩率无法从取样推断，因此给的是上限：'+formatByteSize(result.bytes)+' 以内。\n';
}else{
var range=formatByteSize(result.low)+' ~ '+formatByteSize(result.high);
detail='按当前设置导出约为 '+formatByteSize(result.bytes)+'（多数情况落在 '+range+'）。\n';
}
detail+='输出像素 '+dimension+'，格式 '+result.format.toUpperCase();
if(result.quality!==null&&result.quality!==undefined)detail+='，品质 '+Math.round(result.quality*100)+'%';
if(result.capped)detail+='。\n已触及导出上限，实际尺寸小于设定 DPI。';
node.title=detail;
}
if(exportEstimatePending){
exportEstimatePending=false;
scheduleExportSizeEstimate();
}
},0);
}

function scheduleExportSizeEstimate(delay){
if(exportEstimateTimer)clearTimeout(exportEstimateTimer);
exportEstimateTimer=setTimeout(function(){
exportEstimateTimer=null;
renderExportSizeEstimate();
},typeof delay==='number'?delay:350);
}

function syncExportSizeEstimate(){
bindExportPagePlanEvents();
var label=$('outputImageEstimate');
if(!label)return;
['outputImageFormat','outputImageQuality','outputDpi'].forEach(function(id){
var element=$(id);
if(!element||element.dataset.estimateBound)return;
element.dataset.estimateBound='1';
element.addEventListener('change',function(){scheduleExportSizeEstimate();});
element.addEventListener('input',function(){scheduleExportSizeEstimate();});
});
if(typeof canvas!=='undefined'&&canvas&&canvas.on){
['object:added','object:modified','object:removed'].forEach(function(eventName){
canvas.on(eventName,function(){scheduleExportSizeEstimate();});
});
}
scheduleExportSizeEstimate(600);
}

let canvasContinerScale=1;

function zoomPercent(){
return Math.round((viewUserScale||1)*100);
}

function updateZoomLabel(){
var pct=zoomPercent();
var text=pct+"%";
["naiZoomLabel","naiZoomLabelHeader"].forEach(function(id){
var node=$(id);
if(!node)return;
node.textContent=text;
node.title=pct===100?"当前是适应窗口。Ctrl+滚轮或 + − 可放大。不是原图像素 100%。":"画布缩放 "+pct+"%（相对适应窗口）";
});
}

function zoomBy(step,event){
var parent=getCanvasViewParent();
var container=$("canvas-container");
var oldScale=canvasContinerScale||1;
var canvasX=0;
var canvasY=0;
if(event&&container){
var box=container.getBoundingClientRect();
canvasX=(event.clientX-box.left)/oldScale;
canvasY=(event.clientY-box.top)/oldScale;
}
viewUserScale=Math.min(4,Math.max(0.25,(viewUserScale||1)+step));
fitCanvasViewToContainer(true);
if(event&&parent&&container){
var next=container.getBoundingClientRect();
parent.scrollLeft+=(next.left+canvasX*(canvasContinerScale||oldScale))-event.clientX;
parent.scrollTop+=(next.top+canvasY*(canvasContinerScale||oldScale))-event.clientY;
}
}

function zoomIn() {
zoomBy(0.15);
}

function zoomFit() {
viewUserScale=1;
fitCanvasViewToContainer(true);
var parent=getCanvasViewParent();
if(parent){
parent.scrollLeft=0;
parent.scrollTop=0;
}
}

function zoomOut() {
zoomBy(-0.15);
}

function currentCanvas(){
return typeof canvas!=="undefined"&&canvas?canvas:window.canvas;
}

function selectedPageId(current){
var object=current&&typeof current.getActiveObject==="function"?current.getActiveObject():null;
if(!object)return "";
if(object.simulatorPageId)return object.simulatorPageId;
if(object.type==="activeSelection"&&typeof object.getObjects==="function"){
var found="";
object.getObjects().some(function(item){
if(item&&item.simulatorPageId){found=item.simulatorPageId;return true;}
return false;
});
return found;
}
if(object.group&&object.group.simulatorPageId)return object.group.simulatorPageId;
return "";
}

function rememberPageId(pageId){
if(pageId&&window.NaiCanvasView)window.NaiCanvasView.lastPageId=pageId;
}

function rememberActiveContext(current){
if(!current)return;
var object=current.getActiveObject&&current.getActiveObject();
if(!object)return;
if(isMangaPanel(object)&&window.NaiCanvasView)window.NaiCanvasView.lastPanel=object;
var pageId=selectedPageId(current);
if(pageId)rememberPageId(pageId);
}

function resolveScalePageId(current,allowFallback){
var pageId=selectedPageId(current);
if(pageId){
rememberPageId(pageId);
return pageId;
}
if(!allowFallback){
var active=current&&current.getActiveObject&&current.getActiveObject();
if(active)return "";
}
var fallback=window.NaiCanvasView&&window.NaiCanvasView.lastPageId;
if(!fallback)return "";
var factory=window.NaiComicExtraRendererFactory;
if(factory&&typeof factory.pageObjects==="function"&&factory.pageObjects(current,fallback).length)return fallback;
return "";
}

function hintNeedSelection(message){
if(window.NaiBeginnerGuide&&typeof window.NaiBeginnerGuide.flashHelp==="function"){
window.NaiBeginnerGuide.flashHelp(message||"先点选画布上的模拟器或图层。");
}
}

function reselectPage(current,pageId){
var factory=window.NaiComicExtraRendererFactory;
if(current&&pageId&&factory&&typeof factory.selectPage==="function")factory.selectPage(current,pageId);
}

function scaleOneObject(obj,factor){
if(!obj||typeof obj.set!=="function")return;
var box=typeof obj.getBoundingRect==="function"?obj.getBoundingRect(true,true):null;
var ox=box?box.left+box.width/2:(Number(obj.left)||0);
var oy=box?box.top+box.height/2:(Number(obj.top)||0);
var left=Number(obj.left)||0;
var top=Number(obj.top)||0;
obj.set({
left:ox+(left-ox)*factor,
top:oy+(top-oy)*factor,
scaleX:(Number(obj.scaleX)||1)*factor,
scaleY:(Number(obj.scaleY)||1)*factor
});
if(typeof obj.setCoords==="function")obj.setCoords();
}

function scaleSelected(factor,allowFallback){
var current=currentCanvas();
if(!current)return false;
rememberActiveContext(current);
var factory=window.NaiComicExtraRendererFactory;
var pageId=resolveScalePageId(current,allowFallback===true);
if(typeof changeDoNotSaveHistory==="function")changeDoNotSaveHistory();
var ok=false;
if(pageId&&factory&&typeof factory.scalePage==="function"){
ok=factory.scalePage(current,pageId,factor);
if(ok)reselectPage(current,pageId);
}else{
var object=current.getActiveObject&&current.getActiveObject();
if(object&&object.type==="activeSelection"&&typeof object.getObjects==="function"){
object.getObjects().forEach(function(item){scaleOneObject(item,factor);});
ok=true;
}else if(object){
scaleOneObject(object,factor);
ok=true;
}
if(ok){
if(typeof current.requestRenderAll==="function")current.requestRenderAll();
else current.renderAll();
}
}
if(typeof changeDoSaveHistory==="function")changeDoSaveHistory();
if(ok&&typeof saveStateByManual==="function")saveStateByManual();
if(!ok)hintNeedSelection("先点选画布上的模拟器或图层，再放大缩小。");
return ok;
}

function isMangaPanel(item){
return !!(item&&item.isPanel&&!item.simulatorPageId&&item.simulatorRole!=="panel");
}

function panelBox(item){
if(!item)return null;
if(typeof item.getBoundingRect==="function")return item.getBoundingRect(true,true);
return null;
}

function resolveFitPanel(current,pageId){
var active=current.getActiveObject&&current.getActiveObject();
if(isMangaPanel(active))return active;
if(active&&active.type==="activeSelection"&&typeof active.getObjects==="function"){
var selectedPanel=null;
active.getObjects().some(function(item){
if(isMangaPanel(item)){selectedPanel=item;return true;}
return false;
});
if(selectedPanel)return selectedPanel;
}
var remembered=window.NaiCanvasView&&window.NaiCanvasView.lastPanel;
if(remembered&&typeof current.getObjects==="function"&&current.getObjects().indexOf(remembered)>=0&&isMangaPanel(remembered))return remembered;
return nearestMangaPanel(current,pageId);
}

function nearestMangaPanel(current,pageId){
var objects=typeof current.getObjects==="function"?current.getObjects():[];
var panels=objects.filter(isMangaPanel);
if(!panels.length)return null;
var factory=window.NaiComicExtraRendererFactory;
var bounds=pageId&&factory&&typeof factory.pageBounds==="function"?factory.pageBounds(current,pageId):null;
if(!bounds)return panels[0];
var cx=bounds.left+bounds.width/2;
var cy=bounds.top+bounds.height/2;
var best=null;
var bestScore=Infinity;
panels.forEach(function(panel){
var box=panelBox(panel);
if(!box)return;
var contained=cx>=box.left&&cx<=box.left+box.width&&cy>=box.top&&cy<=box.top+box.height;
var dx=(box.left+box.width/2)-cx;
var dy=(box.top+box.height/2)-cy;
var score=(dx*dx+dy*dy)+(contained?0:100000000);
if(score<bestScore){bestScore=score;best=panel;}
});
return best||panels[0];
}

function fitRectForPage(current,pageId){
var target=resolveFitPanel(current,pageId);
if(target){
var box=panelBox(target);
if(box&&box.width&&box.height){
var pad=Math.min(8,box.width*0.04,box.height*0.04);
return {left:box.left+pad,top:box.top+pad,width:Math.max(8,box.width-pad*2),height:Math.max(8,box.height-pad*2)};
}
}
return {left:40,top:40,width:Math.max(80,(Number(current.width)||1000)-80),height:Math.max(80,(Number(current.height)||1000)-80)};
}

function moveObjectToRect(object,rect,box){
if(!object||!rect||!box)return;
object.set({
left:(Number(object.left)||0)+(rect.left-box.left),
top:(Number(object.top)||0)+(rect.top-box.top)
});
if(typeof object.setCoords==="function")object.setCoords();
}

function fitSelected(){
var current=currentCanvas();
if(!current)return false;
rememberActiveContext(current);
var factory=window.NaiComicExtraRendererFactory;
var pageId=resolveScalePageId(current,true);
if(typeof changeDoNotSaveHistory==="function")changeDoNotSaveHistory();
var ok=false;
if(pageId&&factory&&typeof factory.fitPageToRect==="function"){
ok=factory.fitPageToRect(current,pageId,fitRectForPage(current,pageId));
if(ok)reselectPage(current,pageId);
}else{
var object=current.getActiveObject&&current.getActiveObject();
if(object){
var box=typeof object.getBoundingRect==="function"?object.getBoundingRect(true,true):null;
var rect=fitRectForPage(current,"");
if(box&&box.width&&box.height){
scaleOneObject(object,Math.min(rect.width/box.width,rect.height/box.height));
var next=typeof object.getBoundingRect==="function"?object.getBoundingRect(true,true):null;
if(next)moveObjectToRect(object,rect,next);
else object.set({left:rect.left,top:rect.top});
if(typeof object.setCoords==="function")object.setCoords();
ok=true;
if(typeof current.requestRenderAll==="function")current.requestRenderAll();
else current.renderAll();
}
}
}
if(typeof changeDoSaveHistory==="function")changeDoSaveHistory();
if(ok&&typeof saveStateByManual==="function")saveStateByManual();
if(!ok)hintNeedSelection("先点选画布上的模拟器，再贴合分镜。");
return ok;
}

function bindCanvasViewControls(){
var parent=getCanvasViewParent();
var host=$("canvas-area")||parent;
if(host&&host.getAttribute("data-nai-zoom-bound")!=="1"){
host.setAttribute("data-nai-zoom-bound","1");
host.addEventListener("wheel",function(event){
if(!(event.ctrlKey||event.metaKey))return;
if(event.target&&event.target.closest&&event.target.closest(".sim-studio-overlay,input,textarea,select"))return;
event.preventDefault();
if(event.altKey){
scaleSelected(event.deltaY<0?1.08:1/1.08);
return;
}
zoomBy(event.deltaY<0?0.12:-0.12,event);
},{passive:false});
}
if(document.documentElement.getAttribute("data-nai-zoom-doc")!=="1"){
document.documentElement.setAttribute("data-nai-zoom-doc","1");
document.addEventListener("wheel",function(event){
if(!(event.ctrlKey||event.metaKey))return;
if(!event.target||!event.target.closest||!event.target.closest(".sim-studio-overlay"))return;
event.preventDefault();
},{passive:false,capture:true});
}
var current=currentCanvas();
if(current&&typeof current.on==="function"&&current.__naiScaleBound!==true){
current.__naiScaleBound=true;
current.on("selection:created",function(){rememberActiveContext(current);});
current.on("selection:updated",function(){rememberActiveContext(current);});
}
function onClick(id,handler){
var node=$(id);
if(!node||node.getAttribute("data-bound")==="1")return;
node.setAttribute("data-bound","1");
node.addEventListener("click",handler);
}
onClick("naiZoomInBtn",function(){zoomIn();});
onClick("naiZoomOutBtn",function(){zoomOut();});
onClick("naiZoomFitBtn",function(){zoomFit();});
onClick("naiObjectBiggerBtn",function(){scaleSelected(1.12);});
onClick("naiObjectSmallerBtn",function(){scaleSelected(1/1.12);});
onClick("naiObjectFitBtn",function(){fitSelected();});
updateZoomLabel();
}

document.addEventListener("DOMContentLoaded",bindCanvasViewControls);

window.NaiCanvasView={
zoomIn:zoomIn,
zoomOut:zoomOut,
zoomFit:zoomFit,
zoomBy:zoomBy,
scaleSelected:scaleSelected,
fitSelected:fitSelected,
zoomPercent:zoomPercent,
updateZoomLabel:updateZoomLabel,
lastPageId:"",
lastPanel:null
};

function inputImageFile() {
$('imageInput').click();
}

document.addEventListener('DOMContentLoaded',function() {
$('imageInput').addEventListener('change',function(e) {
var files=e.target.files;
for (var i=0;i<files.length;i++) {
(function(file) {
var reader=new FileReader();
reader.onload=function(f) {
var data=f.target.result;
fabric.Image.fromURL(data,function(img) {

if (stateStack.length>2) {
canvasLogger.debug("imageInput stateStack.length > 2");
var scaleFactor=Math.min(canvas.width/img.width,canvas.height/img.height);
img.scale(scaleFactor);
canvas.add(img);
canvas.renderAll();
}else{
canvasLogger.debug("imageInput resizeCanvasByNum ");
addInitialImageToCanvas(img);
}
});
};
reader.readAsDataURL(file);
})(files[i]);
}
});
});



function changeView(elementId,isVisible) {
var element=$(elementId);
if (isVisible) {
element.style.display="block";
} else {
element.style.display="none";
}
adjustCanvasSize(true);
}
