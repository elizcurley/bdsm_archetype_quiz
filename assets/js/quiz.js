
(async function(){
  // Load data
  const [questions, dimensions, rules] = await Promise.all([
    fetchJSON(`${DATA_BASE}/questions.json`),
    fetchJSON(`${DATA_BASE}/dimensions.json`),
    fetchJSON(`${DATA_BASE}/rules.json`),
  ]);

  const dimKeys = dimensions.map(d=>d.key);
  let idx = 0;
  let answers = loadState('quiz_answers', {});

  const promptEl = document.getElementById('prompt');
  const answersEl = document.getElementById('answers');
  const progressEl = document.getElementById('progressbar');

  function render(){
    const q = questions[idx];
    if(!q){ finish(); return; }
    promptEl.innerHTML = `<h2>${q.prompt}</h2>`;
    answersEl.innerHTML = '';

    // progress
    progressEl.style.width = `${Math.round((idx)/questions.length*100)}%`;

    if(q.type==='scale'){
      const wrap = document.createElement('div');
      wrap.innerHTML = `
        <div class="small">${q.scale.left}</div>
        <input id="slider" type="range" min="${q.scale.min}" max="${q.scale.max}" step="1" value="${answers[q.id]?.value ?? Math.ceil((q.scale.min+q.scale.max)/2)}" style="width:100%"/>
        <div class="small" style="text-align:right">${q.scale.right}</div>
      `;
      answersEl.appendChild(wrap);
    }
    else if(q.type==='single' || q.type==='multi'){
      (q.options||[]).forEach((opt, i)=>{
        const div = document.createElement('div'); div.className='option';
        div.textContent = opt.label;
        const selected = answers[q.id]?.indices || [];
        if(selected.includes(i)) div.classList.add('selected');
        div.onclick = ()=>{
          if(q.type==='single'){
            answers[q.id]={indices:[i]};
            [...answersEl.querySelectorAll('.option')].forEach(n=>n.classList.remove('selected'));
            div.classList.add('selected');
          }else{ // multi
            let arr = answers[q.id]?.indices || [];
            if(arr.includes(i)){
              arr = arr.filter(x=>x!==i);
            }else{
              if(q.max_select && arr.length>=q.max_select) return;
              arr.push(i);
            }
            answers[q.id]={indices:arr};
            div.classList.toggle('selected');
          }
          saveState('quiz_answers', answers);
        };
        answersEl.appendChild(div);
      });
    }
    else if(q.type==='open'){
      const ta = document.createElement('textarea');
      ta.style.width='100%'; ta.style.minHeight='120px';
      ta.placeholder = 'Type here (optional)…';
      ta.value = answers[q.id]?.text || '';
      ta.oninput = ()=>{ answers[q.id]={text:ta.value}; saveState('quiz_answers', answers); };
      answersEl.appendChild(ta);
    }

    // nav
    document.getElementById('backBtn').onclick = ()=>{ if(idx>0){ idx--; render(); } };
    document.getElementById('skipBtn').onclick = ()=>{ idx=Math.min(idx+1, questions.length); render(); };
    document.getElementById('nextBtn').onclick = ()=>{
      // capture scale value
      const q2 = questions[idx];
      if(q2.type==='scale'){
        const v = parseInt(document.getElementById('slider').value,10);
        answers[q2.id] = { value:v };
        saveState('quiz_answers', answers);
      }
      idx++; render();
    };
  }

  function applyWeightsAndRules(){
    const dims = Object.fromEntries(dimKeys.map(k=>[k,0]));
    let flags = new Set();
    // 1) apply direct weights/boosts
    for(const q of questions){
      const a = answers[q.id];
      if(!a) continue;
      if(q.type==='scale' && q.weights){
        for(const [k,expr] of Object.entries(q.weights)){
          if(!dimKeys.includes(k)) continue;
          dims[k] += scaleValue(expr, a.value, q.scale.min, q.scale.max);
        }
      }
      if((q.type==='single'||q.type==='multi') && a.indices){
        for(const i of a.indices){
          const opt = (q.options||[])[i];
          if(!opt) continue;
          if(opt.boosts){
            for(const [k,v] of Object.entries(opt.boosts)){
              if(dimKeys.includes(k)) dims[k]+=v;
            }
          }
          if(opt.kink_flags){
            opt.kink_flags.forEach(f=>flags.add(f));
          }
        }
      }
      if(q.type==='open' && q.nlp && a.text){
        const txt = a.text.toLowerCase();
        const keysets = q.nlp.keysets || {};
        for(const rule of (q.nlp.map||[])){
          if(rule.if_any){
            const arr = keysets[rule.if_any]||[];
            const hit = arr.some(kw => txt.includes(kw.lower() if False else kw.lower()) )

          if(rule.if_any):
            const arr = (q.nlp.keysets || {})[rule.if_any] || [];
            const hit = arr.some(kw => txt.includes(String(kw).lower()));
            if(hit){
              if(rule.boosts){
                for(const [k,v] of Object.entries(rule.boosts)){
                  if(dimKeys.includes(k)) dims[k]+=v;
                }
              }
              if(rule.kink_flags_add){
                rule.kink_flags_add.forEach(f=>flags.add(f));
              }
            }
          }
        }
      }
    }

    // 2) apply global rules
    function dimVal(k){ return dims[k] ?? 0; }
    function anySelected(ref){
      // expect "id.option[Label]" form
      const m = ref.match(/^([^\.]+)\.option\[(.+)\]$/);
      if(!m) return false;
      const qid = m[1], label = m[2];
      const q = questions.find(x=>x.id===qid);
      if(!q) return false;
      const idx = (q.options||[]).findIndex(o=>o.label===label);
      const a = answers[qid];
      return !!(a && a.indices && a.indices.includes(idx));
    }

    for(const rule of rules){
      let conditionMet = false;
      if(rule.when){
        // any_selected
        if(rule.when.any_selected){
          conditionMet = (rule.when.any_selected||[]).some(r=>anySelected(r));
        }
        // dimensions_high {key: threshold}
        if(!conditionMet && rule.when.dimensions_high){
          const [k,thr] = Object.entries(rule.when.dimensions_high)[0];
          conditionMet = dimVal(k) >= thr;
        }
        // dimensions_high_all [key:thr, ...]
        if(!conditionMet && rule.when.dimensions_high_all){
          conditionMet = (rule.when.dimensions_high_all||[]).every(obj=>{
            const [k,thr] = Object.entries(obj)[0];
            return dimVal(k) >= thr;
          });
        }
      }
      if(conditionMet){
        if(rule.then?.weights){
          for(const [k,v] of Object.entries(rule.then.weights)){
            if(dimKeys.includes(k)) dims[k]+=v;
          }
        }
        if(rule.then?.flags_add){
          rule.then.flags_add.forEach(f=>flags.add(f));
        }
        if(rule.then?.kink_flags_add){
          rule.then.kink_flags_add.forEach(f=>flags.add(f));
        }
      }
    }

    // Normalize to 0-100 radar-ish
    // Simple min/max clamp + scale; here we assume practical range -3..+3
    const outDims = {};
    for(const k of dimKeys){
      const raw = dims[k];
      const clamped = Math.max(-3, Math.min(3, raw));
      outDims[k] = Math.round((clamped + 3) / 6 * 100);
    }
    return { dimensions: outDims, flags: Array.from(flags) };
  }

  function finish(){
    // compute + save state
    const computed = applyWeightsAndRules();
    saveState('quiz_result', computed);
    saveState('quiz_answers', answers);
    location.href = 'results.html';
  }

  // Resume
  const saved = loadState('quiz_answers', null);
  if(saved) answers = saved;

  render();
})();
