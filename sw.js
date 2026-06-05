const CACHE='afl-v6';
const ASSETS=[
  '/',
  '/index.html',
  '/vsp.js',
  '/dashboard.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Assets, die im Hintergrund aktualisiert werden
const BACKGROUND_UPDATE=['ri.webp'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(ASSETS))
      .then(()=>self.skipWaiting())
      .catch(err=>{
        console.error('[SW] Install failed:',err);
        // Fallback: try to cache critical assets individually
        return caches.open(CACHE).then(c=>{
          return Promise.allSettled(
            ASSETS.map(asset=>c.add(asset).catch(()=>null))
          );
        });
      })
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys().then(ks=>
      Promise.all(ks.filter(k=>k!==CACHE).map(k=>{
        console.log('[SW] Deleting old cache:',k);
        return caches.delete(k);
      }))
    ).then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  
  // Skip API calls, non-GET, WebSockets
  if(url.pathname.startsWith('/api/')||e.request.method!=='GET'||url.protocol==='ws:'){
    e.respondWith(fetch(e.request).catch(()=>{
      if(url.pathname.startsWith('/api/sync')){
        // Return stub for offline sync
        return new Response(JSON.stringify({ok:false,offline:true}),{
          status:200,
          headers:{'Content-Type':'application/json'}
        });
      }
      throw new Error('Network error');
    }));
    return;
  }

  // R&I-Diagramm: stale-while-revalidate (important for big files)
  if(BACKGROUND_UPDATE.some(asset=>url.pathname.endsWith(asset))){
    e.respondWith(
      caches.match(e.request).then(cached=>{
        const fetchPromise=fetch(e.request).then(resp=>{
          if(resp.ok&&resp.status<400){
            const cl=resp.clone();
            caches.open(CACHE).then(c=>c.put(e.request,cl));
          }
          return resp;
        }).catch(()=>cached||new Response('Offline',{status:503}));
        
        return cached||fetchPromise;
      })
    );
    return;
  }

  // Assets & pages: cache-first, fallback to network
  e.respondWith(
    caches.match(e.request).then(cached=>{
      if(cached)return cached;
      
      return fetch(e.request).then(resp=>{
        if(!resp||resp.status>=400)return resp;
        
        const cl=resp.clone();
        caches.open(CACHE).then(c=>c.put(e.request,cl));
        return resp;
      }).catch(()=>{
        // Offline fallback
        if(e.request.destination==='document'){
          return caches.match('/index.html');
        }
        return new Response('Offline',{status:503});
      });
    })
  );
});

// Message handler for cache management
self.addEventListener('message',e=>{
  if(e.data.action==='SKIP_WAITING'){
    self.skipWaiting();
  }
  if(e.data.action==='CLEAR_CACHE'){
    caches.delete(CACHE).then(()=>{
      e.ports[0].postMessage({success:true});
    });
  }
});
