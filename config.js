/* 家当管家 V2.7 配置
   ⚠️ 部署到生产前,把这两个值换成你自己的 Supabase 项目
   anon key 是公开的(设计为前端可见),但 service_role 不是 — 绝不放这里 */
window.JD_CONFIG = {
  SUPABASE_URL: 'https://qekkknfgbgltvxgwixfo.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFla2trbmZnYmdsdHZ4Z3dpeGZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwMzY4MTcsImV4cCI6MjEwMDYxMjgxN30.kqEOAe_2jtX6W7czLo9pmTaCoMMeAmUxKrtfeHXAs1g',
  // V2.7: VAPID 公开 key(前端订阅用,公开安全)
  VAPID_PUBLIC_KEY: 'BJumElOgcKrp_f5aSHg5nS_EBgj_WgcgAXWmz8T2Nf2tqHtpiOgEtjrnMeAJjpmJrZWGwytPHqv4snOfGS8crYM',
  // VAPID 私钥(只在 Vercel 环境变量,不放这里)
};
