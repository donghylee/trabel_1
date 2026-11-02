-- PLAN:J 데이터베이스 (Supabase / PostgreSQL)
-- 설계 설명: docs/DATA_MODEL.md, 적용 방법: docs/SUPABASE_SETUP.md
-- Supabase 대시보드 → SQL Editor 에 이 파일 내용을 통째로 붙여 넣고 Run. 여러 번 실행해도 안전하게 작성.

-- ─────────────────────────────────────────────
-- 회원 공개 정보 (이메일·비밀번호는 Supabase Auth가 관리)
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,          -- 내부용 고유 이름 (로그인은 이메일로, 가입할 때 앱이 자동으로 만듦)
  nickname text not null unique,
  icon text,                              -- 이모지 한 글자 또는 사진 주소
  created_at timestamptz not null default now(),
  -- 지금 앱의 가입 규칙과 맞춤: 빈칸 없이 30자 이내
  constraint username_format check (username !~ '\s' and char_length(username) between 1 and 30),
  constraint nickname_length check (char_length(trim(nickname)) between 1 and 30)
);

-- 지금 앱처럼 대소문자만 다른 ID·닉네임도 중복으로 봄
create unique index if not exists profiles_username_ci on public.profiles (lower(username));
create unique index if not exists profiles_nickname_ci on public.profiles (lower(nickname));

-- 가입하면 profiles 줄을 자동으로 만듦 (앱이 가입할 때 options.data 에 username·nickname 을 넘김)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, nickname, icon)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'nickname',
    new.raw_user_meta_data ->> 'icon'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 저장한 여행 + 하루 일정
-- ─────────────────────────────────────────────
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  country_code text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trips_owner_idx on public.trips (owner_id, updated_at desc);

create table if not exists public.trip_days (
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_number int not null check (day_number between 1 and 60),
  saved_at timestamptz not null default now(),
  input jsonb not null,                   -- 나라·장소·숙소·시간 (TripInput)
  custom_order jsonb,                     -- 직접 바꾼 방문 순서 (없으면 null)
  meal_choices jsonb not null default '{}',
  meal_slots jsonb not null default '{}',
  summary jsonb not null,                 -- 목록에서 바로 보여 줄 요약
  primary key (trip_id, day_number)
);

-- ─────────────────────────────────────────────
-- 커뮤니티: 글·댓글·좋아요·찜
-- ─────────────────────────────────────────────
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  trip_snapshot jsonb not null,           -- 올릴 때의 여행 복사본 (SavedTrip)
  caption text not null default '',
  tags text[] not null default '{}',
  photos text[] not null default '{}',    -- Storage 'post-photos' 버킷의 공개 주소
  cover text,                             -- 일정 이미지 배경 사진 (나라 사진 /countries/.. 또는 Storage 주소, 없으면 기본)
  created_at timestamptz not null default now()
);
create index if not exists posts_created_idx on public.posts (created_at desc);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments (post_id, created_at);

create table if not exists public.likes (
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 찜: 원본 글이 지워져도 볼 수 있게 일정·작성자 복사본을 함께 둠 (지금 앱과 같은 방식)
-- post_id는 posts를 참조하지 않음 — 글이 지워져도 찜은 남고, 예시 게시물(id가 uuid가 아님)도 찜할 수 있게 text
create table if not exists public.bookmarks (
  post_id text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  author jsonb not null,                  -- { nickname, icon }
  trip_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- 피드에서 좋아요·댓글 수를 한 번에 읽기 위한 보기
create or replace view public.post_feed
with (security_invoker = true) as
select
  p.*,
  pr.nickname as author_nickname,
  pr.icon as author_icon,
  (select count(*) from public.likes l where l.post_id = p.id) as like_count,
  (select count(*) from public.comments c where c.post_id = p.id) as comment_count
from public.posts p
join public.profiles pr on pr.id = p.author_id;

-- ─────────────────────────────────────────────
-- 권한 (RLS): 내 것만 쓰기, 커뮤니티는 누구나 읽기
-- ─────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_days enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.likes enable row level security;
alter table public.bookmarks enable row level security;

-- profiles: 누구나 읽기 (닉네임·아이콘 표시, ID 중복 확인), 수정은 본인만
drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- trips / trip_days: 본인 것만
drop policy if exists "trips own" on public.trips;
create policy "trips own" on public.trips for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "trip_days own" on public.trip_days;
create policy "trip_days own" on public.trip_days for all
  using (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()))
  with check (exists (select 1 from public.trips t where t.id = trip_id and t.owner_id = auth.uid()));

-- posts / comments: 누구나 읽기, 쓰기·지우기는 작성자 본인만
drop policy if exists "posts read" on public.posts;
create policy "posts read" on public.posts for select using (true);
drop policy if exists "posts write own" on public.posts;
create policy "posts write own" on public.posts for insert with check (auth.uid() = author_id);
drop policy if exists "posts delete own" on public.posts;
create policy "posts delete own" on public.posts for delete using (auth.uid() = author_id);

drop policy if exists "comments read" on public.comments;
create policy "comments read" on public.comments for select using (true);
drop policy if exists "comments write own" on public.comments;
create policy "comments write own" on public.comments for insert with check (auth.uid() = author_id);
drop policy if exists "comments delete own" on public.comments;
create policy "comments delete own" on public.comments for delete using (auth.uid() = author_id);

-- likes: 수는 누구나 셀 수 있게 읽기 허용, 누르기·취소는 본인만
drop policy if exists "likes read" on public.likes;
create policy "likes read" on public.likes for select using (true);
drop policy if exists "likes write own" on public.likes;
create policy "likes write own" on public.likes for insert with check (auth.uid() = user_id);
drop policy if exists "likes delete own" on public.likes;
create policy "likes delete own" on public.likes for delete using (auth.uid() = user_id);

-- bookmarks: 본인 것만
drop policy if exists "bookmarks own" on public.bookmarks;
create policy "bookmarks own" on public.bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- 사진 저장소: 글 사진·프로필 사진 (공개 읽기, 올리기는 로그인한 사람이 자기 폴더에만)
-- 파일 경로 규칙: {사용자 uuid}/{파일 이름}
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "photos upload own folder" on storage.objects;
create policy "photos upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id in ('post-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos delete own folder" on storage.objects;
create policy "photos delete own folder" on storage.objects for delete to authenticated
  using (bucket_id in ('post-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);
-- 지우기(remove)는 먼저 그 파일을 찾아보므로, 내 폴더 파일을 볼 권한도 필요
-- (공개 버킷이라 사진 주소로 보는 것은 이 권한 없이도 누구나 가능)
drop policy if exists "photos read own folder" on storage.objects;
create policy "photos read own folder" on storage.objects for select to authenticated
  using (bucket_id in ('post-photos', 'avatars') and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────
-- 다이렉트 메시지 + 푸시 알림 구독 (migrations/004_direct_messages.sql)
-- ─────────────────────────────────────────────
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
  conv uuid;
begin
  if me is null then raise exception 'login required'; end if;
  if other = me then raise exception 'cannot message yourself'; end if;
  if not exists (select 1 from public.profiles where id = other) then raise exception 'no such user'; end if;
  select a.conversation_id into conv
    from public.dm_members a
    join public.dm_members b on b.conversation_id = a.conversation_id and b.user_id = other
    where a.user_id = me
    limit 1;
  if conv is null then
    insert into public.dm_conversations default values returning id into conv;
    insert into public.dm_members (conversation_id, user_id) values (conv, me), (conv, other);
  end if;
  return conv;
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
-- 이미 들어 있거나(duplicate_object) 실시간 설정이 없는 프로젝트(undefined_object)면 건너뜀
  exception when duplicate_object or undefined_object then null;
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
