-- 2026-11-27: 알림 종류별 켜기/끄기 (계정 설정) (schema.sql에도 반영됨)
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전.
-- 서버 함수(dm-push, notify-push)가 보내기 전에 받는 사람의 설정을 확인한다. 처음에는 모두 켜짐.

alter table public.profiles add column if not exists notify_trip boolean not null default true; -- 여행 일정 10분 전
alter table public.profiles add column if not exists notify_post boolean not null default true; -- 내 글 좋아요·댓글
alter table public.profiles add column if not exists notify_dm boolean not null default true;   -- 메시지(DM)
