import { t } from '../i18n'
import { defaultStay } from '../lib/place'
import { distanceMeters } from '../lib/travel'
import { googlePlaceAt, googleSearchPlaces } from './googlePlaces'
import { googleEnabled } from './google'
import type { Country, LatLng, Place, PlaceCategory } from '../types'

// 장소 이름 검색 — 지금은 키 없이 쓸 수 있는 OpenStreetMap 기반 Photon API 사용.
// 6단계에서 Google Places Autocomplete로 바꿀 때는 searchPlaces 안쪽만 바꾸면 된다.
// Photon 공개 서버는 무료 대신 과도한 호출을 자제해야 하므로 입력을 잠시 멈췄을 때만 호출한다.

const ENDPOINT = 'https://photon.komoot.io/api/'
const REVERSE_ENDPOINT = 'https://photon.komoot.io/reverse'
const RESULT_LIMIT = 10
/** 이름이 같고 이 거리 안이면 같은 장소로 보고 하나만 남김 (OSM은 건물·시설을 따로 등록하기도 함) */
const DUPLICATE_METERS = 300

type PhotonFeature = {
  geometry: { coordinates: [number, number] }
  properties: {
    osm_type: string
    osm_id: number
    osm_key: string
    osm_value: string
    name?: string
    street?: string
    housenumber?: string
    district?: string
    city?: string
    countrycode?: string
  }
}

export function categoryOf(key: string, value: string): PlaceCategory {
  if (['hotel', 'hostel', 'guest_house', 'motel', 'apartment', 'chalet', 'camp_site'].includes(value)) return 'lodging'
  if (value === 'museum' || value === 'gallery') return 'museum'
  if (key === 'amenity' && ['restaurant', 'fast_food', 'food_court'].includes(value)) return 'food'
  if (key === 'amenity' && value === 'cafe') return 'cafe'
  if (key === 'shop' || value === 'marketplace' || value === 'mall') return 'shopping'
  if (key === 'leisure' || key === 'natural' || value === 'viewpoint' || value === 'park') return 'nature'
  return 'sight'
}


function addressOf(p: PhotonFeature['properties']): string {
  const street = [p.street, p.housenumber].filter(Boolean).join(' ')
  return [p.city, p.district, street].filter(Boolean).join(' ')
}

/**
 * 나라 안에서 장소를 검색한다.
 * near를 주면 그 근처 결과가 위로 오고, 없으면 유명한 곳이 위로 온다.
 */
export async function searchPlaces(
  query: string,
  country: Country,
  near: LatLng | null,
  signal?: AbortSignal,
): Promise<Place[]> {
  if (googleEnabled) return googleSearchPlaces(query, country, near)
  const params = new URLSearchParams({
    q: query,
    limit: String(RESULT_LIMIT),
    bbox: country.bounds.join(','),
  })
  if (near) {
    params.set('lat', String(near.lat))
    params.set('lon', String(near.lng))
  }
  const res = await fetch(`${ENDPOINT}?${params}`, { signal })
  if (!res.ok) throw new Error(t('검색 실패 ({status})', { status: res.status }))
  const data: { features: PhotonFeature[] } = await res.json()

  const places: Place[] = []
  for (const f of data.features) {
    const p = f.properties
    if (!p.name || (p.countrycode && p.countrycode !== country.code)) continue
    const location = { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }
    const duplicate = places.some(
      (other) => other.name === p.name && distanceMeters(other.location, location) < DUPLICATE_METERS,
    )
    if (duplicate) continue
    const category = categoryOf(p.osm_key, p.osm_value)
    places.push({
      id: `osm-${p.osm_type}${p.osm_id}`,
      name: p.name,
      category,
      location,
      address: addressOf(p),
      defaultStayMinutes: defaultStay[category],
    })
  }
  return places
}

/**
 * 지도에서 누른 위치를 장소로 바꾼다.
 * 가장 가까운 건물·시설 이름을 붙이고, 이름이 없으면 주소로 부른다. 좌표는 누른 위치 그대로.
 * 고른 나라 밖이면 null.
 */
export async function placeAt(point: LatLng, country: Country, signal?: AbortSignal): Promise<Place | null> {
  if (googleEnabled) return googlePlaceAt(point, country)
  const params = new URLSearchParams({ lat: String(point.lat), lon: String(point.lng), limit: '1' })
  const res = await fetch(`${REVERSE_ENDPOINT}?${params}`, { signal })
  if (!res.ok) throw new Error(t('위치 확인 실패 ({status})', { status: res.status }))
  const data: { features: PhotonFeature[] } = await res.json()
  const p = data.features[0]?.properties
  if (p?.countrycode && p.countrycode !== country.code) return null

  const address = p ? addressOf(p) : ''
  const category = p?.name ? categoryOf(p.osm_key, p.osm_value) : 'sight'
  // 가장 가까운 게 길·동네 이름이면 그 장소 자체가 아니므로 "근처"를 붙임
  const isArea = p?.osm_key === 'highway' || p?.osm_key === 'place' || p?.osm_key === 'boundary'
  const name = p?.name ? (isArea ? t('{name} 근처', { name: p.name }) : p.name) : address || t('지도에서 고른 위치')
  return {
    id: `pin-${point.lat.toFixed(5)},${point.lng.toFixed(5)}`,
    name,
    category,
    location: point,
    address,
    defaultStayMinutes: defaultStay[category] || 60,
  }
}
