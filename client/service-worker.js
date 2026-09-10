const CACHE_NAME="face-attend-v1";

const FILES=[

"/",
"/attendance.html",
"/css/style.css",
"/js/attendance.js"

];

self.addEventListener("install",event=>{

event.waitUntil(

caches.open(CACHE_NAME)
.then(cache=>cache.addAll(FILES))

);

});

self.addEventListener("fetch",event=>{

event.respondWith(

caches.match(event.request)
.then(response=>response||fetch(event.request))

);

});