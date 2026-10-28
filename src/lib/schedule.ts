import type {
  Adjustment,
  Currency,
  Leg,
  MealChoices,
  MealKind,
  MealSlots,
  Place,
  Schedule,
  ScheduleItem,
  TripInput,
} from '../types'
import { toHHMM, toMinutes } from './time'
import { estimateLeg, recommendedOption, walkMetersOf } from './travel'

type Stop = { place: Place; stayMinutes: number }

const MEAL_MINUTES = 60
/** 식사 시간대 앞뒤로 이만큼까지는 식사를 넣어도 됨 */
const MEAL_SLACK = 30
/** 활동 시간이 식사 시간대와 이만큼 이상 겹쳐야 식사를 넣음 */
const MEAL_MIN_OVERLAP = 60
/** 이 개수까지는 모든 순서를 다 계산, 넘으면 근사 */
const EXACT_ORDER_LIMIT = 8

const mealWindows: { meal: MealKind; start: number; end: number }[] = [
  { meal: 'lunch', start: toMinutes('11:30'), end: toMinutes('13:30') },
  { meal: 'dinner', start: toMinutes('17:30'), end: toMinutes('19:30') },
]

export const mealLabels: Record<MealKind, string> = { lunch: '점심', dinner: '저녁' }

function stopsOf(input: TripInput, places: Place[]): Stop[] {
  return input.selections.flatMap((s) => {
    const place = places.find((p) => p.id === s.placeId)
    return place ? [{ place, stayMinutes: s.stayMinutes }] : []
  })
}

/** 실제 길찾기로 받아 둔 구간 ("출발id>도착id" → 구간) */
export type RealLegs = ReadonlyMap<string, Leg>

export const legKey = (fromId: string, toId: string) => `${fromId}>${toId}`

/** 지점 쌍마다 구간을 미리 계산 — 실제 길찾기 결과가 있으면 그것을, 없으면 거리 추정 */
function legMatrix(points: Place[], currency: Currency, realLegs?: RealLegs): Map<string, Leg> {
  const legs = new Map<string, Leg>()
  for (const a of points) {
    for (const b of points) {
      if (a === b) continue
      const key = legKey(a.id, b.id)
      legs.set(key, realLegs?.get(key) ?? estimateLeg(a, b, currency))
    }
  }
  return legs
}

function moveMinutes(legs: Map<string, Leg>, fromId: string, toId: string): number {
  return recommendedOption(legs.get(`${fromId}>${toId}`)!).minutes
}

/** 숙소처럼 고정된 출발·도착 지점 (없으면 null) */
type Ends = { start: string | null; end: string | null }

/** 방문 순서 앞뒤에 고정 지점을 붙인 전체 경로의 이동시간 */
function routeCost(legs: Map<string, Leg>, ids: string[], ends: Ends): number {
  const route = [...(ends.start ? [ends.start] : []), ...ids, ...(ends.end ? [ends.end] : [])]
  let cost = 0
  for (let i = 1; i < route.length; i++) cost += moveMinutes(legs, route[i - 1], route[i])
  return cost
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]
  return items.flatMap((item, i) =>
    permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  )
}

/** 첫 방문지마다 가장 가까운 곳부터 차례로 방문하는 근사 순서 중 최선 */
function nearestNeighborOrder(legs: Map<string, Leg>, ids: string[], ends: Ends): string[] {
  let best: string[] = ids
  for (const first of ids) {
    const route = [first]
    const left = new Set(ids.filter((id) => id !== first))
    while (left.size > 0) {
      const last = route[route.length - 1]
      const next = [...left].reduce((a, b) => (moveMinutes(legs, last, a) <= moveMinutes(legs, last, b) ? a : b))
      route.push(next)
      left.delete(next)
    }
    if (routeCost(legs, route, ends) < routeCost(legs, best, ends)) best = route
  }
  return best
}

/** 총 이동시간이 가장 짧은 방문 순서 (숙소 출발·복귀 구간 포함) */
function optimizeOrder(legs: Map<string, Leg>, ids: string[], ends: Ends): string[] {
  if (ids.length > EXACT_ORDER_LIMIT) return nearestNeighborOrder(legs, ids, ends)
  return permutations(ids).reduce((best, route) =>
    routeCost(legs, route, ends) < routeCost(legs, best, ends) ? route : best,
  )
}

/** 음식점을 고른 식사 — 정해진 자리(slot)에 경로 지점으로 들어감 */
type FixedMeal = { meal: MealKind; slot: number; near: Place; restaurant: Place }

/**
 * 입력 조건으로 하루 시간표를 만든다.
 * places는 선택한 id를 찾을 장소 목록(기본 추천 + 직접 추가한 곳).
 * order를 주면 그 순서를 따르고, 없으면 이동시간이 가장 짧은 순서를 찾는다.
 * 숙소가 있으면 숙소에서 출발하고 숙소로 돌아오는 구간까지 포함한다.
 * mealChoices에 음식점이 있으면 그 식사 자리에 음식점을 들러 가는 경로로 만든다.
 * mealSlots에 자리가 있으면(사용자가 끌어서 옮긴 경우) 그 자리를 따른다.
 * realLegs에 실제 길찾기 결과가 있으면 그 구간은 실제 이동시간을 쓴다.
 */
export function buildSchedule(
  input: TripInput,
  places: Place[],
  currency: Currency,
  order?: string[],
  mealChoices: MealChoices = {},
  mealSlots: MealSlots = {},
  realLegs?: RealLegs,
): Schedule {
  // 1차: 음식점 없이 계산해서 식사가 어느 자리(몇 번 다음)에 오는지 정함
  const base = layoutDay(input, places, currency, order, [], realLegs)
  const visits = base.items.flatMap((item) => (item.kind === 'visit' ? [item.place] : []))
  const fixed: FixedMeal[] = (Object.keys(mealChoices) as MealKind[]).flatMap((meal) => {
    const chosen = mealChoices[meal]
    const auto = base.items.find((item) => item.kind === 'meal' && item.meal === meal)
    const userSlot = mealSlots[meal]
    // 자동으로 식사가 안 들어가는 시간대라도 사용자가 자리를 정했으면 넣음
    if (!chosen || (!auto && userSlot === undefined)) return []
    const slot = Math.min(Math.max(userSlot ?? (auto?.kind === 'meal' ? auto.slot : 0), 0), visits.length)
    const near = visits[Math.max(slot - 1, 0)] ?? (auto?.kind === 'meal' ? auto.near : undefined)
    if (!near) return []
    const restaurant: Place = {
      id: `meal-${meal}-${chosen.id}`,
      name: chosen.name,
      category: 'food',
      location: chosen.location,
      defaultStayMinutes: MEAL_MINUTES,
    }
    return [{ meal, slot, near, restaurant }]
  })
  if (fixed.length === 0) return base
  // 같은 자리에 둘이면 점심 → 저녁 순
  fixed.sort((a, b) => a.slot - b.slot || (a.meal === 'lunch' ? -1 : 1))
  // 2차: 고른 음식점을 그 자리에 경로 지점으로 넣어 다시 계산 (방문 순서는 1차 그대로)
  return layoutDay(input, places, currency, base.order, fixed, realLegs)
}

function layoutDay(
  input: TripInput,
  places: Place[],
  currency: Currency,
  order: string[] | undefined,
  fixedMeals: FixedMeal[],
  realLegs?: RealLegs,
): Schedule {
  const stops = stopsOf(input, places)
  // 숙소를 방문지로도 넣은 경우와 겹치지 않도록 id를 구분
  const lodging = input.lodging ? { ...input.lodging, id: `lodging:${input.lodging.id}` } : null
  const startPoint = lodging && input.startFromLodging ? lodging : null
  const endPoint = lodging && input.returnToLodging ? lodging : null
  const ends: Ends = { start: startPoint?.id ?? null, end: endPoint?.id ?? null }

  const points = [...stops.map((s) => s.place), ...(lodging ? [lodging] : []), ...fixedMeals.map((f) => f.restaurant)]
  // 순서 정하기는 거리 추정만으로 (실제 값이 일부만 있으면 순서가 왔다 갔다 할 수 있음)
  const estimatedLegs = legMatrix(points, currency)
  // 시간표에는 실제 길찾기 값이 있으면 그것을 씀
  const legs = realLegs ? legMatrix(points, currency, realLegs) : estimatedLegs
  const ids = stops.map((s) => s.place.id)
  const finalOrder = order && order.length === ids.length && ids.every((id) => order.includes(id))
    ? order
    : optimizeOrder(estimatedLegs, ids, ends)

  const startAt = toMinutes(input.startTime)
  const limitAt = toMinutes(input.endTime)
  const meals = mealWindows.filter(
    (w) => Math.min(limitAt, w.end) - Math.max(startAt, w.start) >= MEAL_MIN_OVERLAP,
  )
  // 음식점을 고른 식사는 정해진 자리에서만 넣음
  const eaten = new Set<MealKind>(fixedMeals.map((f) => f.meal))

  const items: ScheduleItem[] = []
  let t = startAt
  let visitsDone = 0

  function tryMeal(near: Place) {
    for (const w of meals) {
      if (!eaten.has(w.meal) && t >= w.start - MEAL_SLACK && t <= w.end + MEAL_SLACK) {
        items.push({ kind: 'meal', meal: w.meal, near, start: t, end: t + MEAL_MINUTES, slot: visitsDone })
        t += MEAL_MINUTES
        eaten.add(w.meal)
      }
    }
  }

  /** slot번 다음에 들르는 음식점 — 지금 위치에서 음식점으로 이동하고 거기서 식사 */
  function fixedMealsAt(slot: number) {
    fixedMeals
      .filter((f) => f.slot === slot)
      .forEach((f) => {
        if (prevId) move(prevId, f.restaurant.id)
        items.push({
          kind: 'meal',
          meal: f.meal,
          near: f.near,
          start: t,
          end: t + MEAL_MINUTES,
          slot,
          restaurant: f.restaurant,
        })
        t += MEAL_MINUTES
        prevId = f.restaurant.id
      })
  }

  function move(fromId: string, toId: string) {
    const leg = legs.get(`${fromId}>${toId}`)!
    const minutes = recommendedOption(leg).minutes
    items.push({ kind: 'move', leg, start: t, end: t + minutes })
    t += minutes
  }

  if (startPoint) items.push({ kind: 'lodging', place: startPoint, role: 'depart', start: t, end: t })
  let prevId: string | null = startPoint?.id ?? null
  fixedMealsAt(0)

  finalOrder.forEach((id, i) => {
    const stop = stops.find((s) => s.place.id === id)!
    if (prevId) move(prevId, id)
    tryMeal(stop.place)
    items.push({ kind: 'visit', place: stop.place, order: i + 1, start: t, end: t + stop.stayMinutes })
    t += stop.stayMinutes
    visitsDone = i + 1
    prevId = id
    tryMeal(stop.place)
    fixedMealsAt(visitsDone)
  })

  if (endPoint && prevId && prevId !== endPoint.id) {
    move(prevId, endPoint.id)
    items.push({ kind: 'lodging', place: endPoint, role: 'arrive', start: t, end: t })
  }

  const moves = items.filter((it) => it.kind === 'move')
  return {
    items,
    order: finalOrder,
    startAt,
    endAt: t,
    limitAt,
    overMinutes: Math.max(0, t - limitAt),
    totalMoveMinutes: moves.reduce((sum, m) => sum + (m.end - m.start), 0),
    totalWalkMeters: moves.reduce((sum, m) => sum + walkMetersOf(m.leg), 0),
  }
}

/** 조정안을 입력 조건과 방문 순서에 반영 */
export function applyAdjustment(
  input: TripInput,
  order: string[] | null,
  adjustment: Adjustment,
): { input: TripInput; order: string[] | null } {
  switch (adjustment.kind) {
    case 'reduceStay':
      return {
        input: {
          ...input,
          selections: input.selections.map((s) =>
            s.placeId === adjustment.placeId ? { ...s, stayMinutes: adjustment.stayMinutes } : s,
          ),
        },
        order,
      }
    case 'remove':
      return {
        input: { ...input, selections: input.selections.filter((s) => s.placeId !== adjustment.placeId) },
        order: order?.filter((id) => id !== adjustment.placeId) ?? null,
      }
    case 'extendEnd':
      return { input: { ...input, endTime: adjustment.endTime }, order }
  }
}

/**
 * 종료 시각을 넘겼을 때 조정안을 찾는다.
 * 각 안을 실제로 적용해 다시 계산해 보고 시간 안에 들어오는 것만 제안한다.
 */
export function suggestAdjustments(
  input: TripInput,
  places: Place[],
  currency: Currency,
  schedule: Schedule,
  customOrder: string[] | null,
  mealChoices: MealChoices = {},
  mealSlots: MealSlots = {},
  realLegs?: RealLegs,
): Adjustment[] {
  if (schedule.overMinutes === 0) return []

  const fits = (adjustment: Adjustment) => {
    const next = applyAdjustment(input, customOrder, adjustment)
    if (next.input.selections.length === 0) return false
    const trial = buildSchedule(next.input, places, currency, next.order ?? undefined, mealChoices, mealSlots, realLegs)
    return trial.overMinutes === 0
  }

  // 30분 단위로 줄이기
  const cut = Math.ceil(schedule.overMinutes / 30) * 30
  const reduce: Adjustment[] = input.selections
    .filter((s) => s.stayMinutes - cut >= 30)
    .sort((a, b) => b.stayMinutes - a.stayMinutes)
    .map((s) => ({ kind: 'reduceStay' as const, placeId: s.placeId, stayMinutes: s.stayMinutes - cut }))
    .filter(fits)
    .slice(0, 2)

  // 머무는 시간이 짧은 곳부터 빼 보기
  const remove: Adjustment[] = [...input.selections]
    .sort((a, b) => a.stayMinutes - b.stayMinutes)
    .map((s) => ({ kind: 'remove' as const, placeId: s.placeId }))
    .filter(fits)
    .slice(0, 2)

  // 10분 단위로 올림
  const extend: Adjustment = { kind: 'extendEnd', endTime: toHHMM(Math.ceil(schedule.endAt / 10) * 10) }

  return [...reduce, ...remove, extend]
}
