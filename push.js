/* V2.7: VAPID 每日签到提醒(自建)
   - 客户端用 VAPID 公钥订阅
   - 订阅信息存 Supabase push_subscriptions
   - 偏好(时间)存 push_preferences
   - Vercel Cron 每 5 分钟跑 api/cron.js,按时推 */
(function () {
  const PUSH_KEY = 'jiadang_push_enabled';
  const PUSH_TIME = 'jiadang_push_time';
  const PUSH_TIP = 'jiadang_push_tip_shown';

  function getCfg() {
    return window.JD_CONFIG || {};
  }

  function isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  /* VAPID 公钥是 base64 字符串,转 Uint8Array 给浏览器 */
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
    return output;
  }

  function getSupabase() {
    return window.supabaseClient;
  }

  async function getUserId() {
    const sb = getSupabase();
    if (!sb) throw new Error('Supabase 未初始化');
    const { data, error } = await sb.auth.getUser();
    if (error || !data?.user) throw new Error('未登录,无法订阅');
    return data.user.id;
  }

  /* 订阅 VAPID push,存到 Supabase */
  async function subscribeVAPID() {
    const cfg = getCfg();
    if (!cfg.VAPID_PUBLIC_KEY) throw new Error('VAPID 公开 key 未配置');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(cfg.VAPID_PUBLIC_KEY),
      });
    }
    const json = sub.toJSON();
    const userId = await getUserId();
    const sb = getSupabase();
    const { error } = await sb.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    }, { onConflict: 'endpoint' });
    if (error) throw new Error('存订阅失败:' + error.message);
    console.log('[push] VAPID subscribed');
    return sub;
  }

  async function unsubscribeVAPID() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      const json = sub.toJSON();
      await sub.unsubscribe();
      // 删 Supabase 记录
      try {
        const sb = getSupabase();
        if (sb) await sb.from('push_subscriptions').delete().eq('endpoint', json.endpoint);
      } catch (e) { console.warn(e); }
    }
  }

  /* 偏好(时间)写 Supabase */
  async function savePreference(enabled, time) {
    try {
      const sb = getSupabase();
      if (!sb) return;
      const userId = await getUserId();
      await sb.from('push_preferences').upsert({
        user_id: userId,
        push_enabled: enabled,
        push_time: time || '21:00',
        push_tz: 'Asia/Shanghai',
        updated_at: new Date().toISOString(),
        // 改时间后清 last_pushed,允许今天再推一次
        last_pushed: null,
      }, { onConflict: 'user_id' });
    } catch (e) { console.warn('[push] save pref', e); }
  }

  /* 从 Supabase 拉偏好(用于多设备同步) */
  async function loadPreference() {
    try {
      const sb = getSupabase();
      if (!sb) return null;
      const userId = await getUserId();
      const { data } = await sb.from('push_preferences')
        .select('*').eq('user_id', userId).maybeSingle();
      return data;
    } catch (e) { return null; }
  }

  /* 启用每日提醒 */
  async function enableReminder() {
    if (!isSupported()) {
      toast('当前浏览器不支持推送(建议 Chrome / Edge)');
      return false;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'denied') {
      toast('通知权限被拒,请在浏览器设置里允许');
      return false;
    }
    if (perm !== 'granted') {
      toast('未授权,无法开启');
      return false;
    }
    try {
      await subscribeVAPID();
    } catch (e) {
      console.warn(e);
      // 没登录时也能用本地通知(等登录后再补订阅)
      if (!/未登录/.test(e.message)) {
        toast('订阅失败:' + e.message);
        return false;
      }
    }
    const time = localStorage.getItem(PUSH_TIME) || '21:00';
    localStorage.setItem(PUSH_KEY, '1');
    await savePreference(true, time);
    showTestNotification();
    toast('已开启每日提醒');
    return true;
  }

  /* 关闭每日提醒 */
  async function disableReminder() {
    try { await unsubscribeVAPID(); } catch (e) {}
    localStorage.removeItem(PUSH_KEY);
    try { await savePreference(false, '21:00'); } catch (e) {}
    toast('已关闭每日提醒');
  }

  /* 发送一条测试通知(本地) */
  async function showTestNotification() {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('家当管家', {
        body: '🔔 每日提醒已开启!明天 ' + (localStorage.getItem(PUSH_TIME) || '21:00') + ' 自动推送',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'jiadang-test',
      });
    } catch (e) { console.warn(e); }
  }

  /* UI 初始化 */
  async function initSettingsUI() {
    const toggle = document.getElementById('push-toggle');
    const timeInput = document.getElementById('push-time-input');
    const statusText = document.getElementById('push-status-text');
    const statusSub = document.getElementById('push-status-sub');
    if (!toggle) return;

    // 先看 local 缓存
    let localEnabled = localStorage.getItem(PUSH_KEY) === '1';
    let localTime = localStorage.getItem(PUSH_TIME) || '21:00';

    // 登录了从云端拉(覆盖本地)
    if (window.supabaseClient) {
      try {
        const { data: { user } } = await window.supabaseClient.auth.getUser();
        if (user) {
          const pref = await loadPreference();
          if (pref) {
            localEnabled = !!pref.push_enabled;
            localTime = pref.push_time || '21:00';
            localStorage.setItem(PUSH_KEY, localEnabled ? '1' : '');
            localStorage.setItem(PUSH_TIME, localTime);
          }
        }
      } catch (e) { /* 离线时用本地 */ }
    }

    if (timeInput) timeInput.value = localTime;
    toggle.checked = localEnabled;

    function refresh() {
      const enabled = toggle.checked;
      const time = (timeInput && timeInput.value) || localTime;
      if (!isSupported()) {
        statusText.textContent = '当前浏览器不支持推送';
        statusSub.textContent = '建议用 Chrome / Edge / Firefox';
        toggle.disabled = true;
      } else if (enabled) {
        statusText.textContent = '每日提醒已开启';
        statusSub.textContent = `明天 ${time} 自动推送`;
      } else {
        statusText.textContent = '每日提醒未开启';
        statusSub.textContent = `开启后每日 ${time} 推送`;
      }
    }
    refresh();

    toggle.addEventListener('change', async () => {
      if (toggle.checked) {
        const ok = await enableReminder();
        if (!ok) toggle.checked = false;
      } else {
        await disableReminder();
      }
      refresh();
    });

    if (timeInput) {
      timeInput.addEventListener('change', async () => {
        const v = timeInput.value || '21:00';
        localStorage.setItem(PUSH_TIME, v);
        await savePreference(toggle.checked, v);
        toast('提醒时间已设为 ' + v + (toggle.checked ? ' (云端已同步)' : ''));
        if (!localStorage.getItem(PUSH_TIP)) {
          showPushAlertTip();
          localStorage.setItem(PUSH_TIP, '1');
        }
        refresh();
      });
    }
  }

  function showPushAlertTip() {
    if (typeof showModal !== 'function') return;
    showModal({
      title: '⏰ 推送时间已修改',
      body: '<p style="margin-bottom:8px;">提醒时间已存到云端,跨设备同步。</p>' +
            '<p style="color:var(--ink-2); font-size:13px;">Vercel Cron 每 5 分钟检查一次,误差 ≤ 5 分钟。</p>',
      buttons: [{ text: '知道了', class: 'btn-primary', action: 'close' }],
    });
  }

  window.JDPush = { enableReminder, disableReminder, initSettingsUI, isSupported, savePreference };
})();
