# V2.7 VAPID 自建推送 — 部署说明

## 1. Supabase SQL(必做)

Supabase 控制台 → SQL Editor → New query → 粘贴 `sql/v2p7-push.sql` → Run

创建 2 张表 + RLS:
- `push_subscriptions` (用户订阅的 endpoint)
- `push_preferences` (用户偏好:开关 + 时间 + tz)

## 2. Vercel 环境变量

Vercel 项目 → Settings → Environment Variables,加 3 个:

| 变量 | 值 |
|------|-----|
| `VAPID_PUBLIC_KEY` | `BJumElOgcKrp_f5aSHg5nS_EBgj_WgcgAXWmz8T2Nf2tqHtpiOgEtjrnMeAJjpmJrZWGwytPHqv4snOfGS8crYM` |
| `VAPID_PRIVATE_KEY` | `InmyG2Elt002ZW-QA0kEKw9WCsc6lDTklS6hfLYxEt8` |
| `VAPID_SUBJECT` | `mailto:candykillerty@gmail.com` |
| `SUPABASE_URL` | `https://qekkknfgbgltvxgwixfo.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (Supabase 控制台 → Settings → API → service_role 复制) |
| `CRON_SECRET` | 任意随机字符串,如 `jiadang-cron-2026-abc` |

⚠️ `service_role` 不能给前端,只在 Vercel 服务端用。

## 3. Vercel 部署

1. 把整个项目 zip 解压到 Vercel 项目目录
2. 确认 `vercel.json` 在根(已配 cron `*/5 * * * *`)
3. 确认 `api/cron.js` 在 `api/` 目录
4. Vercel 自动识别:
   - 静态文件 → 静态部署
   - `api/*.js` → Serverless Function
   - `vercel.json` 的 crons → Vercel Cron(自动配,Pro 计划必需,Hobby 不支持)
5. 部署

## 4. ⚠️ Vercel Cron 限制

| 计划 | Cron |
|------|------|
| Hobby(免费) | ❌ 不支持 |
| Pro($20/月) | ✅ 支持 5 分钟一次 |

如果你是 Hobby,**用替代方案**:
- **GitHub Actions cron**(免费):每 5 分钟 `curl` 调 `https://household-manager-v2.vercel.app/api/cron`
- **cron-job.org**(免费):每 5 分钟访问 URL
- 自己电脑跑 node 脚本

## 5. 测试

部署完成后:
1. 浏览器打开 `https://household-manager-v2.vercel.app`
2. 登录账号
3. 设置 → 开启"每日提醒" → 允许通知权限
4. 看到"每日提醒已开启"
5. 改时间(比如改 22:00)
6. 改完到点(±5 分钟)看是否收到通知

## 6. 验证 cron 调通

部署后手动测:
```bash
curl -H "Authorization: Bearer jiadang-cron-2026-abc" \
  https://household-manager-v2.vercel.app/api/cron
```

返回:
```json
{"current":"21:00","targets":0,"subs":0,"results":[]}
```

## 7. VAPID 密钥备用

如果需要重新生成密钥:
```bash
npm install web-push
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

新密钥记得更新 2 处:
- `config.js` 的 `VAPID_PUBLIC_KEY`(前端)
- Vercel 环境变量 `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
