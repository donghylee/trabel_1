import { distanceMeters } from '../lib/travel'
import type { LatLng, Place, PlaceCategory } from '../types'
import { defaultStay } from '../lib/place'
import { googleEnabled } from './google'
import { googleFamousNearby } from './googlePlaces'

// 어떤 위치 주변의 유명한 곳 — 키 없이 쓸 수 있는 한국어 위키백과의 위치 검색 사용.
// 위키백과에 문서가 있는 곳을 "유명한 곳"으로 보고, 문서가 길수록(=많이 다뤄진 곳일수록) 위로 올린다.
// 6단계에서 Google Places Nearby Search(인기순)로 바꿀 때는 이 파일만 바꾸면 된다.

const ENDPOINT = 'https://ko.wikipedia.org/w/api.php'
const RADIUS_METERS = 1500
const RESULT_LIMIT = 6
const TIMEOUT_MS = 10000
const RETRY_DELAY_MS = 1500

/** 관광지가 아닌 문서 — 괄호 설명을 뺀 이름에 적용 (대사관·학교·역·행정구역·사건·유물 하나 등) */
const NOT_A_SIGHT =
  /대사관|영사관|학교|대학|아파트|은행|병원|우체국|경찰서|주민센터|위원회|역$|정류장|사무소|관리소|구$|군$|시$|부$|의회|재판소|법원|사무처|청사|협회|재단|방송|^TV |배수로|화재|사고|사건|참사|\d+권|초상|의대$|상여|우물$|신중도/
/** 주거용 고층 건물·숙박시설 (문서가 길어도 관광지는 아님) */
const RESIDENTIAL = /더샵|위브|자이|아이파크|푸르지오|래미안|힐스테이트|롯데캐슬|e편한세상|제니스|골든스위트|동일타워|제이드|뮤에뜨|오피스텔|호텔$|레지던스/

type WikiPage = {
  pageid: number
  title: string
  length?: number
  coordinates?: { lat: number; lon: number }[]
}

function categoryOf(title: string): PlaceCategory {
  if (/박물관|미술관|기념관|전시관|갤러리/.test(title)) return 'museum'
  if (/공원|정원|산$|숲|호수|해수욕장|전망대|타워$/.test(title)) return 'nature'
  if (/시장|거리$|상가|백화점|몰$/.test(title)) return 'shopping'
  return 'sight'
}

/** "교태전 (경복궁)" → "교태전" — 괄호 설명은 이름에서 뺌 */
function cleanTitle(title: string): string {
  return title.replace(/\s*\(.*\)\s*$/, '')
}

const cache = new Map<string, Promise<Place[]>>()

export function famousNearby(point: LatLng): Promise<Place[]> {
  if (googleEnabled) return googleFamousNearby(point)
  // 비슷한 위치(약 100m)는 같은 결과를 씀
  const key = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`
  let result = cache.get(key)
  if (!result) {
    result = fetchFamousNearby(point)
    cache.set(key, result)
    // 실패한 결과는 캐시에 남기지 않음
    result.catch(() => cache.delete(key))
  }
  return result
}

async function fetchFamousNearby(point: LatLng): Promise<Place[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'geosearch',
    ggscoord: `${point.lat}|${point.lng}`,
    ggsradius: String(RADIUS_METERS),
    ggslimit: '50',
    prop: 'coordinates|info',
    colimit: 'max', // 기본값(10)이면 50곳 중 10곳만 좌표가 옴
    format: 'json',
    origin: '*', // 브라우저에서 직접 호출 허용
  })
  type Response = { query?: { pages: Record<string, WikiPage> }; error?: { info: string } }
  let data: Response | null = null
  // 위키백과 위치 검색은 가끔 "Search is currently too busy"를 돌려줘서 한 번 더 시도
  for (let attempt = 0; attempt < 2 && !data?.query; attempt++) {
    if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    const res = await fetch(`${ENDPOINT}?${params}`, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) throw new Error(`주변 장소를 불러오지 못했습니다 (${res.status})`)
    data = await res.json()
  }
  // 일시적인 오류는 빈 결과가 아니라 실패로 처리 (캐시에 남지 않게)
  if (data?.error) throw new Error('주변 장소 검색이 잠시 바쁩니다. 다른 곳을 눌렀다가 다시 시도해 주세요.')

  const candidates = Object.values(data?.query?.pages ?? {}).flatMap((page) => {
    const coord = page.coordinates?.[0]
    const name = cleanTitle(page.title)
    if (!coord || NOT_A_SIGHT.test(name) || RESIDENTIAL.test(name)) return []
    const location = { lat: coord.lat, lng: coord.lon }
    const category = categoryOf(name)
    const meters = distanceMeters(point, location)
    // 문서 길이(로그)로 유명도를 보고, 멀수록 조금 깎음
    const score = Math.log10(page.length ?? 1000) - meters / RADIUS_METERS
    const place: Place = {
      id: `wiki-${page.pageid}`,
      name,
      category,
      location,
      defaultStayMinutes: defaultStay[category],
    }
    return [{ place, score }]
  })

  candidates.sort((a, b) => b.score - a.score)
  const seen = new Set<string>()
  return candidates
    .filter(({ place }) => !seen.has(place.name) && seen.add(place.name))
    .slice(0, RESULT_LIMIT)
    .map(({ place }) => place)
}
