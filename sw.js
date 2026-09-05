/* 座位圖編輯器 Service Worker：離線快取
   策略：頁面（navigate）＝網路優先，離線才用快取 → 你更新 GitHub 後，線上裝置立即拿到新版；
   其他同源檔案（圖示等）＝快取優先。
   注意：每次更新網站時，請把下面的版本號改一下（例如 v2026-09-06.2 → .3），舊快取會自動清除。 */
var CACHE = "wb-seat-v2026-09-06.7";
var ASSETS = [
  "./",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
  "./favicon.svg",
  "./favicon-32.png",
  "./manifest.webmanifest"
];

self.addEventListener("install", function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(ASSETS.map(function(u){
        return c.add(u).catch(function(){ /* 個別檔案不存在時略過 */ });
      }));
    }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k !== CACHE; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

// 收到「立即更新」訊息：馬上交接給新版本
self.addEventListener("message", function(e){
  if(e.data && e.data.type==="SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  // 版本檢查請求（帶 __vchk）永遠走網路、不進快取，確保比對到伺服器上的最新檔
  var _url = new URL(req.url);
  if (_url.searchParams && _url.searchParams.has("__vchk")) {
    e.respondWith(fetch(req));
    return;
  }
  // 任何「要 HTML」的請求都走網路優先，離線才退回快取
  var isDoc = req.mode === "navigate" || req.destination === "document" ||
              ((req.headers.get("accept") || "").indexOf("text/html") > -1);
  if (isDoc) {
    e.respondWith(
      fetch(req).then(function(res){
        if (res && res.ok && !new URL(req.url).search) {   // 帶查詢字串的版本檢查不進快取
          var copy = res.clone();
          caches.open(CACHE).then(function(c){ c.put(req, copy); });
        }
        return res;
      }).catch(function(){
        return caches.match(req).then(function(hit){ return hit || caches.match("./"); });
      })
    );
    return;
  }
  // 同源靜態檔：快取優先
  var url = new URL(req.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(function(hit){
        if (hit) return hit;
        return fetch(req).then(function(res){
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE).then(function(c){ c.put(req, copy); });
          }
          return res;
        });
      })
    );
  }
});
