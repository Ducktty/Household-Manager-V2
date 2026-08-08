/* V2.7: 家当管家 Service Worker
   - 接收 push 通知
   - 处理点击 → 打开 app 到 home 页
   - 处理 push 关闭/错误
   注意:这个文件覆盖了 PushAlert 默认的 sw.js;
   它在 PushAlert SDK 加载之前被注册。
*/
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// 接收 push
self.addEventListener('push', (event) => {
  let data = { title: '🔔 待签到!检查今日库存', body: '你今天还没扣库存,记得打开 app 看看哪些产品待扣', icon: '/favicon.ico', url: '/' };
  try {
    if (event.data) {
      const text = event.data.text();
      try { data = { ...data, ...JSON.parse(text) }; } catch { data.body = text; }
    }
  } catch (e) {}
  const title = data.title || '家当管家';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: data.url || '/' },
    tag: 'jiadang-daily-checkin',
    renotify: true,
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// 点击通知
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
