-- 2026-11-27: 메시지함 미리보기를 [사진을 보냈습니다.] / [동영상을 보냈습니다.] / [이미지를 보냈습니다.]로 (schema.sql에도 반영됨)
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전.
-- dm_inbox가 마지막 메시지의 사진 개수(last_photo_count) 대신 경로(last_photos)를 돌려줌 — 확장자로 영상인지 구분.
-- 돌려주는 열이 바뀌어 create or replace로는 안 되므로 지우고 다시 만듦.
-- 실행하기 전에도 메시지함은 그대로 되고, 영상만 보낸 메시지가 [사진을 보냈습니다.]로 보일 뿐.

drop function if exists public.dm_inbox();
create function public.dm_inbox()
returns table (
  conversation_id uuid,
  other_id uuid,
  other_nickname text,
  other_icon text,
  last_body text,
  last_photos text[],
  last_has_trip boolean,
  last_deleted boolean,
  last_sender uuid,
  last_at timestamptz,
  unread bigint
)
language sql stable security definer set search_path = public
as $$
  select
    me.conversation_id,
    o.user_id,
    p.nickname,
    p.icon,
    lm.body,
    lm.photos,
    lm.trip is not null,
    lm.deleted,
    lm.sender_id,
    lm.created_at,
    (select count(*) from public.dm_messages m
      where m.conversation_id = me.conversation_id
        and m.sender_id <> me.user_id
        and not m.deleted
        and m.created_at > me.last_read_at
        and (me.hidden_before is null or m.created_at > me.hidden_before))
  from public.dm_members me
  join public.dm_members o on o.conversation_id = me.conversation_id and o.user_id <> me.user_id
  join public.profiles p on p.id = o.user_id
  join lateral (
    select * from public.dm_messages m
    where m.conversation_id = me.conversation_id
      and (me.hidden_before is null or m.created_at > me.hidden_before)
    order by m.created_at desc
    limit 1
  ) lm on true
  where me.user_id = auth.uid()
  order by lm.created_at desc
$$;

revoke all on function public.dm_inbox() from public, anon;
grant execute on function public.dm_inbox() to authenticated;
