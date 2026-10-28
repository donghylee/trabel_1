import type { NearbyKind, NearbyPlace, Place, PlaceCategory, Recommendation } from '../types'
import { distanceMeters } from './travel'

/** 리뷰가 적을 때 별점을 이 값 쪽으로 끌어당김 */
const PRIOR_RATING = 3.8
/** 리뷰가 이만큼 있으면 실제 별점과 기준값을 반반 반영 */
const PRIOR_WEIGHT = 100
/** 동선에서 1km 멀어질 때마다 깎는 점수 */
const DISTANCE_PENALTY_PER_KM = 0.3
const MIN_RATING = 4.0
const MIN_REVIEWS = 50
const DETOUR = 1.3
const WALK_METERS_PER_MINUTE = 75

export const nearbyKindLabels: Record<NearbyKind, string> = {
  restaurant: '맛집',
  cafe: '카페',
  attraction: '관광',
}

export const nearbyKindIcons: Record<NearbyKind, string> = {
  restaurant: '🍜',
  cafe: '☕',
  attraction: '📸',
}

/** 리뷰 수를 반영한 보정 별점 — "리뷰 2개에 5.0점"이 1등이 되지 않도록 */
export function adjustedRating(rating: number, reviewCount: number): number {
  return (reviewCount * rating + PRIOR_WEIGHT * PRIOR_RATING) / (reviewCount + PRIOR_WEIGHT)
}

/**
 * 주변 장소 후보에 순위를 매긴다.
 * anchors 중 가장 가까운 방문지와의 거리로 감점하고, 이미 일정에 있는 곳은 뺀다.
 */
export function rankNearby(
  candidates: NearbyPlace[],
  anchors: Place[],
  excludeIds: Set<string>,
  limit: number,
): Recommendation[] {
  const seen = new Set<string>()
  const ranked: Recommendation[] = []

  for (const poi of candidates) {
    if (seen.has(poi.id) || excludeIds.has(poi.id)) continue
    seen.add(poi.id)
    if (poi.rating < MIN_RATING || poi.reviewCount < MIN_REVIEWS) continue

    let anchor = anchors[0]
    let straight = Infinity
    for (const a of anchors) {
      const d = distanceMeters(a.location, poi.location)
      if (d < straight) {
        straight = d
        anchor = a
      }
    }
    const meters = Math.round(straight * DETOUR)
    const adjusted = adjustedRating(poi.rating, poi.reviewCount)
    ranked.push({
      poi,
      anchor,
      meters,
      walkMinutes: Math.max(1, Math.round(meters / WALK_METERS_PER_MINUTE)),
      adjustedRating: adjusted,
      score: adjusted - (meters / 1000) * DISTANCE_PENALTY_PER_KM,
    })
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, limit)
}

const kindToCategory: Record<NearbyKind, PlaceCategory> = {
  restaurant: 'food',
  cafe: 'cafe',
  attraction: 'sight',
}

const kindStayMinutes: Record<NearbyKind, number> = {
  restaurant: 60,
  cafe: 30,
  attraction: 60,
}

/** 추천 장소를 일정에 넣을 수 있는 방문지로 변환 */
export function toPlace(poi: NearbyPlace): Place {
  return {
    id: poi.id,
    name: poi.name,
    category: kindToCategory[poi.kind],
    location: poi.location,
    defaultStayMinutes: kindStayMinutes[poi.kind],
  }
}
