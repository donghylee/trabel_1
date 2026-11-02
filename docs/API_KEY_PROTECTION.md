# API 키 보호 (링크를 공유하기 전에 꼭)

`VITE_`로 시작하는 키는 사이트 코드에 그대로 들어가서 **누구나 브라우저에서 볼 수 있습니다.**
보이는 것 자체는 막을 수 없으므로, **(1) 키를 내 사이트에서만 쓸 수 있게 제한**하거나 **(2) 키를 서버로 옮깁니다.**

| 키 | 보호 방법 | 할 일 |
|---|---|---|
| Google Maps (`VITE_GOOGLE_MAPS_API_KEY`) | (1) 사용처·API 제한 — 지도는 브라우저에서 키가 꼭 필요 | [1단계](#1-google-키-제한-google-cloud-콘솔) |
| TMAP (`VITE_TMAP_APP_KEY`) | (2) 서버 중계 함수로 옮김 — TMAP은 사용처 제한 기능이 없음 | [2단계](#2-tmap-키를-서버로-supabase-edge-function) |
| Supabase anon 키 | 공개돼도 됨 — 권한(RLS)이 데이터를 지킴 | 없음 |
| ODsay (지금은 안 씀) | (1) ODsay 콘솔에서 웹 서비스 URI 등록 | 쓸 때 등록 |

## 1. Google 키 제한 (Google Cloud 콘솔)

https://console.cloud.google.com → 프로젝트 선택 → **API 및 서비스 → 사용자 인증 정보** → 지도용 API 키 클릭

### 애플리케이션 제한사항 → **웹사이트**
아래 주소를 하나씩 추가:

```
https://trabel-1.vercel.app/*
http://localhost:5173/*
```

- Google은 `*`를 **주소 맨 앞 부분(하위 도메인)에만** 허용합니다. `trabel-1-*-ldh9.vercel.app`처럼 중간에 넣으면 "잘못된 도메인"으로 거절됩니다.
- `https://*.vercel.app/*`는 넣지 마세요 — 남의 Vercel 사이트에서도 내 키를 쓸 수 있게 됩니다.
- Vercel 미리보기(Preview) 배포 주소에서도 지도를 봐야 하면, 그 주소(예: `https://trabel-1-o4vu1wqmt-ldh9.vercel.app/*`)를 그때그때 추가하세요.
- 나중에 도메인을 바꾸면 그 주소도 추가해야 지도가 나옵니다.

### API 제한사항 → **키 제한** — 앱이 쓰는 4개만 체크

- Maps JavaScript API — 지도
- Places API (New) — 장소 검색·주변 추천·사진
- Geocoding API — 지도에서 누른 곳 주소
- Routes API — 도보·대중교통·택시 경로

**저장** 후 반영까지 최대 5분 걸릴 수 있습니다.

### 요금 폭탄 막기 (권장)

- **결제 → 예산 및 알림**: 월 예산(예: 1만 원)과 50%·90%·100% 알림 메일
- **API 및 서비스 → 각 API → 할당량**: 하루 요청 수 상한 (예: Places 하루 1,000회)

확인: 배포 사이트와 `npm run dev`에서 지도가 그대로 나오면 성공.
다른 주소에서 이 키를 쓰면 `RefererNotAllowedMapError`로 막힙니다.

## 2. TMAP 키를 서버로 (Supabase Edge Function)

앱은 TMAP 키가 브라우저에 **없고** Supabase가 연결돼 있으면, 키 대신 중계 함수 `route-proxy`
([`supabase/functions/route-proxy/index.ts`](../supabase/functions/route-proxy/index.ts))로 길찾기를 부릅니다.

### 2-1. 함수 만들기 (대시보드에서, 설치 없이)

1. Supabase 대시보드 → 왼쪽 **Edge Functions** → **Deploy a new function** → **Via Editor**
2. 함수 이름: **`route-proxy`** (정확히 이 이름)
3. 편집기 내용을 지우고 `supabase/functions/route-proxy/index.ts` 내용을 통째로 붙여 넣기 → **Deploy function**

### 2-2. 비밀 값 넣기

**Edge Functions → Secrets** (또는 Project Settings → Edge Functions)에서 추가:

| Name | Value |
|---|---|
| `TMAP_APP_KEY` | TMAP 앱 키 (지금 `.env.local`의 `VITE_TMAP_APP_KEY` 값) |
| `ALLOWED_ORIGINS` | `https://trabel-1.vercel.app,http://localhost:5173` |

- 여기 넣은 값은 브라우저에 절대 나가지 않습니다.
- `ALLOWED_ORIGINS`에 없는 사이트에서 부르면 함수가 거절합니다.

### 2-3. 브라우저 쪽 키 빼기

- **Vercel → Settings → Environment Variables**에서 `VITE_TMAP_APP_KEY` **삭제** → Redeploy
- 내 컴퓨터 `.env.local`의 `VITE_TMAP_APP_KEY`도 지우면, 개발 중에도 중계 함수로 동작하는지 확인할 수 있습니다.
  (남겨 두면 개발 중에는 예전처럼 바로 부릅니다.)

확인: 한국 일정을 만들면 시간표 아래 안내에 **"도보 TMAP"**이 나오고, 도보 구간에 "추정"이 붙지 않으면 성공.

### TMAP 키 새로 발급 (권장)

Vercel에 `VITE_TMAP_APP_KEY`를 넣어 배포한 적이 있다면 그 키는 이미 공개된 것이므로, 2단계를 마친 뒤
SK open API 콘솔에서 **새 앱 키를 발급**해 `TMAP_APP_KEY`에 넣고 예전 키는 삭제하는 것이 안전합니다.
