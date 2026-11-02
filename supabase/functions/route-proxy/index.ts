// PLAN:J 길찾기 중계 (Supabase Edge Function, Deno)
// 브라우저에 TMAP 키를 두지 않기 위해, 앱은 이 함수에 출발·도착만 보내고 키는 여기서(서버) 붙인다.
// 배포·설정 방법: docs/API_KEY_PROTECTION.md
//
// 비밀 값 (Supabase → Edge Functions → Secrets):
//   TMAP_APP_KEY     TMAP(SK open API) 앱 키
//   ALLOWED_ORIGINS  쉼표로 구분한 허용 주소 (예: https://trabel-1.vercel.app,http://localhost:5173)
//                    비워 두면 모든 주소 허용 — 배포 후에는 꼭 채우기

const TMAP_KEY = Deno.env.get('TMAP_APP_KEY') ?? ''
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const TIMEOUT_MS = 12000

type Point = { lat: number; lng: number; name?: string }

/** 한국 안의 좌표인지 (TMAP은 한국만) — 엉뚱한 요청으로 키 사용량이 새지 않게 */
function isKoreanPoint(p: unknown): p is Point {
  const point = p as Point
  return (
    typeof point?.lat === 'number' &&
    typeof point?.lng === 'number' &&
    point.lat > 33 &&
    point.lat < 39 &&
    point.lng > 124 &&
    point.lng < 132 &&
    (point.name === undefined || (typeof point.name === 'string' && point.name.length <= 100))
  )
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin') ?? ''
  const allowed = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)
  const cors = {
    'Access-Control-Allow-Origin': allowed ? origin || '*' : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!allowed) return reply({ error: 'origin not allowed' }, 403)
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405)

  let body: { provider?: string; from?: unknown; to?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply({ error: 'invalid json' }, 400)
  }

  if (body.provider === 'tmap-walk') {
    if (!TMAP_KEY) return reply({ error: 'TMAP_APP_KEY not set' }, 503)
    if (!isKoreanPoint(body.from) || !isKoreanPoint(body.to)) return reply({ error: 'invalid points' }, 400)
    const { from, to } = body
    const res = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json', {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', appKey: TMAP_KEY },
      body: JSON.stringify({
        startX: from.lng,
        startY: from.lat,
        endX: to.lng,
        endY: to.lat,
        startName: encodeURIComponent(from.name ?? '출발'),
        endName: encodeURIComponent(to.name ?? '도착'),
        reqCoordType: 'WGS84GEO',
        resCoordType: 'WGS84GEO',
      }),
    })
    // TMAP 응답을 그대로 돌려줌 (앱이 읽는 형식 그대로)
    return new Response(await res.text(), { status: res.status, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  return reply({ error: 'unknown provider' }, 400)
})
