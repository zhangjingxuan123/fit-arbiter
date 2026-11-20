/* 体测仲裁教练 v2 · Service Worker
   策略：
   1) 安装时只预缓存「小文件」（页面/图标/二维码库/验签库/引擎加载器），秒装好、立刻可控；
   2) 引擎大文件（wasm ~9MB、模型 ~9MB）在激活后台慢慢缓存，不阻塞安装；
   3) 运行期再兜一层：任何同源/镜像资源请求成功都进缓存；
   4) 页面导航走网络优先（保证更新立即生效），断网回缓存兜底。 */
const V='tzb2-2026-11-20i';
const ORIGIN=location.origin;
const SMALL=[
  './','manifest.json','icon-192.png','icon-512.png',
  'qrcode.js','jsQR.js','nacl-fast.min.js',
  'vision_bundle.mjs','vision_wasm_internal.js','vision_wasm_nosimd_internal.js'
];
const BIG=[
  'vision_wasm_internal.wasm','vision_wasm_nosimd_internal.wasm','pose_landmarker.task'
];
async function putAll(list){
  const c=await caches.open(V);
  for(const u of list){
    try{
      const req=new Request(u,{mode:/^https?:\/\/(registry|cdn|hf-mirror)/.test(u)?'no-cors':'same-origin'});
      const hit=await c.match(req,{ignoreVary:true});
      if(hit)continue;
      const r=await fetch(req,{cache:'default'});
      if(r&&(r.status===200||r.type==='opaque'))await c.put(req,r.clone());
    }catch(e){}
  }
}
self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    await putAll(SMALL);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const ks=await caches.keys();
    await Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)));
    await self.clients.claim();
    /* 大引擎文件后台慢慢缓存，不阻塞任何交互 */
    putAll(BIG);
  })());
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const cdn=(url.href.startsWith('https://registry.npmmirror.com/')||url.href.startsWith('https://cdn.jsdelivr.net/')||url.href.startsWith('https://hf-mirror.com/'));
  if(!cdn&&url.origin!==ORIGIN)return;
  if(url.pathname.endsWith('sw.js'))return;
  if(e.request.mode==='navigate'){
    e.respondWith((async()=>{
      const c=await caches.open(V);
      try{
        const ctl=new AbortController();const to=setTimeout(()=>ctl.abort(),3500);
        const r=await fetch(e.request,{signal:ctl.signal,cache:'reload'});
        clearTimeout(to);
        if(r&&r.status===200){try{c.put(e.request,r.clone())}catch(err){}}
        return r;
      }catch(err){
        return (await c.match(e.request,{ignoreVary:true}))||(await c.match('./',{ignoreVary:true}))||Response.error();
      }
    })());
    return;
  }
  e.respondWith((async()=>{
    const c=await caches.open(V);
    const hit=await c.match(e.request,{ignoreVary:true});
    if(hit)return hit;
    try{
      const r=await fetch(e.request);
      if(r&&(r.status===200||r.type==='opaque')){try{c.put(e.request,r.clone())}catch(err){}}
      return r;
    }catch(err){
      return hit||Response.error();
    }
  })());
});