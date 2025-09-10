const DATA_BASE = 'assets/data/quiz';


async function fetchJSON(path){
try{
const res = await fetch(path, {cache:'no-store'});
if(!res.ok) throw new Error(`HTTP ${res.status} for ${path}`);
const data = await res.json();
console.log('[fetchJSON] loaded', path, Array.isArray(data)?`(len ${data.length})`:'');
return data;
}catch(e){
console.error('[fetchJSON] failed', path, e);
if(location.protocol === 'file:'){
alert('Open via http(s), not file:// . Run a local server like: npx serve');
}
throw e;
}
}


function scaleValue(expr, val, min=1, max=7){
const m = String(expr).match(/scale\(\s*([-+0-9.]+)\s*,\s*([-+0-9.]+)\s*\)/i);
if(!m) return 0;
const a = parseFloat(m[1]), b = parseFloat(m[2]);
const pct = (val - min) / (max - min);
return a + (b - a) * pct;
}


function cosineSimilarity(a, b){
let dot=0, na=0, nb=0;
for(const k of Object.keys(a)){
const va = a[k]||0, vb = b[k]||0;
dot += va*vb; na += va*va; nb += vb*vb;
}
if(na===0||nb===0) return 0;
return dot / (Math.sqrt(na)*Math.sqrt(nb));
}


function saveState(key, obj){ localStorage.setItem(key, JSON.stringify(obj)); }
function loadState(key, fallback=null){ try{ return JSON.parse(localStorage.getItem(key)) ?? fallback; }catch(e){ return fallback; } }
function copyToClipboard(text){
const ta = document.createElement('textarea');
ta.value = text; document.body.appendChild(ta); ta.select();
document.execCommand('copy'); document.body.removeChild(ta);
}