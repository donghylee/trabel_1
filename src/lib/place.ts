import type { LatLng, Leg, Place, PlaceCategory, TravelMode } from '../types'
import { distanceMeters } from './travel'

/** 이름이 같고 이 거리 안이면 같은 장소로 봄 */
const SAME_PLACE_METERS = 300

/** 기본 목록의 경복궁과 검색 결과의 경복궁처럼 id가 달라도 같은 곳이면 true */
export function isSamePlace(a: Place, b: Place): boolean {
  return a.id === b.id || (a.name === b.name && distanceMeters(a.location, b.location) < SAME_PLACE_METERS)
}

/**
 * Google 지도에서 그 장소를 여는 주소.
 * Google 검색 결과(id가 "g-장소ID")면 정확한 장소 페이지, 아니면(가짜 데이터 등) 좌표로 연다.
 */
export function googleMapsUrl(place: { id: string; name: string; location: LatLng }): string {
  const params = new URLSearchParams({ api: '1' })
  if (place.id.startsWith('g-')) {
    params.set('query', place.name)
    params.set('query_place_id', place.id.slice(2))
  } else {
    params.set('query', `${place.location.lat},${place.location.lng}`)
  }
  return `https://www.google.com/maps/search/?${params}`
}

/**
 * 링크를 새 창으로 연다 (지금 창은 그대로 — 만들던 일정이 초기화되지 않게).
 * 어떤 환경에서는 target="_blank"가 같은 창에서 열려서, 크기를 정한 팝업 창으로 직접 연다.
 * 팝업이 막히면 새 탭으로라도 연다.
 */
export function openInNewWindow(event: { preventDefault: () => void; currentTarget: HTMLAnchorElement }) {
  event.preventDefault()
  const url = event.currentTarget.href
  const popup = window.open(url, '_blank', 'width=1200,height=850')
  if (popup) popup.opener = null
  else window.open(url, '_blank', 'noopener,noreferrer')
}

const googleModes: Record<TravelMode, string> = { walk: 'walking', transit: 'transit', taxi: 'driving' }
const naverModes: Record<TravelMode, string> = { walk: 'walk', transit: 'public', taxi: 'car' }

/** 한 구간(A→B) 길 안내를 Google 지도에서 여는 주소 — 구간 하나라 경유지 개수 제한이 없음 */
export function googleDirectionsUrl(leg: Leg, mode: TravelMode): string {
  const params = new URLSearchParams({
    api: '1',
    origin: `${leg.from.location.lat},${leg.from.location.lng}`,
    destination: `${leg.to.location.lat},${leg.to.location.lng}`,
    travelmode: googleModes[mode],
    dir_action: 'navigate',
  })
  return `https://www.google.com/maps/dir/?${params}`
}

/** 같은 구간을 네이버 지도 앱에서 여는 주소 (Google 지도는 한국에서 도보 길찾기가 안 됨) */
export function naverDirectionsUrl(leg: Leg, mode: TravelMode): string {
  const params = new URLSearchParams({
    slat: String(leg.from.location.lat),
    slng: String(leg.from.location.lng),
    sname: leg.from.name,
    dlat: String(leg.to.location.lat),
    dlng: String(leg.to.location.lng),
    dname: leg.to.name,
    appname: window.location.origin,
  })
  return `nmap://route/${naverModes[mode]}?${params}`
}

const naverWebModes: Record<TravelMode, string> = { walk: 'walk', transit: 'transit', taxi: 'car' }

/** 네이버 지도 웹 좌표(EPSG:3857, 미터)로 바꿈 */
function webMercator({ lat, lng }: LatLng): string {
  const R = 6378137
  const x = (lng * Math.PI * R) / 180
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
  return `${x.toFixed(1)},${y.toFixed(1)}`
}

/** 같은 구간을 네이버 지도 웹에서 여는 주소 — PC, 그리고 휴대폰에 앱이 없을 때 */
export function naverWebDirectionsUrl(leg: Leg, mode: TravelMode): string {
  const point = (p: Place) => `${webMercator(p.location)},${encodeURIComponent(p.name)},,`
  return `https://map.naver.com/p/directions/${point(leg.from)}/${point(leg.to)}/-/${naverWebModes[mode]}`
}

/**
 * 휴대폰: 네이버 지도 앱(data-app 주소)으로 길찾기. 앱이 없으면(1.5초 뒤에도 화면이 그대로면) 링크의 네이버 지도 웹으로.
 * shortcut: 앱이 떴는지는 화면이 가려졌는지로만 짐작함, 확인 창에서 취소해도 웹이 열릴 수 있음
 */
export function openNaverDirections(event: { preventDefault: () => void; currentTarget: HTMLAnchorElement }) {
  event.preventDefault()
  const web = event.currentTarget.href
  window.location.href = event.currentTarget.dataset.app!
  setTimeout(() => {
    // 팝업은 누른 직후에만 열 수 있어서 지금 화면에서 이동
    if (!document.hidden) window.location.href = web
  }, 1500)
}

/** 장소 종류별 기본 머무를 시간(분) */
export const defaultStay: Record<PlaceCategory, number> = {
  sight: 60,
  museum: 120,
  shopping: 60,
  nature: 60,
  food: 60,
  cafe: 30,
  lodging: 0,
}
