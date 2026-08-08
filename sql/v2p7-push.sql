-- V2.7 VAPID 推送:表结构
-- 跑:Supabase SQL Editor

-- 1) push_subscriptions:浏览器订阅的 push endpoint
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

create index if not exists idx_push_subs_user on push_subscriptions(user_id);

-- 2) push_preferences:用户偏好(开/关、时间、tz)
create table if not exists push_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean default true,
  push_time text default '21:00',  -- HH:MM (24h)
  push_tz text default 'Asia/Shanghai',
  last_pushed date,  -- 今天推了没(防重)
  updated_at timestamptz default now()
);

-- 3) RLS
alter table push_subscriptions enable row level security;
alter table push_preferences enable row level security;

drop policy if exists "users manage own subs" on push_subscriptions;
create policy "users manage own subs"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users manage own prefs" on push_preferences;
create policy "users manage own prefs"
  on push_preferences for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- service_role 走完全权限(给 Vercel cron 用)
drop policy if exists "service role all subs" on push_subscriptions;
create policy "service role all subs"
  on push_subscriptions for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role all prefs" on push_preferences;
create policy "service role all prefs"
  on push_preferences for all
  to service_role
  using (true)
  with check (true);
