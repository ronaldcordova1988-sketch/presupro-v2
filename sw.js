const CACHE_NAME = 'presupro-v4'; // MEJORA: Incrementamos a v4 para forzar actualización en Render/APK
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
            console.log('Caché v4 abierto correctamente');
            // MEJORA: Intentamos cachear todo, pero no bloqueamos si uno falla
            // Usamos un mapeo para intentar cachear cada recurso individualmente
            return Promise.all(
                urlsToCache.map(url => {
                    return cache.add(url).catch(err => console.warn(`Fallo al cachear: ${url}`, err));
                })
            );
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
self.addEventListener('fetch', (event) => {
    // Solo manejar peticiones GET
    if (event.request.method !== 'GET') return;

    // Evitar cachear llamadas externas de Firebase o analíticas
    if (event.request.url.includes('firestore.googleapis.com') || 
        event.request.url.includes('firebaseio.com') || 
        event.request.url.includes('googleapis.com/identitytoolkit')) return;
    
    // MEJORA: Evitar peticiones de extensiones de navegador (chrome-extension://) que rompen el caché
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // MEJORA: Si la respuesta es buena, guardamos una copia en el caché
                // Las respuestas de CDNs (Tailwind/Fonts) pueden ser 'opaque', las manejamos con cuidado
                if (response && response.status === 200) {
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
                    
                    // Si es una navegación (página principal), devolvemos el root cacheado
                    if (event.request.mode === 'navigate' || 
                       (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html'))) {
                        return caches.match('/');
                    }

                    // MEJORA: Fallback para imágenes fallidas en offline
                    if (event.request.destination === 'image') {
                        return caches.match('/icon-192.png');
                    }
                });
            })
    );
});