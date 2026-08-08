// V2.7: VAPID 推送 cron (CommonJS for Vercel)
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@jiadang.app';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qekkknfgbgltvxgwixfo.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET || 'jiadang-cron-2026';

let vapidConfigured = false;
function ensureVapid() {
  if (vapidConfigured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error('VAPID keys missing');
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  vapidConfigured = true;
  return true;
}

function beijingNow() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t) => parts.find(p => p.type === t)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hh: get('hour'),
    mm: get('minute'),
    time: `${get('hour')}:${get('minute')}`,
  };
}

module.exports = async function handler(req, res) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!ensureVapid()) {
    return res.status(500).json({ error: 'vapid not configured' });
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { date, time } = beijingNow();
  console.log('[cron] beijing', date, time);

  const { data: prefs, error: prefErr } = await supabase
    .from('push_preferences')
    .select('user_id, push_time, last_pushed')
    .eq('push_enabled', true);

  if (prefErr) {
    return res.status(500).json({ error: prefErr.message });
  }

  const targets = (prefs || []).filter(p => {
    if (p.last_pushed === date) return false;
    const [h, m] = (p.push_time || '21:00').split(':').map(Number);
    const [nh, nm] = time.split(':').map(Number);
    const nowMin = nh * 60 + nm;
    const tgtMin = h * 60 + m;
    return Math.abs(nowMin - tgtMin) <= 2;
  });

  if (targets.length === 0) {
    return res.status(200).json({ current: time, pushed: 0 });
  }

  const userIds = targets.map(t => t.user_id);
  const { data: subs, error: subErr } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('user_id', userIds);

  if (subErr) {
    return res.status(500).json({ error: subErr.message });
  }

  const payload = JSON.stringify({
    title: '🔔 待签到!检查今日库存',
    body: '你今天还没扣库存,记得打开 app 看看哪些产品待扣',
    url: 'https://household-manager-v2.vercel.app/',
  });

  const results = [];
  for (const sub of subs || []) {
    try {
      await webpush.sendNotification({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      }, payload);
      results.push({ id: sub.id, ok: true });
    } catch (e) {
      console.warn('[cron] push fail', sub.id, e.statusCode, e.message);
      results.push({ id: sub.id, ok: false, statusCode: e.statusCode, err: e.message });
      if (e.statusCode === 404 || e.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }

  for (const t of targets) {
    await supabase
      .from('push_preferences')
      .update({ last_pushed: date })
      .eq('user_id', t.user_id);
  }

  return res.status(200).json({
    current: time,
    targets: targets.length,
    subs: subs?.length || 0,
    results,
  });
};
