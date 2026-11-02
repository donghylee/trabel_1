import { supabase } from '../services/supabase'
import type { SavedDay, SavedTrip } from '../types'

// 저장한 여행.
// - 서버(Supabase)를 쓰면 trips·trip_days 테이블 (fetchServerTrips / pushServerTrips)
// - 아니면 이 브라우저(localStorage)에만 (loadTrips / saveTrips)
// 아래 upsertDay 같은 함수는 목록을 바꾼 새 목록만 만들고, 저장은 useTrips가 위 둘 중 하나로 한다.

const STORAGE_KEY = 'trip-route-planner:trips:v1'

type DayRow = {
  trip_id: string
  day_number: number
  saved_at: string
  input: SavedDay['input']
  custom_order: SavedDay['customOrder']
  meal_choices: SavedDay['mealChoices']
  meal_slots: NonNullable<SavedDay['mealSlots']>
  summary: SavedDay['summary']
}
type TripRow = { id: string; owner_id: string; name: string; country_code: string; created_at: string; updated_at: string }

const toDay = (r: DayRow): SavedDay => ({
  dayNumber: r.day_number,
  savedAt: r.saved_at,
  input: r.input,
  customOrder: r.custom_order,
  mealChoices: r.meal_choices,
  mealSlots: r.meal_slots,
  summary: r.summary,
})

const toDayRow = (tripId: string, d: SavedDay): DayRow => ({
  trip_id: tripId,
  day_number: d.dayNumber,
  saved_at: d.savedAt,
  input: d.input,
  custom_order: d.customOrder,
  meal_choices: d.mealChoices,
  meal_slots: d.mealSlots ?? {},
  summary: d.summary,
})

/** 내 여행 전체 (최근에 고친 것이 앞). 실패하면 null */
export async function fetchServerTrips(userId: string): Promise<SavedTrip[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('trips')
    .select('*, trip_days(*)')
    .eq('owner_id', userId)
    .order('updated_at', { ascending: false })
  if (error || !data) return null
  return (data as (TripRow & { trip_days: DayRow[] })[]).map((r) => ({
    id: r.id,
    ownerId: r.owner_id,
    name: r.name,
    countryCode: r.country_code,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    days: r.trip_days.map(toDay).sort((a, b) => a.dayNumber - b.dayNumber),
  }))
}

/**
 * 바뀌기 전 목록(prev)과 후 목록(next)을 비교해 달라진 여행만 서버에 반영. 성공하면 true.
 * upsertDay 등은 바뀐 여행만 새 객체로 만들므로, 같은 객체면 그대로라고 본다.
 */
export async function pushServerTrips(prev: SavedTrip[], next: SavedTrip[], userId: string): Promise<boolean> {
  if (!supabase) return false
  const client = supabase
  const nextIds = new Set(next.map((trip) => trip.id))
  const removed = prev.filter((trip) => !nextIds.has(trip.id)).map((trip) => trip.id)
  const changed = next.filter((trip) => !prev.includes(trip))
  const results = await Promise.all([
    removed.length ? client.from('trips').delete().in('id', removed) : null,
    ...changed.map(async (trip) => {
      const row: TripRow = {
        id: trip.id,
        owner_id: userId,
        name: trip.name,
        country_code: trip.countryCode,
        created_at: trip.createdAt,
        updated_at: trip.updatedAt,
      }
      const saved = await client.from('trips').upsert(row)
      if (saved.error) return saved
      // 하루 일정: 지운 일차는 지우고, 남은 일차는 통째로 다시 씀
      const dayNumbers = trip.days.map((d) => d.dayNumber)
      const cleared = await client
        .from('trip_days')
        .delete()
        .eq('trip_id', trip.id)
        .not('day_number', 'in', `(${dayNumbers.join(',') || 0})`)
      if (cleared.error || trip.days.length === 0) return cleared
      return client.from('trip_days').upsert(trip.days.map((d) => toDayRow(trip.id, d)))
    }),
  ])
  return results.every((r) => !r?.error)
}

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

/** 서버 테이블의 id 형식(uuid)과 같게 — 브라우저에만 저장할 때도 같은 형식 */
function newId(): string {
  return crypto.randomUUID()
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
