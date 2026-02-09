const CACHE_NAME = 'presupro-v5'; // MEJORA: Incrementamos a v5 para asegurar la propagación de cambios
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/manifest.json',
    '/icon-192.png',
    '/icon-512.png',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;900&family=Playfair+Display:wght@700&family=Roboto+Mono&display=swap'
];

// Instalación: Almacena archivos críticos
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caché v5 abierto correctamente');
            return Promise.all(
                urlsToCache.map(url => {
                    // MEJORA: Añadimos cache-busting interno para la instalación inicial
                    const request = new Request(url, { cache: 'reload' });
                    return cache.add(request).catch(err => console.warn(`Fallo al cachear: ${url}`, err));
                })
            );
        })
    );
    self.skipWaiting();
});

// Activación: Limpia cachés antiguos
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
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    if (event.request.url.includes('firestore.googleapis.com') || 
        event.request.url.includes('firebaseio.com') || 
        event.request.url.includes('googleapis.com/identitytoolkit')) return;
    
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // MEJORA: Validación de respuesta básica para evitar cachear errores opacos
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then((res) => {
                    if (res) return res;
                    if (event.request.mode === 'navigate' || 
                       (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
                        return caches.match('/');
                    }
                    if (event.request.destination === 'image') {
                        return caches.match('/icon-192.png');
                    }
                });
            })
    );
});

// MEJORA: Manejo de mensajes para forzar actualización inmediata desde la UI
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});