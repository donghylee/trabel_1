-- 2026-11-02: 다이렉트 메시지(1:1 대화) + 푸시 알림 구독 (schema.sql에도 반영됨)
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run. 여러 번 실행해도 안전.
--
-- 대화방(dm_conversations) — 두 사람(dm_members) — 메시지(dm_messages)
-- 대화 내용·사진은 대화하는 두 사람만 볼 수 있다 (RLS + 비공개 사진 버킷 dm-photos).

create table if not exists public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create table if not exists public.dm_members (
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- 여기까지 읽음 (이후에 온 상대 메시지 수 = 안 읽은 수)
  last_read_at timestamptz not null default now(),
  -- [대화 삭제]한 때 — 이 전 메시지는 나에게 안 보이고, 새 메시지가 오면 대화가 다시 나타남
  hidden_before timestamptz,
  primary key (conversation_id, user_id)
);
create index if not exists dm_members_user on public.dm_members (user_id);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.dm_conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null default '' check (char_length(body) <= 2000),
  -- dm-photos 버킷 안 경로 ({대화 id}/{파일})
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  -- 보낸 여행 일정 복사본 (SavedTrip)
  trip jsonb,
  -- 보낸 사람이 지운 메시지 ("삭제된 메시지입니다"로 표시)
  deleted boolean not null default false,
  -- 푸시 알림을 보낸 때 (한 메시지에 알림은 한 번만 — supabase/functions/dm-push)
  pushed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists dm_messages_conversation on public.dm_messages (conversation_id, created_at);

-- 이 기기로 알림 받기 (브라우저 Web Push 구독)
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user on public.push_subscriptions (user_id);

-- ── 대화에 들어 있는 사람인지 (정책 안에서 dm_members를 다시 읽을 때 RLS가 꼬이지 않게 definer) ──
create or replace function public.is_dm_member(conversation text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.dm_members
    where conversation_id::text = conversation and user_id = auth.uid()
  )
$$;

alter table public.dm_conversations enable row level security;
alter table public.dm_members enable row level security;
alter table public.dm_messages enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "dm conversations member" on public.dm_conversations;
create policy "dm conversations member" on public.dm_conversations for select
  using (public.is_dm_member(id::text));

drop policy if exists "dm members read" on public.dm_members;
create policy "dm members read" on public.dm_members for select
  using (public.is_dm_member(conversation_id::text));
-- 읽음·대화 삭제는 dm_mark_read / dm_hide 함수로만 (다른 대화로 옮기는 등 직접 고치지 못하게)
drop policy if exists "dm members update own" on public.dm_members;

drop policy if exists "dm messages read" on public.dm_messages;
create policy "dm messages read" on public.dm_messages for select
  using (public.is_dm_member(conversation_id::text));
drop policy if exists "dm messages send" on public.dm_messages;
create policy "dm messages send" on public.dm_messages for insert
  with check (auth.uid() = sender_id and public.is_dm_member(conversation_id::text) and not deleted);
-- 메시지 지우기는 dm_delete_message 함수로만
drop policy if exists "dm messages delete own" on public.dm_messages;

drop policy if exists "push subscriptions own" on public.push_subscriptions;
create policy "push subscriptions own" on public.push_subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── 새 메시지가 오면 대화 순서·보낸 사람의 읽음 시각 갱신 ──
create or replace function public.dm_after_message()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.dm_conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.dm_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;
drop trigger if exists dm_after_message on public.dm_messages;
create trigger dm_after_message after insert on public.dm_messages
  for each row execute function public.dm_after_message();

-- ── 상대와의 대화방 열기 (없으면 만듦) → 대화 id ──
create or replace function public.dm_open(other uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  me uuid := auth.uid();
  found uuid;
begin
  if me is null then raise exception 'login required'; end if;
  if other = me then raise exception 'cannot message yourself'; end if;
  if not exists (select 1 from public.profiles where id = other) then raise exception 'no such user'; end if;
  select a.conversation_id into found
    from public.dm_members a
    join public.dm_members b on b.conversation_id = a.conversation_id and b.user_id = other
    where a.user_id = me
    limit 1;
  if found is null then
    insert into public.dm_conversations default values returning id into found;
    insert into public.dm_members (conversation_id, user_id) values (found, me), (found, other);
  end if;
  return found;
end;
$$;

-- ── 메시지함 목록: 대화 상대·마지막 메시지·안 읽은 수 (내 대화만) ──
create or replace function public.dm_inbox()
returns table (
  conversation_id uuid,
  other_id uuid,
  other_nickname text,
  other_icon text,
  last_body text,
  last_photo_count int,
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
    cardinality(lm.photos),
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

-- ── 읽음 표시 ──
create or replace function public.dm_mark_read(conversation uuid)
returns void
language sql security definer set search_path = public
as $
  update public.dm_members set last_read_at = now()
  where conversation_id = conversation and user_id = auth.uid()
$;

-- ── 대화 삭제 (나에게서만): 지금까지의 메시지를 숨김. 상대 쪽 대화는 그대로 ──
create or replace function public.dm_hide(conversation uuid)
returns void
language sql security definer set search_path = public
as $
  update public.dm_members set hidden_before = now(), last_read_at = now()
  where conversation_id = conversation and user_id = auth.uid()
$;

-- ── 내 메시지 지우기: "삭제된 메시지입니다"로 바꾸고, 지운 사진 경로를 돌려줌 (앱이 사진 파일도 지움) ──
-- 실제 삭제 대신 수정이라 상대 화면에도 실시간으로 바로 반영됨
create or replace function public.dm_delete_message(message uuid)
returns text[]
language plpgsql security definer set search_path = public
as $
declare
  removed text[];
begin
  select photos into removed from public.dm_messages
    where id = message and sender_id = auth.uid() and not deleted
    for update;
  if not found then return null; end if;
  update public.dm_messages set deleted = true, body = '', photos = '{}', trip = null where id = message;
  return removed;
end;
$;

-- ── 이 기기 알림 구독 저장 (같은 기기에서 다른 계정으로 바꿔 로그인하면 새 계정으로 넘김) ──
create or replace function public.dm_save_push(p_endpoint text, p_p256dh text, p_auth text)
returns void
language sql security definer set search_path = public
as $
  insert into public.push_subscriptions (endpoint, user_id, p256dh, auth)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth
$;

revoke all on function public.dm_open(uuid) from public, anon;
revoke all on function public.dm_inbox() from public, anon;
revoke all on function public.dm_save_push(text, text, text) from public, anon;
revoke all on function public.dm_mark_read(uuid) from public, anon;
revoke all on function public.dm_hide(uuid) from public, anon;
revoke all on function public.dm_delete_message(uuid) from public, anon;
grant execute on function public.dm_open(uuid) to authenticated;
grant execute on function public.dm_inbox() to authenticated;
grant execute on function public.dm_save_push(text, text, text) to authenticated;
grant execute on function public.dm_mark_read(uuid) to authenticated;
grant execute on function public.dm_hide(uuid) to authenticated;
grant execute on function public.dm_delete_message(uuid) to authenticated;

-- ── 실시간: 새 메시지·지운 메시지를 열어 둔 화면에 바로 (RLS가 적용돼 내 대화만 옴) ──
do $$
begin
  alter publication supabase_realtime add table public.dm_messages;
exception when duplicate_object then null;
end $$;

-- ── 메시지 사진: 비공개 버킷, 대화하는 두 사람만 보고 올림. 경로 {대화 id}/{파일} ──
insert into storage.buckets (id, name, public)
values ('dm-photos', 'dm-photos', false)
on conflict (id) do nothing;

drop policy if exists "dm photos read" on storage.objects;
create policy "dm photos read" on storage.objects for select to authenticated
  using (bucket_id = 'dm-photos' and public.is_dm_member((storage.foldername(name))[1]));
drop policy if exists "dm photos upload" on storage.objects;
create policy "dm photos upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'dm-photos' and public.is_dm_member((storage.foldername(name))[1]));
drop policy if exists "dm photos delete own" on storage.objects;
create policy "dm photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'dm-photos' and owner_id = auth.uid()::text);
