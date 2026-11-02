# Supabase(서버·DB) 연결 안내

Supabase 키를 넣기 전에는 로그인·저장한 여행·커뮤니티가 **지금처럼 이 브라우저에만** 저장됩니다.
아래 순서대로 설정하고 `.env.local`에 키를 넣으면, 다음 작업(ROADMAP 8-2~8-5)에서 서버 저장으로 바꿉니다.

무료 플랜으로 충분합니다 (DB 500MB, 월 활성 사용자 5만 명).
단, **1주일 동안 아무도 쓰지 않으면 프로젝트가 일시정지**되니, 대시보드에서 다시 켜 주세요.

## 1. 프로젝트 만들기

1. https://supabase.com 에서 GitHub 계정 등으로 가입
2. **New project**
   - Name: `planj` (아무거나)
   - Database Password: 길고 복잡하게 → **따로 보관** (앱에는 쓰지 않음)
   - Region: **Northeast Asia (Seoul)** — 한국 사용자에게 가장 빠름
3. 1~2분 기다리면 프로젝트가 준비됩니다.

## 2. 테이블·권한 만들기

1. 왼쪽 메뉴 **SQL Editor** → **New query**
2. 이 저장소의 [`supabase/schema.sql`](../supabase/schema.sql) 내용을 통째로 붙여 넣고 **Run**
3. 왼쪽 **Table Editor**에 `profiles`, `trips`, `trip_days`, `posts`, `comments`, `likes`, `bookmarks`가 보이면 성공
   - 여러 번 실행해도 괜찮게 만들어 두었습니다 (테이블이 있으면 건너뜀).

## 3. 로그인 설정 (지인 테스트용)

**Authentication → Sign In / Providers → Email**

- **Confirm email: 끄기** — 켜 두면 가입할 때마다 확인 메일을 눌러야 하고,
  무료 플랜은 메일 발송 수가 아주 적습니다(시간당 몇 통). 지인 테스트 단계에서는 끄는 것을 권장합니다.

**Authentication → URL Configuration**

- **Site URL**: Vercel 배포 주소 (예: `https://planj.vercel.app`)
- **Redirect URLs**: 위 주소와 `http://localhost:5173` 추가

## 4. 키를 앱에 넣기

**Project Settings → API** (또는 **Connect** 버튼)에서 두 값을 복사합니다.

| 화면에 보이는 이름 | `.env.local`에 넣을 이름 |
|---|---|
| Project URL (`https://xxxx.supabase.co`) | `VITE_SUPABASE_URL` |
| `anon` `public` 키 (또는 Publishable key) | `VITE_SUPABASE_ANON_KEY` |

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

- ⚠️ **`service_role` (secret) 키는 절대 넣지 마세요.** 브라우저에 그대로 노출되고 모든 권한을 가진 키입니다.
- anon 키는 공개돼도 괜찮습니다. 누가 무엇을 할 수 있는지는 2단계의 권한(RLS)이 막습니다.
- 키는 채팅·메신저에 붙여 넣지 말고 `.env.local`에만 넣어 주세요.

**Vercel 배포**에도 같은 두 값을 넣습니다: Vercel 프로젝트 → **Settings → Environment Variables** → 저장 후 **Redeploy**.

## 5. 확인

개발 서버를 다시 켜면(`npm run dev`) 키를 읽습니다. 서버 연결 코드(8-2~)를 붙인 뒤부터 실제로 서버에 저장됩니다.

## 다음 작업에서 정할 것

- **로그인 방식**: Supabase 로그인은 기본이 **이메일 + 비밀번호**입니다. 지금 앱은 **ID + 비밀번호**로 로그인하므로,
  (가) 로그인 칸을 이메일로 바꾸거나, (나) ID로 이메일을 찾아 로그인하는 서버 함수를 추가하는 방법이 있습니다.
- **지금 브라우저에 있는 데이터**: 서버로 옮기지 않고 서버 연결 후 새로 시작하는 것을 권장합니다 (`docs/DATA_MODEL.md`).
