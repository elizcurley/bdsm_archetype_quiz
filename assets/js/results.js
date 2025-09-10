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


const topDims = Object.entries(userVec).sort((a,b)=>b[1]-a[1]).slice(0,3);
const insights = [
`You lead with ${dimensions.find(d=>d.key===topDims[0][0]).label.toLowerCase()} (score ${topDims[0][1]}).`,
`You’re supported by ${dimensions.find(d=>d.key===topDims[1][0]).label.toLowerCase()} and ${dimensions.find(d=>d.key===topDims[2][0]).label.toLowerCase()}.`,
`Your ${primary.name.toLowerCase()} pattern colors how you approach closeness and intensity.`
];
const ul = document.getElementById('insights');
})();