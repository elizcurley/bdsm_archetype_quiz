
(async function(){
  const [dimensions, archetypes, kinkmap] = await Promise.all([
    fetchJSON(`${DATA_BASE}/dimensions.json`),
    fetchJSON(`${DATA_BASE}/archetypes.json`),
    fetchJSON(`${DATA_BASE}/kink_translation.json`),
  ]);

  const res = loadState('quiz_result', null);
  if(!res){
    document.getElementById('profileCard').innerHTML = '<p>No results found. Take the quiz first.</p>';
    return;
  }

  const userVec = res.dimensions;
  // Archetype similarity
  let scored = archetypes.map(a=>{
    const sim = cosineSimilarity(userVec, a.dimension_profile);
    return {...a, sim};
  }).sort((x,y)=>y.sim-x.sim);

  const primary = scored[0], secondary = scored[1];

  document.getElementById('primaryTitle').textContent = `${primary.name}`;
  document.getElementById('primaryDesc').textContent = primary.long || primary.short || '';
  document.getElementById('secondaryTitle').textContent = `Secondary Influence: ${secondary.name}`;
  document.getElementById('secondaryDesc').textContent = secondary.short || '';

  const affirmation = (primary.affirmations||[])[0] || 'You are allowed to want what you want.';
  document.getElementById('affirmation').textContent = affirmation;

  // Insights (simple demo: top 3 high dimensions)
  const topDims = Object.entries(userVec).sort((a,b)=>b[1]-a[1]).slice(0,3);
  const insights = [
    `You lead with ${dimensions.find(d=>d.key===topDims[0][0]).label.toLowerCase()} (score ${topDims[0][1]}).`,
    `You’re supported by ${dimensions.find(d=>d.key===topDims[1][0]).label.toLowerCase()} and ${dimensions.find(d=>d.key===topDims[2][0]).label.toLowerCase()}.`,
    `Your ${primary.name.toLowerCase()} pattern colors how you approach closeness and intensity.`
  ];
  const ul = document.getElementById('insights');
  insights.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; ul.appendChild(li); });

  // Reflections (stub from archetype)
  const refl = (primary.reflection_questions?.general||[]).slice(0,2).concat((primary.reflection_questions?.sexual||[]).slice(0,2));
  const reflUl = document.getElementById('reflections');
  if(refl.length){
    refl.forEach(t=>{ const li=document.createElement('li'); li.textContent=t; reflUl.appendChild(li); });
  }else{
    const li=document.createElement('li'); li.textContent='What helps you feel both held and free at the same time?'; reflUl.appendChild(li);
  }

  // Radar chart
  const labels = dimensions.map(d=>d.label);
  const dataVals = dimensions.map(d=>userVec[d.key]||0);
  const ctx = document.getElementById('spider');
  new Chart(ctx, {
    type: 'radar',
    data: { labels, datasets:[{ label:'You', data:dataVals, fill:true }]},
    options: { responsive:true, scales:{ r:{ beginAtZero:true, max:100 } } }
  });

  // Badges
  const badgeWrap = document.getElementById('dimensionBadges');
  Object.entries(userVec).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>{
    const d = dimensions.find(x=>x.key===k);
    const span = document.createElement('span'); span.className='badge'; span.textContent=`${d.label}: ${v}`;
    badgeWrap.appendChild(span);
  });

  // Kink Translation
  const flags = new Set(res.flags);
  const tbody = document.querySelector('#kinkTable tbody');
  const applied = kinkmap.filter(entry => (entry.maps_from_flags||[]).some(f=>flags.has(f)));
  if(applied.length===0){
    const tr=document.createElement('tr');
    const td=document.createElement('td'); td.colSpan=5; td.textContent='No specific pathways triggered. Your profile suggests starting with collaborative design and gentle pacing.';
    tr.appendChild(td); tbody.appendChild(tr);
  }else{
    applied.forEach(entry=>{
      const tr=document.createElement('tr');
      function tdTxt(t){ const td=document.createElement('td'); td.textContent=t; return td; }
      tr.appendChild(tdTxt(entry.key.replace(/_/g,' ')));
      tr.appendChild(tdTxt((entry.suggests?.practices||[]).join('; ')));
      tr.appendChild(tdTxt((entry.suggests?.roles||[]).join('; ')));
      tr.appendChild(tdTxt((entry.suggests?.safety_notes||[]).join('; ')));
      tr.appendChild(tdTxt((entry.suggests?.starter_scenes||[]).join('; ')));
      tbody.appendChild(tr);
    });
  }

  // Export + resume
  document.getElementById('exportBtn').onclick = ()=>{ window.print(); };
  document.getElementById('copyState').onclick = ()=>{
    const payload = JSON.stringify({answers: loadState('quiz_answers', {}), result: res});
    copyToClipboard(btoa(payload));
    alert('Resume code copied!');
  };
})();
