# 다이렉트 메시지 · 푸시 알림 설정

메시지 기능은 아래 1단계(SQL)만 해도 동작합니다. 앱이 꺼져 있을 때 폰 알림까지 받으려면 2~4단계도 해 주세요.

## 1. DB 만들기 (SQL 한 번)

Supabase 대시보드 → **SQL Editor** → [`supabase/migrations/004_direct_messages.sql`](../supabase/migrations/004_direct_messages.sql) 내용을 통째로 붙여 넣고 **Run**.

만들어지는 것:
- 대화방·대화 참여자·메시지 테이블 (`dm_conversations`, `dm_members`, `dm_messages`)
- 알림 구독 테이블 (`push_subscriptions`)
- 비공개 사진 저장소 `dm-photos`
- 실시간(Realtime) 설정

대화 내용과 사진은 **대화하는 두 사람만** 볼 수 있게 보안 규칙(RLS)이 걸려 있습니다.

## 2. 알림 키 (VAPID) 준비

키는 이미 만들어 두었습니다. 프로젝트 폴더의 **`vapid-keys.local`** 파일에 있고, 이 파일은 git에 올라가지 않습니다.
- `VAPID_PUBLIC_KEY`: 공개 키. 브라우저에 나가도 괜찮습니다.
- `VAPID_PRIVATE_KEY`: 비밀 키. **Supabase 비밀 값에만** 넣으세요. 채팅이나 메신저 등 다른 곳에 붙여 넣으면 안 됩니다.

키를 새로 만들어야 하면 아무 폴더에서 `npx web-push generate-vapid-keys`로 만들 수 있습니다. 키를 바꾸면 이미 알림을 켠 기기는 알림을 다시 켜야 합니다.

## 3. 서버 함수 `dm-push` 만들기

1. Supabase 대시보드 → **Edge Functions** → **Deploy a new function** → **Via Editor**
2. 함수 이름은 정확히 **`dm-push`**
3. 편집기 내용을 지우고 [`supabase/functions/dm-push/index.ts`](../supabase/functions/dm-push/index.ts) 내용을 통째로 붙여 넣기 → **Deploy function**
4. **Edge Functions → Secrets**에 아래 값을 추가합니다.

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | `vapid-keys.local`의 `VAPID_PUBLIC_KEY` 값 |
| `VAPID_PRIVATE_KEY` | `vapid-keys.local`의 `VAPID_PRIVATE_KEY` 값 |
| `VAPID_SUBJECT` | (선택) `mailto:내 이메일` — 비우면 사이트 주소를 씁니다 |

`ALLOWED_ORIGINS`는 길찾기 함수(route-proxy)용으로 이미 넣어 두었다면 그대로 함께 쓰입니다.

## 4. 앱에 공개 키 넣기

**Vercel → Settings → Environment Variables**에 아래 값을 추가합니다.

| Name | Value |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | `vapid-keys.local`의 `VAPID_PUBLIC_KEY` 값 |

추가한 뒤 **Deployments → 가장 위 배포 → Redeploy**를 누릅니다. 환경 변수는 다시 배포해야 적용됩니다.

로컬 개발용 `.env.local`에는 이미 들어가 있습니다.

## 확인

1. 폰에서 앱 → 하단 **[메시지]** 탭 → **[알림 켜기]** → 알림 허용
   - 아이폰은 **홈 화면에 설치한 앱**(iOS 16.4 이상)에서만 알림 버튼이 나옵니다. Safari에서 바로 열면 설치 안내가 보입니다.
2. 다른 계정으로 커뮤니티에서 그 사람 글의 ✉️를 눌러 메시지를 보냅니다.
3. 앱을 닫아 둔 폰에 "닉네임 / 메시지 내용" 알림이 오고, 알림을 누르면 그 대화가 열리면 성공입니다.

## 동작 방식

- 메시지를 보내면 앱이 `dm-push` 함수를 부릅니다. 함수는 보낸 사람이 그 대화에 들어 있는지 확인한 뒤, 상대의 기기로만 알림을 보냅니다.
- 한 메시지의 알림은 **한 번만** 보내고, 보낸 지 2분이 지난 메시지는 알림을 보내지 않습니다.
- 앱을 지웠거나 알림을 끈 기기의 구독은 함수가 알아서 정리합니다.
- 로그아웃하면 그 기기로는 알림이 더 오지 않습니다.
- 알림을 띄우는 코드는 [`public/push-sw.js`](../public/push-sw.js)이고, 앱의 서비스 워커가 불러옵니다.

---

# 좋아요·댓글 알림 · 일정 10분 전 알림

위의 메시지 알림(2~4단계)이 되어 있으면, 아래 4단계만 더 하면 됩니다. 알림 키(Secrets)는 같은 것을 그대로 씁니다.

## 1. DB 추가 (SQL 한 번)

**SQL Editor** → [`supabase/migrations/005_notifications.sql`](../supabase/migrations/005_notifications.sql) 내용을 통째로 붙여 넣고 **Run**.

만들어지는 것:
- 여행 시작일 칸 (`trips.start_date`)
- 보낼 일정 알림 (`trip_reminders`) — 내 여행의 알림만 넣고 지울 수 있음
- 보낸 알림 기록 (`notify_log`) — 좋아요를 눌렀다 취소하고 다시 눌러도 알림은 한 번만

## 2. 서버 함수 `notify-push` 만들기

1. **Edge Functions** → **Deploy a new function** → **Via Editor**
2. 함수 이름은 정확히 **`notify-push`**
3. [`supabase/functions/notify-push/index.ts`](../supabase/functions/notify-push/index.ts) 내용을 통째로 붙여 넣기 → **Deploy function**
4. 함수 화면 → **Details**(설정) → **Verify JWT with legacy secret**(또는 Enforce JWT Verification)을 **끄고** 저장
   - 1분마다 부르는 예약 실행(3단계)은 로그인 없이 부르기 때문입니다.
   - 좋아요·댓글 알림은 함수 안에서 로그인한 사람인지 따로 확인하고, 예약 실행은 보낼 때가 된 알림만 보내므로 꺼도 안전합니다.

## 3. 1분마다 일정 알림 보내기 (pg_cron)

1. **Database → Extensions**에서 **pg_cron**, **pg_net**을 켭니다.
2. **SQL Editor**에서 아래를 실행합니다. `<프로젝트 주소>`는 **Project Settings → API**의 Project URL입니다. 예: `https://abcd1234.supabase.co`

```sql
select cron.schedule(
  'planj-trip-reminders',
  '* * * * *',
  $$ select net.http_post(
       url := '<프로젝트 주소>/functions/v1/notify-push',
       body := '{"kind":"reminders"}'::jsonb,
       headers := '{"Content-Type":"application/json"}'::jsonb
     ) $$
);
```

같은 이름으로 다시 실행하면 덮어씁니다. 멈추려면 `select cron.unschedule('planj-trip-reminders');`

## 4. 확인

- **좋아요·댓글**: 계정 A로 글을 올리고 알림을 켭니다 → 계정 B로 그 글에 좋아요나 댓글 → A의 폰에 "B님이 내 글에 좋아요를 눌렀어요" 알림. 누르면 마이페이지의 그 글로 갑니다.
- **일정 10분 전**: 일정을 저장할 때 **여행 시작일**에 오늘 날짜를 넣고, 15~20분 뒤에 시작하는 일정으로 저장 → 방문·식사 10분 전에 "10분 뒤 일정 / 13:00 장소 · 1일차" 알림. 누르면 그 여행의 그 일차가 열립니다.

## 동작 방식

- 좋아요·댓글을 남기면 앱이 `notify-push`를 부르고, 함수가 글쓴이의 기기로만 보냅니다. 내 글에 내가 한 것은 알리지 않고, 남긴 지 2분이 지난 것도 보내지 않습니다.
- 여행을 저장하거나 고칠 때마다 그 여행의 일정 알림을 새로 계산해 `trip_reminders`에 넣습니다. 시각은 여행지 시간 기준이고, 나라의 시차로 실제 순간을 계산합니다.
- pg_cron이 1분마다 함수를 부르면 보낼 때가 된 알림을 보내고 지웁니다. 5분 넘게 늦어진 알림은 보내지 않고 버립니다.
- 알림 시각은 앱이 계산한 예상 시간이라, 실제 이동이 늦어져도 계획대로 옵니다.
