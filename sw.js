const CACHE='classroll-production-v0.8.2';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icons/icon.svg','./icons/apple-touch-icon.png','./icons/icon-192.png','./icons/icon-512.png','./firebase-config.mjs','./firebase-sync.mjs'];

self.addEventListener('install',event=>{
  // Do not skip waiting automatically. The current app will detect this
  // waiting worker and show the user an "Update available" dialog.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('message',event=>{
  if(event.data && event.data.type==='SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);

  if(event.request.mode==='navigate'){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put('./index.html',copy));
          return response;
        })
        .catch(()=>caches.match(event.request).then(r=>r||caches.match('./index.html')))
    );
    return;
  }

  if(url.origin===self.location.origin){
    event.respondWith(
      caches.match(event.request).then(cached=>{
        const network=fetch(event.request).then(response=>{
          const copy=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,copy));
          return response;
        }).catch(()=>cached);
        return cached || network;
      })
    );
  }
});
