import type { SupabaseClient } from '@supabase/supabase-js'
import { findCountry, placesOf } from '../data/catalog'
import { t } from '../i18n'
import type { SavedTrip } from '../types'
import { buildSchedule, mealLabels } from './schedule'
import { toHHMM } from './time'

// 여행 일정 10분 전 알림.
// 여행을 서버에 저장할 때 시작일이 있으면, 방문·식사마다 "10분 뒤" 알림을 trip_reminders 테이블에 넣어 둔다.
// 보낼 때가 되면 서버 함수(supabase/functions/notify-push)가 1분마다 찾아서 보냄 — 설정: docs/PUSH_SETUP.md

const BEFORE_MIN = 10
/** 한 여행에 넣어 둘 알림 수 상한 */
const MAX_REMINDERS = 300

export type Reminder = { trip_id: string; fire_at: string; title: string; body: string; url: string }

/** 앞으로 보낼 알림들. 시간표의 시각은 여행지 시간 → 나라의 시차(utcOffsetHours)로 실제 순간을 계산 */
export function buildReminders(trip: SavedTrip, now = Date.now()): Reminder[] {
  const country = findCountry(trip.countryCode)
  const date = trip.startDate?.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!country || !date) return []
  const [year, month, dayOfMonth] = date.slice(1).map(Number)
  return trip.days
    .flatMap((day) => {
      const schedule = buildSchedule(
        day.input,
        [...placesOf(country), ...day.input.customPlaces],
        country.currency,
        day.customOrder ?? undefined,
        day.mealChoices,
        day.mealSlots ?? {},
      )
      return schedule.items.flatMap((item): Reminder[] => {
        let what: string
        if (item.kind === 'visit') what = item.place.name
        else if (item.kind === 'meal') {
          const meal = t(mealLabels[item.meal])
          const name = item.restaurant?.name ?? day.mealChoices[item.meal]?.name
          what = name ? `${meal} · ${name}` : t('{meal} 식사', { meal })
        } else return []
        const fireAt =
          Date.UTC(year, month - 1, dayOfMonth + day.dayNumber - 1, 0, item.start - BEFORE_MIN) -
          country.utcOffsetHours * 60 * 60 * 1000
        if (fireAt <= now) return []
        return [
          {
            trip_id: trip.id,
            fire_at: new Date(fireAt).toISOString(),
            title: t('{n}분 뒤 일정', { n: BEFORE_MIN }),
            body: `${toHHMM(item.start)} ${what} · ${t('{n}일차', { n: day.dayNumber })}`,
            url: `/?trip=${trip.id}&day=${day.dayNumber}`,
          },
        ]
      })
    })
    .slice(0, MAX_REMINDERS)
}

/** 이 여행의 알림을 지금 일정으로 통째로 새로 씀. 실패해도 조용히 (여행 저장과는 따로) */
export async function syncReminders(client: SupabaseClient, trip: SavedTrip): Promise<void> {
  try {
    const { error } = await client.from('trip_reminders').delete().eq('trip_id', trip.id)
    const rows = buildReminders(trip)
    if (!error && rows.length) await client.from('trip_reminders').insert(rows)
  } catch {
    // 알림 테이블이 아직 없는 DB 등
  }
}
