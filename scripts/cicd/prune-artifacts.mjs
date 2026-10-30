// Bound storage for this pipeline only. Rollback uses Cloudflare deployment IDs,
// not expired GitHub archives. Never touch other workflows' artifacts.
const repo=process.env.GITHUB_REPOSITORY;if(repo!=='polymaths-org/zexvro')throw Error('Unexpected repository');
const headers={Authorization:'Bearer '+process.env.GH_TOKEN,Accept:'application/vnd.github+json'};
async function api(path,method='GET'){const r=await fetch(`https://api.github.com/repos/${repo}${path}`,{method,headers,signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Artifact maintenance failed: '+r.status);return method==='DELETE'?null:r.json()}
const own=[];for(let page=1;page<=10;page++){const {artifacts}=await api(`/actions/artifacts?per_page=100&page=${page}`);own.push(...artifacts.filter(a=>/^(candidate|checked)-[a-f0-9]{40}-\d+-\d+$/.test(a.name)));if(artifacts.length<100)break}
for(const [prefix,keep] of [['candidate-',3],['checked-',1]]){
 const group=own.filter(a=>a.name.startsWith(prefix)).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 for(const a of group.slice(keep))await api('/actions/artifacts/'+a.id,'DELETE');
}
console.log('Release artifact retention enforced: latest three candidates and one checked build');
