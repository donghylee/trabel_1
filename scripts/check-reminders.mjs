// 일정 10분 전 알림 시각이 여행지 시차대로 맞게 계산되는지 확인한다. (npm run reminders:check)
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// i18n이 불러올 때 문서 제목·언어를 적으므로 빈 문서를 둠
globalThis.document = { documentElement: {} }

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { buildReminders } = await vite.ssrLoadModule('/src/lib/reminders.ts')
  const place = (id, lat) => ({ id, name: id, category: 'sight', location: { lat, lng: 127 }, defaultStayMinutes: 60 })
  const input = {
    skippedMeals: ['lunch', 'dinner'],
    countryCode: 'KR',
    customPlaces: [place('a', 37.5), place('b', 37.505)],
    lodging: null,
    startFromLodging: false,
    returnToLodging: false,
    startTime: '09:00',
    endTime: '12:00',
    selections: [
      { placeId: 'a', stayMinutes: 60 },
      { placeId: 'b', stayMinutes: 60 },
    ],
  }
  const day = { dayNumber: 2, savedAt: '', input, customOrder: ['a', 'b'], mealChoices: {}, mealSlots: {}, summary: {} }
  const trip = { id: 't1', name: 'x', countryCode: 'KR', createdAt: '', updatedAt: '', startDate: '2030-01-01', days: [day] }

  const reminders = buildReminders(trip, Date.UTC(2029, 0, 1))
  assert.equal(reminders.length, 2, '방문 두 곳 → 알림 두 개')
  // 2일차 = 1월 2일, 첫 방문 09:00(한국, UTC+9)의 10분 전 = 1월 1일 23:50 UTC
  assert.equal(reminders[0].fire_at, '2030-01-01T23:50:00.000Z')
  assert.equal(reminders[0].url, '/?trip=t1&day=2')
  assert.ok(reminders[0].body.startsWith('09:00 a'), reminders[0].body)
  // 이미 지난 일정은 넣지 않음, 시작일이 없으면 없음
  assert.equal(buildReminders(trip, Date.UTC(2031, 0, 1)).length, 0)
  assert.equal(buildReminders({ ...trip, startDate: undefined }).length, 0)
  console.log('reminders: OK', reminders.map((r) => `${r.fire_at} ${r.body}`))
} finally {
  await vite.close()
}
