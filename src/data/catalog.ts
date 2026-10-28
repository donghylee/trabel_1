import type { Country, Place } from '../types'
import { moreCountries } from './moreCountries'

// API 키를 받기 전까지 사용할 가짜 국가·지역·장소 데이터
export const countries: Country[] = [
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

export const categoryLabels = {
  sight: '명소',
  museum: '박물관',
  shopping: '쇼핑·거리',
  nature: '자연·전망',
  food: '음식점',
  cafe: '카페',
  lodging: '숙소',
} as const

export function findCountry(code: string | null): Country | undefined {
  return countries.find((c) => c.code === code)
}

/** 나라의 모든 기본 추천 장소 */
export function placesOf(country: Country): Place[] {
  return country.regions.flatMap((r) => r.places)
}
