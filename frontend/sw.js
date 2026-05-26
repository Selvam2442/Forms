self.addEventListener('install', (e) => {
    console.log('[Service Worker] Installed');
});
self.addEventListener('fetch', (e) => {
    // Allows normal network fetching while satisfying PWA install requirements
});