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
