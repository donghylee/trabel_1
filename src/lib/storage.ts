import type { SavedDay, SavedTrip } from '../types'

// 저장한 여행은 지금은 이 브라우저(localStorage)에만 보관한다.
// 로그인·서버 저장을 붙이면 loadTrips/saveTrips 안쪽만 바꾸면 된다.

const STORAGE_KEY = 'trip-route-planner:trips:v1'

export function loadTrips(): SavedTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as SavedTrip[]) : []
  } catch {
    // 사생활 보호 모드 등으로 저장소를 못 쓰면 빈 목록
    return []
  }
}

/** 저장에 성공하면 true */
export function saveTrips(trips: SavedTrip[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trips))
    return true
  } catch {
    return false
  }
}

function newId(): string {
  return `trip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export type SaveTarget =
  | { kind: 'new'; name: string; countryCode: string }
  | { kind: 'existing'; tripId: string }

/** 하루 일정을 여행에 넣는다. 같은 일차가 있으면 덮어쓴다. 바뀐 목록과 저장된 여행 id를 돌려줌 */
export function upsertDay(
  trips: SavedTrip[],
  target: SaveTarget,
  day: SavedDay,
): { trips: SavedTrip[]; tripId: string } {
  const now = new Date().toISOString()
  if (target.kind === 'new') {
    const trip: SavedTrip = {
      id: newId(),
      name: target.name,
      countryCode: target.countryCode,
      createdAt: now,
      updatedAt: now,
      days: [day],
    }
    return { trips: [trip, ...trips], tripId: trip.id }
  }
  return {
    trips: trips.map((trip) =>
      trip.id !== target.tripId
        ? trip
        : {
            ...trip,
            updatedAt: now,
            days: [...trip.days.filter((d) => d.dayNumber !== day.dayNumber), day].sort(
              (a, b) => a.dayNumber - b.dayNumber,
            ),
          },
    ),
    tripId: target.tripId,
  }
}

export function deleteDay(trips: SavedTrip[], tripId: string, dayNumber: number): SavedTrip[] {
  return trips.map((trip) =>
    trip.id !== tripId
      ? trip
      : { ...trip, updatedAt: new Date().toISOString(), days: trip.days.filter((d) => d.dayNumber !== dayNumber) },
  )
}

export function deleteTrip(trips: SavedTrip[], tripId: string): SavedTrip[] {
  return trips.filter((trip) => trip.id !== tripId)
}

export function renameTrip(trips: SavedTrip[], tripId: string, name: string): SavedTrip[] {
  return trips.map((trip) => (trip.id !== tripId ? trip : { ...trip, name, updatedAt: new Date().toISOString() }))
}

/** 다음에 저장할 일차 — 비어 있는 가장 작은 번호 */
export function nextDayNumber(trip: SavedTrip | undefined): number {
  if (!trip) return 1
  let n = 1
  while (trip.days.some((d) => d.dayNumber === n)) n++
  return n
}
