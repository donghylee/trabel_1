import type { Place } from '../types'
import { googleEnabled, loadPlaces } from './google'

// 시간표 방문지 옆 작은 사진. Google 키가 있을 때만 (사진은 요금이 드는 필드라 장소마다 한 번만 받아 둔다).
// 키가 없거나 사진이 없으면 null → 화면에서는 장소 종류 아이콘을 대신 보여 준다.

const THUMB_PX = 120
const cache = new Map<string, Promise<string | null>>()

export function placePhoto(place: Place): Promise<string | null> {
  if (!googleEnabled) return Promise.resolve(null)
  let result = cache.get(place.id)
  if (!result) {
    result = fetchPhoto(place).catch(() => null)
    cache.set(place.id, result)
  }
  return result
}

async function fetchPhoto(place: Place): Promise<string | null> {
  const { Place } = await loadPlaces()
  // Google 검색으로 고른 곳은 id로 바로, 기본 추천 장소·지도에서 고른 곳은 이름+위치로 찾음
  const googleId = place.id.startsWith('g-') ? place.id.slice(2) : null
  let found: google.maps.places.Place | undefined
  if (googleId) {
    found = new Place({ id: googleId })
    await found.fetchFields({ fields: ['photos'] })
  } else {
    const { places } = await Place.searchByText({
      textQuery: place.name,
      fields: ['photos'],
      locationBias: { center: place.location, radius: 500 },
      maxResultCount: 1,
    })
    found = places[0]
  }
  return found?.photos?.[0]?.getURI({ maxWidth: THUMB_PX, maxHeight: THUMB_PX }) ?? null
}
