import type { LatLng, Place, PlaceCategory } from '../types'
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
