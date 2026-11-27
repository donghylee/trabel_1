-- 2026-11-27: 커뮤니티 글에 영상 1개 (schema.sql에도 반영됨)
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전.
-- 영상 파일은 글 사진과 같은 저장소(post-photos 버킷, {사용자 uuid}/ 폴더)에 올리고, 이 열에는 공개 주소만 저장.
-- 실행하기 전에도 영상 없이 올리는 글쓰기는 그대로 됨.

alter table public.posts add column if not exists video text;

-- post_feed는 만들 때의 열 목록(p.*)을 고정해 두므로, 새 열이 보이게 다시 만듦 (003과 같은 정의)
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
