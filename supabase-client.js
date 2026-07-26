/* V2.6: Supabase client 单例
   SDK 从 CDN 加载(window.supabase),config.js 必须在它之前 */
(function () {
  if (!window.supabase) {
    console.error('[supabase] SDK 未加载,检查 index.html 里 <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    return;
  }
  const cfg = window.JD_CONFIG;
  if (!cfg || !cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY) {
    console.error('[supabase] config.js 缺 SUPABASE_URL 或 SUPABASE_ANON_KEY');
    return;
  }
  window.supabaseClient = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,        // 保留 session 在 localStorage
      autoRefreshToken: true,
      detectSessionInUrl: false,   // PWA 不需要从 URL 解析
    },
  });
  console.log('[supabase] client ready');
})();
