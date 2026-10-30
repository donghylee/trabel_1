import { currencies, formatMoney } from '../data/currencies'
import type { Currency, LatLng, Leg, Place, TravelMode, TravelOption } from '../types'

// 실제 경로 API를 붙이기 전까지 쓰는 이동시간 추정 모델.
// 6단계에서 estimateLeg만 TMAP·ODsay·Google Routes 호출로 바꾸면 나머지는 그대로 동작한다.

/** 직선거리 → 실제 길 거리 보정 계수 */
const DETOUR = 1.3
/** 이 거리 이하는 대중교통·택시 후보를 만들지 않음 */
const MIN_RIDE_METERS = 700
/** 도보가 이 시간 이하면 무조건 도보 추천 */
const WALK_PREFERRED_MINUTES = 15
/** 대중교통 이용 시 정류장까지 걷는 거리(m)와 시간(분) */
const TRANSIT_WALK_METERS = 600
const TRANSIT_WALK_MINUTES = 8

const speedMetersPerMinute: Record<TravelMode, number> = {
  walk: 75, // 4.5km/h
  transit: 333, // 20km/h (정차·환승 포함)
  taxi: 300, // 18km/h (도심 정체·신호 포함)
}

/** 점수 계산용 원화 환산율 */

export const modeLabels: Record<TravelMode, string> = {
  walk: '도보',
  transit: '대중교통',
  taxi: '택시',
}

export const modeIcons: Record<TravelMode, string> = {
  walk: '🚶',
  transit: '🚇',
  taxi: '🚕',
}

/** 지도 경로선 스타일 */
export const pathStyles: Record<TravelMode, { color: string; dashArray?: string }> = {
  walk: { color: '#16a34a', dashArray: '6 8' },
  transit: { color: '#f86a07' },
  // 대중교통이 시그니처 주황이라 택시는 구분되게 보라
  taxi: { color: '#7c3aed' },
}

/** 두 좌표 사이 직선거리(m) */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000
  const rad = (deg: number) => (deg * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function transitFare(currency: Currency): number {
  return currencies[currency].transitFare
}

export function taxiFare(meters: number, currency: Currency): number {
  const { base, baseMeters, stepMeters, stepFare } = currencies[currency].taxi
  const fare = base + Math.ceil(Math.max(0, meters - baseMeters) / stepMeters) * stepFare
  // 작은 단위 통화는 소수 첫째 자리까지, 나머지는 정수로
  return currencies[currency].decimals > 0 ? Math.round(fare * 10) / 10 : Math.round(fare)
}

/**
 * 이동수단별 점수 — 낮을수록 좋음.
 * 소요시간 + 걷는 부담 + 환승 부담 + 비용 부담
 */
function score(option: TravelOption, currency: Currency): number {
  const walkMinutes = option.mode === 'walk' ? option.minutes : option.mode === 'transit' ? TRANSIT_WALK_MINUTES : 0
  const fareKRW = (option.fare ?? 0) * currencies[currency].toKRW
  return option.minutes + walkMinutes * 0.5 + (option.transfers ?? 0) * 5 + (fareKRW / 1000) * 5
}

export function recommend(options: TravelOption[], currency: Currency): TravelMode {
  const walk = options.find((o) => o.mode === 'walk')
  if (walk && walk.minutes <= WALK_PREFERRED_MINUTES) return 'walk'
  return options.reduce((best, o) => (score(o, currency) < score(best, currency) ? o : best)).mode
}

export function estimateLeg(from: Place, to: Place, currency: Currency): Leg {
  const meters = Math.round(distanceMeters(from.location, to.location) * DETOUR)
  const options: TravelOption[] = [
    { mode: 'walk', minutes: Math.max(1, Math.round(meters / speedMetersPerMinute.walk)), meters, estimated: true },
  ]
  if (meters > MIN_RIDE_METERS) {
    options.push({
      mode: 'transit',
      minutes: Math.round(10 + meters / speedMetersPerMinute.transit), // 10분 = 정류장 이동 + 대기
      meters,
      fare: transitFare(currency),
      transfers: meters > 5000 ? 1 : 0,
      estimated: true,
    })
    options.push({
      mode: 'taxi',
      minutes: Math.round(3 + meters / speedMetersPerMinute.taxi), // 3분 = 호출·승차
      meters,
      fare: taxiFare(meters, currency),
      estimated: true,
    })
  }
  return { from, to, options, recommended: recommend(options, currency) }
}

export function recommendedOption(leg: Leg): TravelOption {
  return leg.options.find((o) => o.mode === leg.recommended)!
}

/** 추천 수단 기준으로 이 구간에서 걷는 거리(m) */
export function walkMetersOf(leg: Leg): number {
  const option = recommendedOption(leg)
  if (option.mode === 'walk') return option.meters
  if (option.mode === 'transit') return TRANSIT_WALK_METERS
  return 0
}

export function formatFare(fare: number, currency: Currency): string {
  return formatMoney(fare, currency)
}

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`
}
