import type { Place, PlaceCategory } from '../types'
import { distanceMeters } from './travel'

/** 이름이 같고 이 거리 안이면 같은 장소로 봄 */
const SAME_PLACE_METERS = 300

/** 기본 목록의 경복궁과 검색 결과의 경복궁처럼 id가 달라도 같은 곳이면 true */
export function isSamePlace(a: Place, b: Place): boolean {
  return a.id === b.id || (a.name === b.name && distanceMeters(a.location, b.location) < SAME_PLACE_METERS)
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
