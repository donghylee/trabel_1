-- 2026-11-27: 좋아요·댓글 알림 + 여행 일정 10분 전 알림 (schema.sql에도 반영됨)
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전.
-- 알림을 보내는 서버 함수: supabase/functions/notify-push — 설정 방법은 docs/PUSH_SETUP.md

-- 여행 시작일 (1일차 날짜). 넣어 둔 여행만 일정 알림을 보냄
alter table public.trips add column if not exists start_date date;

-- 보낼 일정 알림. 앱이 여행을 저장할 때 그 여행 것을 통째로 새로 씀.
-- 보내고 나면 서버 함수가 지움 (보낼 때가 지난 줄은 남지 않음)
create table if not exists public.trip_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  fire_at timestamptz not null,
  title text not null check (char_length(title) <= 100),
  body text not null check (char_length(body) <= 200),
  url text not null default '/' check (char_length(url) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists trip_reminders_fire on public.trip_reminders (fire_at);
create index if not exists trip_reminders_trip on public.trip_reminders (trip_id);

alter table public.trip_reminders enable row level security;
-- 내 여행의 알림만 넣고 지움 (내 기기로만 가는 알림)
drop policy if exists "trip reminders own" on public.trip_reminders;
create policy "trip reminders own" on public.trip_reminders for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid())
  );

-- 이미 보낸 알림 표시 (좋아요는 눌렀다 취소하고 다시 눌러도 한 번만).
-- 서버 함수만 씀 — 정책이 없어 앱에서는 읽고 쓸 수 없음
create table if not exists public.notify_log (
  key text primary key,
  created_at timestamptz not null default now()
);
alter table public.notify_log enable row level security;
