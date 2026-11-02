# 데이터 모양 (서버·DB로 옮길 때 기준)

지금은 모든 데이터를 브라우저(localStorage)에 저장합니다.
아래 표는 **지금 저장하는 곳 → Supabase로 옮길 때의 테이블**을 정리한 것입니다.
타입 정의는 `src/types.ts`, 저장 코드는 `src/lib/`에 모여 있어서
서버를 붙일 때는 `src/lib/`의 저장 함수 안쪽만 API 호출로 바꾸면 됩니다.

## 한눈에 보기

| 데이터 | 타입 (`src/types.ts` 등) | 지금 저장하는 곳 (localStorage 키) | 저장 코드 | DB 테이블 (안) |
|---|---|---|---|---|
| 회원 | `User` (`lib/auth.ts`) | `trip-route-planner:users:v1` | `lib/auth.ts` | `auth.users` + `profiles` |
| 로그인 상태 | `SessionUser` | `trip-route-planner:session:v1` | `lib/auth.ts` | Supabase Auth 세션 (테이블 없음) |
| 저장한 여행 | `SavedTrip` | `trip-route-planner:trips:v1` | `lib/storage.ts` | `trips` |
| 여행의 하루 일정 | `SavedDay` | (여행 안에 같이) | `lib/storage.ts` | `trip_days` |
| 커뮤니티 글 | `FeedPost` | `trip-route-planner:posts:v1` | `lib/posts.ts` | `posts` |
| 댓글 | `FeedComment` | `trip-route-planner:comments:v1` | `lib/reactions.ts` | `comments` |
| 좋아요 | (게시물 id 목록) | `trip-route-planner:likes:v1:{계정ID}` | `lib/reactions.ts` | `likes` |
| 찜 | `Bookmark` | `trip-route-planner:bookmarks:v1:{계정ID}` | `lib/bookmarks.ts` | `bookmarks` |

서버로 옮기지 않는 것 (기기별 설정):

- 화면 언어 `trip-route-planner:lang` — `src/i18n`
- 첫 방문 안내 "다시 보지 않기" — sessionStorage, `components/WelcomeNotice.tsx`

## 테이블 설계 (안)

`id`는 따로 적지 않으면 `uuid` 기본 키입니다. 시각은 모두 `timestamptz`.

### profiles — 회원 공개 정보

| 열 | 형식 | 지금 값 |
|---|---|---|
| id | uuid (= `auth.users.id`) | — |
| username | text, 고유 | 내부용 고유 이름 (로그인은 이메일, 가입할 때 앱이 자동 생성) |
| nickname | text, 고유 | `User.nickname` |
| icon | text | `User.icon` (이모지, 또는 사진 → Storage 주소로) |
| created_at | timestamptz | `User.createdAt` |

- 이메일·비밀번호는 Supabase Auth가 관리합니다. 지금의 `passwordHash`는 옮기지 않고 **다시 가입**받습니다.

### trips — 저장한 여행

| 열 | 형식 | 지금 값 |
|---|---|---|
| id | uuid | `SavedTrip.id` |
| owner_id | uuid → profiles | `SavedTrip.ownerId` |
| name | text | `name` |
| country_code | text | `countryCode` |
| created_at / updated_at | timestamptz | `createdAt` / `updatedAt` |

### trip_days — 여행의 하루 일정

| 열 | 형식 | 지금 값 |
|---|---|---|
| trip_id | uuid → trips (삭제 시 같이 삭제) | — |
| day_number | int | `SavedDay.dayNumber` |
| saved_at | timestamptz | `savedAt` |
| input | jsonb | `input` (나라·장소·숙소·시간) |
| custom_order | jsonb (string[] 또는 null) | `customOrder` |
| meal_choices | jsonb | `mealChoices` |
| meal_slots | jsonb | `mealSlots` |
| summary | jsonb | `summary` (목록용 요약) |

- 기본 키는 `(trip_id, day_number)`.
- 일정은 **입력 조건만 저장하고 볼 때 다시 계산**하는 방식이라 시간표 자체는 저장하지 않습니다.

### posts — 커뮤니티 글

| 열 | 형식 | 지금 값 |
|---|---|---|
| id | uuid | `FeedPost.id` |
| author_id | uuid → profiles | `FeedPost.author.id` |
| trip_snapshot | jsonb | `trip` (올릴 때의 여행 복사본) |
| caption | text | `caption` |
| tags | text[] | `tags` |
| photos | text[] (Storage 주소) | `photos` (지금은 data URL) |
| created_at | timestamptz | `postedAt` |

- `likeCount`와 `comments`는 열로 두지 않고 `likes`·`comments` 테이블에서 셉니다.
- 작성자 닉네임·아이콘은 `profiles`와 조인해서 가져옵니다 (지금은 글 안에 복사본).

### comments / likes / bookmarks

| 테이블 | 열 | 지금 값 |
|---|---|---|
| comments | id, post_id → posts, author_id → profiles, text, created_at | `FeedComment` (`author.id`, `text`, `postedAt`) |
| likes | post_id → posts, user_id → profiles, created_at — 기본 키 (post_id, user_id) | 계정별 게시물 id 목록 |
| bookmarks | post_id (text), user_id → profiles, author, trip_snapshot, created_at — 기본 키 (post_id, user_id) | `Bookmark` 전체 |

- `bookmarks`에는 지금 앱처럼 작성자·일정 복사본(`author`, `trip_snapshot`)을 같이 둡니다.
  원본 글이 지워져도 찜은 남고, 예시 게시물도 찜할 수 있도록 `post_id`는 `posts`를 참조하지 않는 text입니다.

실제 SQL은 [`supabase/schema.sql`](../supabase/schema.sql), 설정 순서는 [SUPABASE_SETUP.md](SUPABASE_SETUP.md)에 있습니다.

## 권한 (RLS) 기본 방향

- `trips`, `trip_days`, `likes`, `bookmarks`: **본인 것만** 읽기·쓰기.
- `posts`, `comments`, `profiles`: 누구나 읽기, 쓰기·수정·삭제는 **작성자 본인만**.

## 지금 데이터 옮기기

- 같은 브라우저를 여러 계정이 쓰면 여행은 `ownerId`로 나뉩니다.
  주인이 없는 예전 여행은 로그인한 사람에게 보이고, 처음 수정할 때 그 사람 것으로 정해집니다.
- 지인 테스트 단계라면 localStorage 데이터는 옮기지 않고 서버 연결 후 새로 시작하는 것을 권장합니다.
