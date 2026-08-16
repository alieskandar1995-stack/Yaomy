// =====================================================
//  Service Worker لتطبيق "احسبلي+ · يومي"
//  الإصدار: v1.0.0
//  الاستراتيجية: تخزين مسبق للأساسيات + Stale-While-Revalidate
// =====================================================

const CACHE_NAME = 'hasbali-cache-v1';
const STATIC_ASSETS = [
  '/احسبلي.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js'
];

// --- تثبيت الـ SW وتخزين الملفات الأساسية ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] ✅ تخزين الملفات الأساسية...');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] ✅ التثبيت اكتمل بنجاح');
        return self.skipWaiting(); // تفعيل الـ SW فوراً
      })
      .catch((error) => {
        console.error('[SW] ❌ فشل التخزين:', error);
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
              console.log('[SW] 🗑️ حذف الكاش القديم:', name);
              return caches.delete(name);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] ✅ التفعيل اكتمل، السيطرة على جميع الصفحات');
        return self.clients.claim(); // يسيطر على الصفحات المفتوحة فوراً
      })
  );
});

// --- اعتراض الطلبات وتقديم المحتوى ---
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. استراتيجية خاصة لملف HTML (يُخدم من الكاش أولاً، ثم يُحدث في الخلفية)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      caches.match('/احسبلي.html')
        .then((cachedResponse) => {
          // إعادة الملف المخبأ فوراً
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              // تحديث الكاش في الخلفية
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put('/احسبلي.html', networkResponse.clone());
                });
              }
              return networkResponse;
            })
            .catch(() => {
              console.warn('[SW] ⚠️ الشبكة غير متوفرة، نخدم من الكاش فقط');
            });
          return cachedResponse || fetchPromise;
        })
    );
    return;
  }

  // 2. استراتيجية Stale-While-Revalidate للملفات الثابتة (JS, CSS, Images, CDN)
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // تحديث الكاش بنسخة جديدة من الشبكة
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.warn('[SW] ⚠️ فشل جلب المورد:', event.request.url);
            // إذا كان الملف غير موجود في الكاش نهائياً، نعيد خطأ
            if (!cachedResponse) {
              return new Response('⚠️ غير متاح حالياً', { status: 503 });
            }
            return null;
          });

        // إذا وجد في الكاش، أعده فوراً، وإلا انتظر النتيجة من الشبكة
        return cachedResponse || fetchPromise;
      })
  );
});

// --- الاستماع لرسائل من التطبيق (لتحديث إصدار الكاش عند الحاجة) ---
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});