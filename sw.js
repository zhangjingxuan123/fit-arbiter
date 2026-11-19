/* 体测仲裁教练 v2 · Service Worker：首次安装预缓存引擎，此后判定/计分/签名/导出全程离线 */
const V='tzb2-2026-11-19b';
const ORIGIN=location.origin;
const PRECACHE=[
  './','manifest.json','icon-192.png','icon-512.png',
  'pose.js','qrcode.js','jsQR.js','pose_landmark_lite.tflite',
  'https://registry.npmmirror.com/@mediapipe/pose/0.5.1675469404/files/pose.js',
  'https://registry.npmmirror.com/@mediapipe/pose/0.5.1675469404/files/pose_landmark_lite.tflite',
  'https://registry.npmmirror.com/qrcode-generator/1.4.4/files/qrcode.js',
  'https://registry.npmmirror.com/jsqr/1.4.0/files/dist/jsQR.js'
];
self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(V);
    await Promise.allSettled(PRECACHE.map(async u=>{
      const req=new Request(u,{mode:/^https?:\/\/(registry|cdn)/.test(u)?'no-cors':'same-origin',cache:'reload'});
      try{await c.add(req)}catch(err){}
    }));
    /* 两个可能的主页路径都缓存（本地服务把 / 映射为中文名页面） */
    for(const p of ['体测仲裁教练.html','index.html']){
      try{await c.add(new Request('./'+p,{cache:'reload'}))}catch(err){}
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const ks=await caches.keys();
    await Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const cdn=(url.href.startsWith('https://registry.npmmirror.com/')||url.href.startsWith('https://cdn.jsdelivr.net/'));
  const same=url.origin===ORIGIN;
  if(!cdn&&!same)return;
  if(url.pathname.endsWith('sw.js'))return;
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