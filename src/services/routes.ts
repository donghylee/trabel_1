import { config } from '../config'
import { decodePolyline } from '../lib/polyline'
import { estimateLeg, modeLabels, recommend, taxiFare, transitFare } from '../lib/travel'
import type { Country, LatLng, Leg, Place, TravelMode, TravelOption } from '../types'
import { googleEnabled } from './google'

// 실제 길찾기 — 나라·이동수단마다 쓸 수 있는 API를 고르고, 없거나 실패하면 거리 추정값을 그대로 쓴다.
//   한국  도보: TMAP / 대중교통: ODsay(요금 포함) → 없으면 Google / 택시: 추정 (Google은 한국 도보·자동차 길찾기 미제공)
//   일본  도보: Google / 대중교통: 추정 (Google이 일본 대중교통 길찾기를 제공하지 않음) / 택시: Google 시간 + 요금 추정
//   그 밖의 나라(베트남·대만·태국 등)  도보·대중교통·택시 모두 Google (요금은 받으면 실제, 못 받으면 추정)
// 키가 브라우저에 보이므로 각 서비스 콘솔에서 사용처(localhost 등) 제한을 꼭 걸어야 한다.

const GOOGLE_KEY = config.googleMapsApiKey
const ODSAY_KEY = config.odsayApiKey
const TMAP_KEY = config.tmapAppKey
const TIMEOUT_MS = 12000

type Provider = 'TMAP' | 'ODsay' | 'Google'
type RouteResult = Omit<TravelOption, 'mode'>

/** 나라별로 각 이동수단을 어디서 가져오는지 (없으면 추정) */
export function routeProviders(country: Country): Record<TravelMode, Provider | null> {
  if (country.code === 'KR') {
    return {
      walk: TMAP_KEY ? 'TMAP' : null,
      transit: ODSAY_KEY ? 'ODsay' : googleEnabled ? 'Google' : null,
      taxi: null,
    }
  }
  return {
    walk: googleEnabled ? 'Google' : null,
    transit: googleEnabled && country.code !== 'JP' ? 'Google' : null,
    taxi: googleEnabled ? 'Google' : null,
  }
}

export function hasRealRouting(country: Country): boolean {
  return Object.values(routeProviders(country)).some(Boolean)
}

/** 시간표 아래에 보여줄 "이동시간을 어디서 가져왔는지" 안내 */
export function routeNote(country: Country): string {
  if (!hasRealRouting(country)) {
    return '이동시간은 거리로 계산한 추정치이고, 지도 경로선은 직선입니다. 경로 API 키를 넣으면 실제 경로로 바뀝니다.'
  }
  const providers = routeProviders(country)
  const modes: TravelMode[] = ['walk', 'transit', 'taxi']
  const parts = modes.map((mode) => `${modeLabels[mode]} ${providers[mode] ?? '거리 추정'}`)
  return `이동시간 기준: ${parts.join(' · ')}. "추정"이 붙은 값은 거리로 계산한 값입니다.`
}

/** 일정의 출발 시각(자정부터 분)을 "내일 그 시각"의 UTC 시간으로 — 대중교통 시간표 조회용 */
function departureIso(country: Country, minutesOfDay: number): string {
  const now = new Date()
  const local = new Date(now.getTime() + country.utcOffsetHours * 3600_000)
  const utcMidnightOfLocalTomorrow = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1)
  return new Date(utcMidnightOfLocalTomorrow + (minutesOfDay - country.utcOffsetHours * 60) * 60_000).toISOString()
}

async function googleRoute(
  from: LatLng,
  to: LatLng,
  mode: 'WALK' | 'TRANSIT' | 'DRIVE',
  departure: string,
): Promise<RouteResult | null> {
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_KEY ?? '',
      'X-Goog-FieldMask':
        'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.travelAdvisory.transitFare,routes.legs.steps.transitDetails.stopCount',
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: mode,
      languageCode: 'ko',
      ...(mode === 'TRANSIT' ? { departureTime: departure } : {}),
    }),
  })
  if (!res.ok) throw new Error(`Google 경로 오류 (${res.status})`)
  const route = (await res.json()).routes?.[0]
  if (!route) return null
  const rides = (route.legs?.[0]?.steps ?? []).filter((s: { transitDetails?: unknown }) => s.transitDetails).length
  const fare = route.travelAdvisory?.transitFare
  return {
    minutes: Math.max(1, Math.round(parseInt(route.duration, 10) / 60)),
    meters: route.distanceMeters ?? 0,
    path: route.polyline?.encodedPolyline ? decodePolyline(route.polyline.encodedPolyline) : undefined,
    transfers: mode === 'TRANSIT' ? Math.max(0, rides - 1) : undefined,
    fare: fare?.units ? Number(fare.units) : undefined,
    source: 'Google',
  }
}

async function odsayTransit(from: LatLng, to: LatLng): Promise<RouteResult | null> {
  const key = encodeURIComponent(ODSAY_KEY ?? '')
  const url = `https://api.odsay.com/v1/api/searchPubTransPathT?SX=${from.lng}&SY=${from.lat}&EX=${to.lng}&EY=${to.lat}&apiKey=${key}`
  const json = await (await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })).json()
  // -98: 출발·도착이 700m 이내 → 대중교통 없음 (걷기)
  if (json.error) {
    const code = String(json.error.code ?? json.error[0]?.code ?? '')
    if (code === '-98') return null
    throw new Error(`ODsay 오류 (${json.error.msg ?? json.error[0]?.message ?? code})`)
  }
  const best = json.result?.path?.[0]
  if (!best) return null
  const info = best.info
  let path: LatLng[] | undefined
  try {
    // 노선 모양 (실패해도 시간·요금은 씀)
    const lane = await (
      await fetch(`https://api.odsay.com/v1/api/loadLane?mapObject=0:0@${info.mapObj}&apiKey=${key}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    ).json()
    const points: LatLng[] = (lane.result?.lane ?? []).flatMap((l: { section: { graphPos: { x: number; y: number }[] }[] }) =>
      l.section.flatMap((s) => s.graphPos.map((p) => ({ lat: p.y, lng: p.x }))),
    )
    if (points.length > 1) path = [from, ...points, to]
  } catch {
    path = undefined
  }
  return {
    minutes: info.totalTime,
    meters: Math.round(info.totalDistance ?? 0),
    fare: info.payment,
    transfers: Math.max(0, (info.busTransitCount ?? 0) + (info.subwayTransitCount ?? 0) - 1),
    path,
    source: 'ODsay',
  }
}

async function tmapWalk(from: Place, to: Place): Promise<RouteResult | null> {
  const res = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1&format=json', {
    method: 'POST',
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { 'Content-Type': 'application/json', appKey: TMAP_KEY ?? '' },
    body: JSON.stringify({
      startX: from.location.lng,
      startY: from.location.lat,
      endX: to.location.lng,
      endY: to.location.lat,
      startName: encodeURIComponent(from.name),
      endName: encodeURIComponent(to.name),
      reqCoordType: 'WGS84GEO',
      resCoordType: 'WGS84GEO',
    }),
  })
  if (!res.ok) throw new Error(`TMAP 오류 (${res.status})`)
  const features: { geometry: { type: string; coordinates: number[][] }; properties: Record<string, number> }[] =
    (await res.json()).features ?? []
  const summary = features[0]?.properties
  if (!summary?.totalTime) return null
  const path = features
    .filter((f) => f.geometry.type === 'LineString')
    .flatMap((f) => f.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })))
  return {
    minutes: Math.max(1, Math.round(summary.totalTime / 60)),
    meters: summary.totalDistance,
    path: path.length > 1 ? path : undefined,
    source: 'TMAP',
  }
}

async function fetchMode(
  mode: TravelMode,
  provider: Provider,
  from: Place,
  to: Place,
  departure: string,
): Promise<RouteResult | null> {
  if (provider === 'TMAP') return tmapWalk(from, to)
  if (provider === 'ODsay') return odsayTransit(from.location, to.location)
  const googleMode = mode === 'walk' ? 'WALK' : mode === 'transit' ? 'TRANSIT' : 'DRIVE'
  return googleRoute(from.location, to.location, googleMode, departure)
}

const cache = new Map<string, Promise<Leg>>()

/**
 * 두 지점 사이 구간을 실제 길찾기로 계산.
 * 길찾기가 안 되는 이동수단은 거리 추정값을 그대로 두고(estimated), 실패해도 추정값으로 돌려준다.
 */
export function fetchLeg(from: Place, to: Place, country: Country, departureMinutes: number): Promise<Leg> {
  const key = `${from.location.lat},${from.location.lng}>${to.location.lat},${to.location.lng}`
  let result = cache.get(key)
  if (!result) {
    result = computeLeg(from, to, country, departureMinutes)
    cache.set(key, result)
  }
  return result
}

async function computeLeg(from: Place, to: Place, country: Country, departureMinutes: number): Promise<Leg> {
  const estimate = estimateLeg(from, to, country.currency)
  const providers = routeProviders(country)
  const departure = departureIso(country, departureMinutes)

  const options = await Promise.all(
    estimate.options.map(async (option): Promise<TravelOption> => {
      const provider = providers[option.mode]
      if (!provider) return option
      try {
        const real = await fetchMode(option.mode, provider, from, to, departure)
        if (!real) return option
        // 요금을 못 받으면 거리 기준 요금을 표시하고 "요금 추정"으로 표시
        const fare =
          real.fare ??
          (option.mode === 'transit' ? transitFare(country.currency) : option.mode === 'taxi' ? taxiFare(real.meters, country.currency) : undefined)
        return {
          ...real,
          mode: option.mode,
          fare,
          fareEstimated: fare !== undefined && real.fare === undefined,
          estimated: false,
        }
      } catch {
        return option
      }
    }),
  )
  return { from, to, options, recommended: recommend(options, country.currency) }
}
