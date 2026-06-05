const CACHE='afl-v5';
const ASSETS=['/','/index.html','/vsp.js','/ri.webp','/manifest.json','/icon-192.png','/icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  // Don't cache API calls or non-GET requests
  if(url.pathname.startsWith('/api/')||e.request.method!=='GET'){
    e.respondWith(fetch(e.request));
    return;
  }
  // Cache-first for assets
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{
    if(resp.ok&&resp.status<400){
      const cl=resp.clone();
      caches.open(CACHE).then(c=>c.put(e.request,cl));
    }
    return resp;
  }).catch(()=>caches.match('/index.html'))));
});
