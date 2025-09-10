(async function(){
try{
const [questions, dimensions, rules] = await Promise.all([
fetchJSON(`${DATA_BASE}/questions.json`),
fetchJSON(`${DATA_BASE}/dimensions.json`),
fetchJSON(`${DATA_BASE}/rules.json`),
]);


console.log('[quiz] loaded files', {questions: questions.length, dimensions: dimensions.length, rules: rules.length});
window.quizDebug = {questions, dimensions, rules};
const dbg = document.createElement('div');
dbg.id='__quiz_dbg';
dbg.style.cssText='position:fixed;right:12px;bottom:12px;background:#000;color:#fff;padding:6px 10px;border-radius:8px;font:12px system-ui;opacity:.8;z-index:9999';
dbg.textContent = `Q:${questions.length}`;
document.body.appendChild(dbg);


const dimKeys = dimensions.map(d=>d.key);
let idx = 0;
let answers = loadState('quiz_answers', {});


const promptEl = document.getElementById('prompt');
const answersEl = document.getElementById('answers');
const progressEl = document.getElementById('progressbar');


function render(){
const q = questions[idx];
if(!q){ finish(); return; }


progressEl.style.width = `${Math.round((idx)/questions.length*100)}%`;
promptEl.innerHTML = `<h2>${q.prompt}</h2>`;
answersEl.innerHTML = '';


const backBtn = document.getElementById('backBtn');
const skipBtn = document.getElementById('skipBtn');
const nextBtn = document.getElementById('nextBtn');


})();