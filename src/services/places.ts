import { getLang } from '../i18n'
import type { Currency, NearbyKind, NearbyPlace, Place } from '../types'
import { googleEnabled } from './google'
import { googleNearbyRated } from './googlePlaces'

// 주변 장소 검색 (별점·리뷰 수 포함) — Google 키가 있으면 Google Places, 없으면 가짜 데이터.
// (같은 장소·종류는 다시 호출하지 않도록 캐시 — 실제 API에서는 호출 비용 절감)

const RESULTS_PER_SEARCH = 8
const SEARCH_RADIUS_METERS = 900

type Words = { prefix: string[]; kinds: Record<NearbyKind, string[]> }

/** 한국·일본 외 나라에서 쓰는 이름 조합 */
const defaultWords: Words = {
  prefix: ['로컬', '올드타운', '리버사이드', '선셋', '가든', '코너', '하버', '마켓', '골든', '블루'],
  kinds: {
    restaurant: ['누들', '쌀국수', '시푸드', '바비큐', '덮밥', '커리', '딤섬', '사테', '그릴', '키친'],
    cafe: ['커피', '베이커리', '티하우스', '디저트', '주스바', '로스터리'],
    attraction: ['사원', '전망대', '공원', '야시장', '갤러리', '광장', '박물관', '해변'],
  },
}

const words: Partial<Record<Currency, Words>> = {
  KRW: {
    prefix: ['원조', '할매', '명가', '골목', '한옥', '소문난', '옛날', '본가', '정든', '오래된'],
    kinds: {
      restaurant: ['칼국수', '순두부', '한정식', '국밥', '불고기', '비빔밥', '냉면', '삼계탕', '떡볶이', '보쌈'],
      cafe: ['커피', '베이커리', '찻집', '디저트', '로스터리', '빙수'],
      attraction: ['갤러리', '전망대', '공원', '기념관', '전통시장', '산책로', '공방', '서점'],
    },
  },
  JPY: {
    prefix: ['하나', '사쿠라', '미도리', '츠키', '야마', '카제', '코하쿠', '아오이', '토모', '유키'],
    kinds: {
      restaurant: ['라멘', '스시', '우동', '돈카츠', '야키토리', '오코노미야키', '텐동', '소바', '규동', '이자카야'],
      cafe: ['킷사텐', '말차 카페', '베이커리', '커피', '파르페', '와가시'],
      attraction: ['신사', '정원', '갤러리', '전망대', '상점가', '공원', '박물관', '거리'],
    },
  },
}

/** 영어 화면용 이름 조합 (나라 구분 없이) */
const englishWords: Words = {
  prefix: ['Local', 'Old Town', 'Riverside', 'Sunset', 'Garden', 'Corner', 'Harbor', 'Market', 'Golden', 'Blue'],
  kinds: {
    restaurant: ['Noodle House', 'Kitchen', 'Grill', 'Seafood', 'BBQ', 'Rice Bowl', 'Curry', 'Dumplings', 'Bistro', 'Diner'],
    cafe: ['Coffee', 'Bakery', 'Tea House', 'Dessert Bar', 'Juice Bar', 'Roastery'],
    attraction: ['Temple', 'Lookout', 'Park', 'Night Market', 'Gallery', 'Square', 'Museum', 'Beach'],
  },
}

/** 문자열 → 고정된 난수 씨앗 (같은 장소는 항상 같은 결과) */
function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededRandom(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mockSearch(around: Place, kind: NearbyKind, currency: Currency): NearbyPlace[] {
  const rand = seededRandom(hash(`${around.id}:${kind}`))
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)]
  const { prefix, kinds } = getLang() === 'en' ? englishWords : (words[currency] ?? defaultWords)

  return Array.from({ length: RESULTS_PER_SEARCH }, (_, i) => {
    const distance = 80 + rand() * SEARCH_RADIUS_METERS
    const angle = rand() * Math.PI * 2
    const lat = around.location.lat + (distance * Math.cos(angle)) / 111320
    const lng =
      around.location.lng + (distance * Math.sin(angle)) / (111320 * Math.cos((around.location.lat * Math.PI) / 180))
    return {
      id: `poi-${around.id}-${kind}-${i}`,
      name: `${pick(prefix)} ${pick(kinds[kind])}`,
      kind,
      location: { lat, lng },
      // 3.3 ~ 4.9, 높은 쪽에 몰리게
      rating: Math.round((4.9 - rand() ** 1.6 * 1.6) * 10) / 10,
      // 3 ~ 약 5,000개, 적은 쪽에 몰리게
      reviewCount: Math.round(3 * Math.pow(1600, rand())),
    }
  })
}

const cache = new Map<string, Promise<NearbyPlace[]>>()

export function searchNearby(around: Place, kind: NearbyKind, currency: Currency): Promise<NearbyPlace[]> {
  // 가짜 데이터는 언어마다 이름이 달라서 언어도 키에 넣음
  const key = `${around.id}:${kind}:${getLang()}`
  let result = cache.get(key)
  if (!result) {
    result = googleEnabled
      ? googleNearbyRated(around, kind)
      : // 실제 API처럼 약간의 지연을 둠
        new Promise((resolve) => setTimeout(() => resolve(mockSearch(around, kind, currency)), 250))
    cache.set(key, result)
    // 실패한 결과는 캐시에 남기지 않음
    result.catch(() => cache.delete(key))
  }
  return result
}
