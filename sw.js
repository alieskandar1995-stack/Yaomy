// =====================================================
//  Service Worker لتطبيق "احسبلي+ · يومي"
//  الإصدار: v4.0.0 (محدث)
//  الاستراتيجية: تخزين مسبق + Stale-While-Revalidate
// =====================================================

const CACHE_NAME = 'hasbali-cache-v4';
const STATIC_ASSETS = [
  './',                          // يخزن index.html تلقائياً
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js'
];

// --- تثبيت الـ SW وتخزين الملفات الأساسية ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW v4] ✅ تخزين الملفات الأساسية...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW v4] ✅ التثبيت اكتمل بنجاح');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW v4] ❌ فشل التخزين (تأكد من وجود الأيقونات):', error);
      })
  );
});

// --- تفعيل الـ SW وتنظيف الكاشات القديمة ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            if (name !== CACHE_NAME) {
              console.log('[SW v4] 🗑️ حذف الكاش القديم:', name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW v4] ✅ التفعيل اكتمل، السيطرة على جميع الصفحات');
        return self.clients.claim();
      })
  );
});

// --- اعتراض الطلبات وتقديم المحتوى ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. استراتيجية خاصة للتنقل (الصفحات الرئيسية)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match(event.request)
        .then((cachedResponse) => {
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse.clone());
                });
              }
              return networkResponse;
            })
            .catch(() => {
              console.warn('[SW v4] ⚠️ الشبكة غير متوفرة، نخدم من الكاش فقط');
            });
          return cachedResponse || fetchPromise;
        })
    );
    return;
  }

  // 2. استراتيجية Stale-While-Revalidate للملفات الثابتة
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.warn('[SW v4] ⚠️ فشل جلب المورد:', event.request.url);
            if (!cachedResponse) {
              return new Response('⚠️ غير متاح حالياً', { status: 503 });
            }
            return null;
          });

        return cachedResponse || fetchPromise;
      })
  );
});

// --- الاستماع لرسائل التحديث ---
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
