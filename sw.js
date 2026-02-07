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
            // Usamos cache.addAll pero con un catch para evitar que un solo archivo rompa la instalación
            return cache.addAll(urlsToCache).catch(err => console.warn('Fallo al cachear algunos recursos:', err));
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

// Estrategia: Network First con fallback a Caché
// Optimizada para manejar errores de red y asegurar disponibilidad offline
self.addEventListener('fetch', (event) => {
    // Solo manejar peticiones GET
    if (event.request.method !== 'GET') return;

    // Evitar cachear llamadas externas de Firebase o analíticas si las tuvieras
    if (event.request.url.includes('firestore.googleapis.com')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Si la respuesta es válida, la clonamos y la guardamos en el caché (Opcional: Actualización dinámica)
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // Si falla la red (offline), buscamos en el caché
                return caches.match(event.request).then((res) => {
                    if (res) return res;
                    
                    // Si no está en caché y es una navegación (página), mostrar index.html
                    if (event.request.mode === 'navigate') {
                        return caches.match('/');
                    }
                });
            })
    );
});