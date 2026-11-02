-- 2026-11-02: 커뮤니티 일정 이미지 배경 사진 (schema.sql에도 반영됨)
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전.
-- 실행하기 전에도 배경 없이 올리는 글쓰기는 그대로 됨 — 배경 사진을 고른 글만 이 열이 필요.

alter table public.posts add column if not exists cover text;

-- post_feed는 만들 때의 열 목록(p.*)을 고정해 두므로, 새 열이 보이게 다시 만듦
drop view if exists public.post_feed;
create view public.post_feed
with (security_invoker = true) as
select
  p.*,
  pr.nickname as author_nickname,
  pr.icon as author_icon,
  (select count(*) from public.likes l where l.post_id = p.id) as like_count,
  (select count(*) from public.comments c where c.post_id = p.id) as comment_count
from public.posts p
join public.profiles pr on pr.id = p.author_id;
