
(async function(){
  // Load data
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

      // progress
      progressEl.style.width = `${Math.round((idx)/questions.length*100)}%`;

      // prompt
      promptEl.innerHTML = `<h2>${q.prompt}</h2>`;
      answersEl.innerHTML = '';

      // controls
      const backBtn = document.getElementById('backBtn');
      const skipBtn = document.getElementById('skipBtn');
      const nextBtn = document.getElementById('nextBtn');

      if(q.type==='scale'){
        const val = (answers[q.id]?.value ?? Math.ceil((q.scale.min+q.scale.max)/2));
        const wrap = document.createElement('div');
        wrap.innerHTML = `
          <div class="small">${q.scale.left}</div>
          <input id="slider" type="range" min="${q.scale.min}" max="${q.scale.max}" step="1" value="${val}" style="width:100%"/>
          <div class="small" style="text-align:right">${q.scale.right}</div>
        `;
        answersEl.appendChild(wrap);
      }
      else if(q.type==='single' || q.type==='multi'){
        const selected = answers[q.id]?.indices || [];
        (q.options||[]).forEach((opt, i)=>{
          const div = document.createElement('div');
          div.className='option';
          div.textContent = opt.label;
          if(selected.includes(i)) div.classList.add('selected');
          div.onclick = ()=>{
            if(q.type==='single'){
              answers[q.id]={indices:[i]};
              [...answersEl.querySelectorAll('.option')].forEach(n=>n.classList.remove('selected'));
              div.classList.add('selected');
            }else{
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

      backBtn.onclick = ()=>{ if(idx>0){ idx--; render(); } };
      skipBtn.onclick = ()=>{ idx = Math.min(idx+1, questions.length); render(); };
      nextBtn.onclick = ()=>{
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

      // 1) direct weights/boosts
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
            if(opt.kink_flags){ (opt.kink_flags||[]).forEach(f=>flags.add(f)); }
          }
        }

        // Open-text NLP-lite
        if(q.type==='open' && q.nlp && a.text){
          const txt = a.text.toLowerCase();
          const keysets = q.nlp.keysets || {};
          for(const rule of (q.nlp.map||[])){
            if(rule.if_any){
              const arr = keysets[rule.if_any] || [];
              const hit = arr.some(kw => txt.includes(String(kw).toLowerCase()));
              if(hit){
                if(rule.boosts){
                  for(const [k,v] of Object.entries(rule.boosts)){
                    if(dimKeys.includes(k)) dims[k]+=v;
                  }
                }
                if(rule.kink_flags_add){
                  (rule.kink_flags_add||[]).forEach(f=>flags.add(f));
                }
              }
            }
          }
        }
      }

      // 2) global rules
      function dimVal(k){ return dims[k] ?? 0; }
      function anySelected(ref){
        // "id.option[Label]"
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
          if(rule.when.any_selected){
            conditionMet = (rule.when.any_selected||[]).some(r=>anySelected(r));
          }
          if(!conditionMet && rule.when.dimensions_high){
            const [k,thr] = Object.entries(rule.when.dimensions_high)[0];
            conditionMet = dimVal(k) >= thr;
          }
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
          if(rule.then?.flags_add){ rule.then.flags_add.forEach(f=>flags.add(f)); }
          if(rule.then?.kink_flags_add){ rule.then.kink_flags_add.forEach(f=>flags.add(f)); }
        }
      }

      // Normalize dims to 0–100 (assume useful range ~ -3..+3)
      const outDims = {};
      for(const k of dimKeys){
        const raw = dims[k];
        const clamped = Math.max(-3, Math.min(3, raw));
        outDims[k] = Math.round((clamped + 3) / 6 * 100);
      }
      return { dimensions: outDims, flags: Array.from(flags) };
    }

    function finish(){
    if(!questions || !questions.length){
      console.warn('[quiz] finish() called with no questions; staying on page.');
      const card = document.getElementById('qcard');
      if(card){ card.insertAdjacentHTML('beforeend','<p class="small" style="color:#b00">No questions loaded — not redirecting.</p>'); }
      return;
    }
      const computed = applyWeightsAndRules();
      saveState('quiz_result', computed);
      saveState('quiz_answers', answers);
      location.href = 'results.html';
    }

    // Resume
    const saved = loadState('quiz_answers', null);
    if(saved) answers = saved;

    render();
  }catch(e){
    console.error("[quiz] failed to initialize:", e);
    const card = document.getElementById('qcard');
    if(card){
      card.innerHTML = `<p>Something went wrong loading the quiz data. Open the console for details.</p>`;
    }
  }
})();
