import { getLang, t, translateKnown, type Lang } from '../i18n'
import type { Country, Place, PlaceCategory } from '../types'
import { moreCountries } from './moreCountries'
import { countryNamesEn, placeNamesEn, regionNamesEn } from './namesEn'

// API 키를 받기 전까지 사용할 가짜 국가·지역·장소 데이터
const baseCountries: Country[] = [
  {
    code: 'KR',
    name: '대한민국',
    flag: '🇰🇷',
    currency: 'KRW',
    utcOffsetHours: 9,
    center: { lat: 37.5665, lng: 126.978 },
    bounds: [124.5, 33.0, 131.9, 38.7],
    regions: [
      {
        id: 'seoul',
        name: '서울',
        center: { lat: 37.5665, lng: 126.978 },
        places: [
          { id: 'gyeongbokgung', name: '경복궁', category: 'sight', location: { lat: 37.5796, lng: 126.977 }, defaultStayMinutes: 120 },
          { id: 'bukchon', name: '북촌한옥마을', category: 'sight', location: { lat: 37.5826, lng: 126.9836 }, defaultStayMinutes: 90 },
          { id: 'insadong', name: '인사동', category: 'shopping', location: { lat: 37.5741, lng: 126.985 }, defaultStayMinutes: 60 },
          { id: 'museum-korea', name: '국립중앙박물관', category: 'museum', location: { lat: 37.5239, lng: 126.9804 }, defaultStayMinutes: 120 },
          { id: 'myeongdong', name: '명동', category: 'shopping', location: { lat: 37.5636, lng: 126.9826 }, defaultStayMinutes: 90 },
          { id: 'namsan', name: 'N서울타워', category: 'nature', location: { lat: 37.5512, lng: 126.9882 }, defaultStayMinutes: 90 },
          { id: 'hangang', name: '여의도 한강공원', category: 'nature', location: { lat: 37.5284, lng: 126.9341 }, defaultStayMinutes: 60 },
        ],
      },
      {
        id: 'busan',
        name: '부산',
        center: { lat: 35.1796, lng: 129.0756 },
        places: [
          { id: 'haeundae', name: '해운대 해수욕장', category: 'nature', location: { lat: 35.1587, lng: 129.1604 }, defaultStayMinutes: 90 },
          { id: 'gamcheon', name: '감천문화마을', category: 'sight', location: { lat: 35.0975, lng: 129.0106 }, defaultStayMinutes: 90 },
          { id: 'jagalchi', name: '자갈치시장', category: 'shopping', location: { lat: 35.0966, lng: 129.0306 }, defaultStayMinutes: 60 },
          { id: 'gwangalli', name: '광안리 해수욕장', category: 'nature', location: { lat: 35.1532, lng: 129.1187 }, defaultStayMinutes: 60 },
          { id: 'haedong', name: '해동용궁사', category: 'sight', location: { lat: 35.1884, lng: 129.2233 }, defaultStayMinutes: 60 },
        ],
      },
    ],
  },
  {
    code: 'JP',
    name: '일본',
    flag: '🇯🇵',
    currency: 'JPY',
    utcOffsetHours: 9,
    center: { lat: 35.6812, lng: 139.7671 },
    bounds: [122.9, 24.0, 146.0, 45.6],
    regions: [
      {
        id: 'tokyo',
        name: '도쿄',
        center: { lat: 35.6812, lng: 139.7671 },
        places: [
          { id: 'sensoji', name: '센소지', category: 'sight', location: { lat: 35.7148, lng: 139.7967 }, defaultStayMinutes: 90 },
          { id: 'skytree', name: '도쿄 스카이트리', category: 'sight', location: { lat: 35.7101, lng: 139.8107 }, defaultStayMinutes: 90 },
          { id: 'meiji', name: '메이지 신궁', category: 'nature', location: { lat: 35.6764, lng: 139.6993 }, defaultStayMinutes: 60 },
          { id: 'shibuya', name: '시부야 스크램블 교차로', category: 'shopping', location: { lat: 35.6595, lng: 139.7005 }, defaultStayMinutes: 60 },
          { id: 'ueno', name: '도쿄 국립박물관', category: 'museum', location: { lat: 35.7188, lng: 139.7765 }, defaultStayMinutes: 120 },
          { id: 'ginza', name: '긴자', category: 'shopping', location: { lat: 35.6717, lng: 139.765 }, defaultStayMinutes: 90 },
        ],
      },
      {
        id: 'osaka',
        name: '오사카',
        center: { lat: 34.6937, lng: 135.5023 },
        places: [
          { id: 'osaka-castle', name: '오사카성', category: 'sight', location: { lat: 34.6873, lng: 135.5262 }, defaultStayMinutes: 120 },
          { id: 'dotonbori', name: '도톤보리', category: 'shopping', location: { lat: 34.6687, lng: 135.5013 }, defaultStayMinutes: 90 },
          { id: 'kuromon', name: '구로몬 시장', category: 'shopping', location: { lat: 34.6654, lng: 135.5066 }, defaultStayMinutes: 60 },
          { id: 'umeda-sky', name: '우메다 스카이빌딩', category: 'sight', location: { lat: 34.7053, lng: 135.4906 }, defaultStayMinutes: 60 },
          { id: 'tsutenkaku', name: '츠텐카쿠', category: 'sight', location: { lat: 34.6525, lng: 135.5063 }, defaultStayMinutes: 60 },
        ],
      },
    ],
  },
  ...moreCountries,
]

const categoryLabels: Record<PlaceCategory, string> = {
  sight: '명소',
  museum: '박물관',
  shopping: '쇼핑·거리',
  nature: '자연·전망',
  food: '음식점',
  cafe: '카페',
  lodging: '숙소',
}

export function categoryLabel(category: PlaceCategory): string {
  return t(categoryLabels[category])
}

// 언어별로 이름을 바꾼 나라 목록 (언어마다 한 번만 만들어 같은 객체를 돌려줌)
const localized: Partial<Record<Lang, Country[]>> = {}

/** 지금 언어의 나라 목록 */
export function getCountries(): Country[] {
  const lang = getLang()
  if (lang === 'ko') return baseCountries
  return (localized[lang] ??= baseCountries.map((c) => ({
    ...c,
    name: countryNamesEn[c.code] ?? c.name,
    regions: c.regions.map((r) => ({
      ...r,
      name: regionNamesEn[r.id] ?? r.name,
      places: r.places.map((p) => ({ ...p, name: placeNamesEn[p.id] ?? p.name })),
    })),
  })))
}

/**
 * 여행 이름(대제목)을 지금 언어로.
 * 저장할 때 앱이 넣어 준 기본 이름("일본 여행" / "Japan trip")과 예시 게시물 제목은 언어를 따라가고,
 * 사용자가 직접 지은 이름은 쓴 그대로 둔다.
 */
export function tripTitle(trip: { name: string; countryCode: string }): string {
  const base = baseCountries.find((c) => c.code === trip.countryCode)
  if (base) {
    const defaults = [`${base.name} 여행`, `${countryNamesEn[base.code] ?? base.name} trip`]
    if (defaults.includes(trip.name.trim())) {
      return t('{country} 여행', { country: findCountry(base.code)?.name ?? base.name })
    }
  }
  return translateKnown(trip.name)
}

/** 저장해 둔 기본 장소 이름(한국어)을 지금 언어로 — 기본 목록에 없는 이름은 그대로 */
export function localizePlaceName(name: string): string {
  if (getLang() === 'ko') return name
  for (const c of baseCountries) {
    for (const r of c.regions) {
      const place = r.places.find((p) => p.name === name)
      if (place) return placeNamesEn[place.id] ?? name
    }
  }
  return name
}

export function findCountry(code: string | null): Country | undefined {
  return getCountries().find((c) => c.code === code)
}

/** 나라의 모든 기본 추천 장소 */
export function placesOf(country: Country): Place[] {
  return country.regions.flatMap((r) => r.places)
}
