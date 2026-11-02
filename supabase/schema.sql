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
