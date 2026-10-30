import { apiLanguage, t } from '../i18n'
import { defaultStay } from '../lib/place'
import { distanceMeters } from '../lib/travel'
import type { Country, LatLng, NearbyKind, NearbyPlace, Place } from '../types'
import { categoryFromTypes, countryBounds, inCountry, loadGeocoding, loadPlaces, toLatLng } from './google'

// Google Places API (New) 호출 모음. 키가 있을 때만 쓰인다.
// 별점(rating)·리뷰 수(userRatingCount)는 요금이 더 높은 등급의 필드라 꼭 필요한 곳에서만 요청한다.

const SEARCH_LIMIT = 10
/** 이미 고른 장소가 있을 때 이 반경 안을 우선해서 검색 */
const SEARCH_BIAS_RADIUS = 20000
const FAMOUS_RADIUS = 1500
const FAMOUS_LIMIT = 6
const RATED_RADIUS = 900
/** 지도에서 누른 곳에 가게·명소가 있다고 볼 거리 */
const PIN_POI_RADIUS = 40

const basicFields = ['id', 'displayName', 'location', 'formattedAddress', 'types']

/** 주소 앞의 나라 이름은 뺌 ("대한민국 서울특별시 …" → "서울특별시 …") */
function shortAddress(address: string | null | undefined): string | undefined {
  return address?.replace(/^(대한민국|일본|South Korea|Japan),?\s+/, '') || undefined
}

function toPlace(p: google.maps.places.Place): Place | null {
  const location = toLatLng(p.location)
  if (!location || !p.displayName) return null
  const category = categoryFromTypes(p.types)
  return {
    id: `g-${p.id}`,
    name: p.displayName,
    category,
    location,
    address: shortAddress(p.formattedAddress),
    defaultStayMinutes: defaultStay[category] || 60,
  }
}

/** 장소 이름 검색 */
export async function googleSearchPlaces(query: string, country: Country, near: LatLng | null): Promise<Place[]> {
  const { Place } = await loadPlaces()
  const { places } = await Place.searchByText({
    textQuery: query,
    fields: basicFields,
    language: apiLanguage(),
    region: country.code.toLowerCase(),
    maxResultCount: SEARCH_LIMIT,
    // 고른 장소가 있으면 그 근처 우선, 없으면 나라 안으로 한정
    ...(near
      ? { locationBias: { center: near, radius: SEARCH_BIAS_RADIUS } }
      : { locationRestriction: countryBounds(country) }),
  })
  return places.flatMap((p) => {
    const place = toPlace(p)
    return place && inCountry(place.location, country) ? [place] : []
  })
}

/** 지도에서 누른 위치 → 그 자리의 가게·명소, 없으면 주소 */
export async function googlePlaceAt(point: LatLng, country: Country): Promise<Place | null> {
  if (!inCountry(point, country)) return null
  const [{ Place, SearchNearbyRankPreference }, { Geocoder }] = await Promise.all([loadPlaces(), loadGeocoding()])

  const [nearby, geocoded] = await Promise.all([
    Place.searchNearby({
      fields: basicFields,
      locationRestriction: { center: point, radius: PIN_POI_RADIUS },
      rankPreference: SearchNearbyRankPreference.DISTANCE,
      maxResultCount: 1,
      language: apiLanguage(),
    }).catch(() => ({ places: [] as google.maps.places.Place[] })),
    new Geocoder().geocode({ location: point, language: apiLanguage() }).catch(() => ({ results: [] as google.maps.GeocoderResult[] })),
  ])

  const countryCode = geocoded.results[0]?.address_components.find((c) => c.types.includes('country'))?.short_name
  if (countryCode && countryCode !== country.code) return null

  const poi = nearby.places[0] ? toPlace(nearby.places[0]) : null
  // 좌표는 누른 위치 그대로 (가게 위치로 옮기지 않음)
  if (poi) return { ...poi, id: `pin-${poi.id}`, location: point }

  const address = shortAddress(geocoded.results[0]?.formatted_address)
  return {
    id: `pin-${point.lat.toFixed(5)},${point.lng.toFixed(5)}`,
    name: address ? t('{name} 근처', { name: address }) : t('지도에서 고른 위치'),
    category: 'sight',
    location: point,
    address,
    defaultStayMinutes: 60,
  }
}

/** 주변 유명한 곳 — Google 인기순 */
export async function googleFamousNearby(point: LatLng): Promise<Place[]> {
  const { Place, SearchNearbyRankPreference } = await loadPlaces()
  const { places } = await Place.searchNearby({
    fields: basicFields,
    locationRestriction: { center: point, radius: FAMOUS_RADIUS },
    includedTypes: ['tourist_attraction', 'museum', 'art_gallery', 'historical_landmark', 'park', 'observation_deck'],
    rankPreference: SearchNearbyRankPreference.POPULARITY,
    maxResultCount: FAMOUS_LIMIT + 2,
    language: apiLanguage(),
  })
  return places
    .flatMap((p) => {
      const place = toPlace(p)
      // 기준 위치 바로 그 장소는 빼고
      return place && distanceMeters(point, place.location) > 30 ? [place] : []
    })
    .slice(0, FAMOUS_LIMIT)
}

const typesByKind: Record<NearbyKind, string[]> = {
  restaurant: ['restaurant'],
  cafe: ['cafe', 'coffee_shop', 'bakery'],
  attraction: ['tourist_attraction', 'museum', 'art_gallery'],
}

/** 방문지 주변 맛집·카페·관광지 (별점·리뷰 수 포함) */
export async function googleNearbyRated(around: Place, kind: NearbyKind): Promise<NearbyPlace[]> {
  const { Place, SearchNearbyRankPreference } = await loadPlaces()
  const { places } = await Place.searchNearby({
    fields: ['id', 'displayName', 'location', 'rating', 'userRatingCount'],
    locationRestriction: { center: around.location, radius: RATED_RADIUS },
    includedTypes: typesByKind[kind],
    rankPreference: SearchNearbyRankPreference.POPULARITY,
    maxResultCount: 20,
    language: apiLanguage(),
  })
  return places.flatMap((p) => {
    const location = toLatLng(p.location)
    if (!location || !p.displayName || p.rating == null) return []
    return [
      {
        id: `g-${p.id}`,
        name: p.displayName,
        kind,
        location,
        rating: p.rating,
        reviewCount: p.userRatingCount ?? 0,
      },
    ]
  })
}
