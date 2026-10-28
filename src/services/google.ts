import { Loader } from '@googlemaps/js-api-loader'
import { config } from '../config'
import type { Country, LatLng, PlaceCategory } from '../types'

// Google Maps Platform 연결.
// Google 키가 설정돼 있으면(.env.local 또는 Docker 환경변수) 지도·검색·주변 장소를 Google로, 없으면 무료 서비스로 동작한다.

const API_KEY = config.googleMapsApiKey

/** Google을 쓸 수 있는지 (키가 설정됐는지) */
export const googleEnabled = !!API_KEY

/** 고급 마커(AdvancedMarkerElement)에 필요한 지도 ID — 개발 중에는 Google이 제공하는 DEMO_MAP_ID */
export const GOOGLE_MAP_ID = config.googleMapId || 'DEMO_MAP_ID'

let loader: Loader | null = null

function getLoader(): Loader {
  if (!API_KEY) throw new Error('Google Maps API 키가 없습니다 (.env.local 확인)')
  loader ??= new Loader({ apiKey: API_KEY, version: 'weekly', language: 'ko' })
  return loader
}

export const loadMaps = () => getLoader().importLibrary('maps')
export const loadMarker = () => getLoader().importLibrary('marker')
export const loadPlaces = () => getLoader().importLibrary('places')
export const loadGeocoding = () => getLoader().importLibrary('geocoding')

/** Google 장소 종류 → 앱의 장소 분류 */
export function categoryFromTypes(types: string[] | null | undefined): PlaceCategory {
  const t = new Set(types ?? [])
  if (['lodging', 'hotel', 'motel', 'hostel', 'guest_house', 'resort_hotel'].some((x) => t.has(x))) return 'lodging'
  if (['museum', 'art_gallery'].some((x) => t.has(x))) return 'museum'
  if (t.has('cafe') || t.has('coffee_shop') || t.has('bakery')) return 'cafe'
  if (t.has('restaurant') || t.has('food') || t.has('meal_takeaway')) return 'food'
  if (['shopping_mall', 'department_store', 'market', 'store'].some((x) => t.has(x))) return 'shopping'
  if (['park', 'natural_feature', 'beach', 'hiking_area', 'garden', 'observation_deck'].some((x) => t.has(x))) return 'nature'
  return 'sight'
}

export function toLatLng(location: google.maps.LatLng | null | undefined): LatLng | null {
  return location ? { lat: location.lat(), lng: location.lng() } : null
}

/** 나라 검색 범위를 Google 형식으로 */
export function countryBounds(country: Country): google.maps.LatLngBoundsLiteral {
  const [west, south, east, north] = country.bounds
  return { west, south, east, north }
}

export function inCountry(point: LatLng, country: Country): boolean {
  const [west, south, east, north] = country.bounds
  return point.lng >= west && point.lng <= east && point.lat >= south && point.lat <= north
}
