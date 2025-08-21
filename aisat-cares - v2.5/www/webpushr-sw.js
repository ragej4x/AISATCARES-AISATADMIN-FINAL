// This is a simple service worker implementation
self.addEventListener('install', function(event) {
    console.log('Service Worker installed');
    self.skipWaiting();
});

self.addEventListener('activate', function(event) {
    console.log('Service Worker activated');
    return self.clients.claim();
});

self.addEventListener('fetch', function(event) {
    // Just pass through all fetch events
    event.respondWith(fetch(event.request));
});