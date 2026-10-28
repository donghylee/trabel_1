import type { LatLng, TravelMode } from '../types'

// 지도 라이브러리에 독립적인 입력 형식 — 무료 지도(Leaflet)와 Google 지도가 똑같이 받는다.

export type MapMarker = {
  id: string
  label: string
  title: string
  subtitle: string
  position: LatLng
  /**
   * stop = 방문지 번호 마커, lodging = 숙소, meal = 경로에 넣은 음식점(주황색 원) — 이 셋에 맞춰 지도 범위를 정함
   * poi = 추천 장소, candidate = 지금 보고 있는 검색 결과·지도에서 고른 위치
   */
  variant?: 'stop' | 'lodging' | 'meal' | 'poi' | 'candidate'
}

export type MapPath = {
  id: string
  points: LatLng[]
  mode: TravelMode
}

export type MapViewProps = {
  center: LatLng
  markers: MapMarker[]
  paths: MapPath[]
  /** 이 마커로 지도를 옮기고 말풍선을 연다. seq는 같은 마커를 다시 눌러도 동작하게 하는 값 */
  focus: { id: string; seq: number } | null
  onMarkerClick: (id: string) => void
  /** 마커가 아닌 지도 바닥을 눌렀을 때 */
  onMapClick?: (point: LatLng) => void
  /** 처음 확대 수준 (기본 13 = 동네) */
  initialZoom?: number
}

/** 지도 범위를 맞출 때 기준이 되는 마커 (추천·미리보기 마커는 제외) */
export function isAnchorMarker(m: MapMarker): boolean {
  return !m.variant || m.variant === 'stop' || m.variant === 'lodging' || m.variant === 'meal'
}
