/* V2.7: 每日签到提醒(PushAlert)
   - 浏览器原生 Notification API + PushAlert 服务
   - 设置页"每日提醒"开关
   - 后端定时推送由 PushAlert dashboard 配(无需服务端 cron) */
(function () {
  const PUSH_KEY = 'jiadang_push_enabled';
  const PUSH_TIME = 'jiadang_push_time';

  function getCfg() {
    return window.JD_CONFIG || {};
  }

  function isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  function getPermission() {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission;  // 'granted' | 'denied' | 'default'
  }

  async function requestPermission() {
    if (!isSupported()) return 'unsupported';
    const r = await Notification.requestPermission();
    return r;
  }

  /* 注册 push subscription(浏览器原生)
     PushAlert SDK 会自动捕获,不用我们管服务端 */
  async function subscribe() {
    if (!isSupported()) throw new Error('浏览器不支持推送');
    const perm = await requestPermission();
    if (perm !== 'granted') throw new Error('未授权通知权限');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // 不带 applicationServerKey — 用 PushAlert 默认的(从他的 sw.js 来)
      });
    }
    // PushAlert SDK 会自动捕获并注册
    console.log('[push] subscribed', sub.endpoint.slice(0, 50));
    return sub;
  }

  async function unsubscribe() {
    if (!isSupported()) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
    console.log('[push] unsubscribed');
  }

  /* 启用每日提醒 */
  async function enableReminder() {
    if (!isSupported()) {
      toast('当前浏览器不支持推送(建议 Chrome / Edge)');
      return false;
    }
    try {
      const perm = await requestPermission();
      if (perm === 'denied') {
        toast('通知权限被拒,请在浏览器设置里允许');
        return false;
      }
      if (perm !== 'granted') {
        toast('未授权,无法开启');
        return false;
      }
      await subscribe();
      localStorage.setItem(PUSH_KEY, '1');
      localStorage.setItem(PUSH_TIME, '21:00');
      // 测试通知
      showTestNotification();
      toast('已开启每日提醒');
      return true;
    } catch (e) {
      console.warn('enable failed', e);
      toast('开启失败:' + e.message);
      return false;
    }
  }

  /* 关闭每日提醒 */
  async function disableReminder() {
    try {
      await unsubscribe();
    } catch (e) { console.warn('unsub', e); }
    localStorage.removeItem(PUSH_KEY);
    localStorage.removeItem(PUSH_TIME);
    toast('已关闭每日提醒');
  }

  /* 发送一条测试通知(本地) */
  async function showTestNotification() {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('家当管家', {
        body: '🔔 每日提醒已开启!明天 21:00 提醒你签到',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'jiadang-test',
      });
    } catch (e) { console.warn('test notif failed', e); }
  }

  /* 初始化设置页 UI 状态 */
  function initSettingsUI() {
    const toggle = document.getElementById('push-toggle');
    const timeInput = document.getElementById('push-time-input');
    const statusText = document.getElementById('push-status-text');
    const statusSub = document.getElementById('push-status-sub');
    if (!toggle) return;

    // 恢复已存的时间
    const savedTime = localStorage.getItem(PUSH_TIME) || '21:00';
    if (timeInput) timeInput.value = savedTime;

    function refresh() {
      const enabled = localStorage.getItem(PUSH_KEY) === '1';
      const time = localStorage.getItem(PUSH_TIME) || '21:00';
      if (timeInput) timeInput.value = time;
      toggle.checked = enabled;
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
      timeInput.addEventListener('change', () => {
        const v = timeInput.value || '21:00';
        localStorage.setItem(PUSH_TIME, v);
        // 第一次改的时候,提示用户去 PushAlert 后台同步
        const tipKey = 'jiadang_push_tip_shown';
        if (!localStorage.getItem(tipKey)) {
          showPushAlertTip();
          localStorage.setItem(tipKey, '1');
        }
        toast('提醒时间已设为 ' + v);
        refresh();
      });
    }
  }

  /* 弹个 modal 提示:PushAlert 后台要配对应 Campaign */
  function showPushAlertTip() {
    if (typeof showModal !== 'function') return;
    showModal({
      title: '⏰ 推送时间已修改',
      body: '<p style="margin-bottom:8px;">提醒时间已存到本机。</p>' +
            '<p style="color:var(--ink-2); font-size:13px; margin-bottom:8px;">⚠️ 实际推送由 <b>PushAlert 后台</b> 统一控制,改时间后请到 PushAlert 控制台同步修改 Campaign 的 Schedule。</p>' +
            '<p style="color:var(--ink-2); font-size:13px;">或者直接用默认的每日 21:00。</p>' +
            '<p style="margin-top:12px;"><a href="https://app.pushalert.co/dashboard" target="_blank" style="color:var(--brand);">→ 打开 PushAlert 后台</a></p>',
      buttons: [{ text: '知道了', class: 'btn-primary', action: 'close' }],
    });
  }

  // 暴露
  window.JDPush = { enableReminder, disableReminder, initSettingsUI, isSupported, getPermission };
})();
