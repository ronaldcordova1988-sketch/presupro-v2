const CACHE_NAME = 'presupro-v2'; // Incrementamos versión para forzar actualización
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;900&family=Playfair+Display:wght@700&family=Roboto+Mono&display=swap'
];

// Instalación: Almacena archivos críticos
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caché abierto correctamente');
            return cache.addAll(urlsToCache);
        })
    );
    // Fuerza al SW a activarse inmediatamente
    self.skipWaiting();
});

// Activación: Limpia cachés antiguos de versiones previas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Borrando caché antiguo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Estrategia: Network First (Red primero, si falla usa Caché)
// Es ideal para apps que manejan datos en tiempo real pero necesitan backup offline
self.addEventListener('fetch', (event) => {
    // Solo manejar peticiones GET (evita errores con llamadas a Firebase/POST)
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .catch(() => {
                return caches.match(event.request);
            })
    );
});