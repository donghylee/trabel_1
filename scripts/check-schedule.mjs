// 고른 음식점이 ✕로 지우기 전까지 일정에 남는지, 어느 자리에 들어가는지 확인한다.
import assert from 'node:assert/strict'
import { createServer } from 'vite'

// i18n이 불러올 때 문서 제목·언어를 적으므로 빈 문서를 둠
globalThis.document = { documentElement: {} }

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
try {
  const { buildSchedule } = await vite.ssrLoadModule('/src/lib/schedule.ts')
  const place = (id, lat) => ({ id, name: id, category: 'sight', location: { lat, lng: 127 }, defaultStayMinutes: 60 })
  const places = [place('a', 37.5), place('b', 37.505)]
  const poi = { id: 'r', name: 'r', kind: 'restaurant', location: { lat: 37.502, lng: 127 }, rating: 0, reviewCount: 0 }
  let lastEnd
  const mealAt = (meal, startTime, endTime, stays, choices, slots = {}, skippedMeals = []) => {
    const input = {
      skippedMeals,
      countryCode: 'KR',
      customPlaces: [],
      lodging: null,
      startFromLodging: false,
      returnToLodging: false,
      startTime,
      endTime,
      selections: places.map((p, i) => ({ placeId: p.id, stayMinutes: stays[i] })),
    }
    const { items, endAt } = buildSchedule(input, places, 'KRW', ['a', 'b'], choices, slots)
    const found = items.filter((it) => it.kind === 'meal' && it.meal === meal)
    assert.ok(found.length <= 1, '같은 식사가 두 번 들어감')
    lastEnd = endAt
    return found[0]
  }

  // 점심시간에 걸치면 자동 식사 자리, 고르면 그 자리에 음식점
  assert.equal(mealAt('lunch', '10:00', '18:00', [120, 60], {}).restaurant, undefined)
  assert.equal(mealAt('lunch', '10:00', '18:00', [120, 60], { lunch: poi }).slot, 1)
  // 자동 식사 자리가 없어도(오래 머묾·이른 종료) 고른 음식점은 가장 가까운 자리에 남음
  assert.equal(mealAt('lunch', '10:00', '20:00', [300, 60], {}), undefined)
  assert.equal(mealAt('lunch', '10:00', '20:00', [300, 60], { lunch: poi }).slot, 0)
  assert.equal(mealAt('dinner', '09:00', '15:00', [60, 60], { dinner: poi }).slot, 2)
  // 지운 자리(음식점 없이 자리만)에는 다시 고르는 칸, 자리도 지우면 없어짐
  assert.equal(mealAt('dinner', '09:00', '15:00', [60, 60], {}, { dinner: 2 }).restaurant, undefined)
  assert.equal(mealAt('dinner', '09:00', '15:00', [60, 60], {}), undefined)
  // ✕로 뺀 식사는 자동으로 들어가지 않고 그만큼 일찍 끝남, 음식점을 고르면 다시 들어감
  mealAt('lunch', '10:00', '17:00', [120, 60], {})
  const withLunch = lastEnd
  assert.equal(mealAt('lunch', '10:00', '17:00', [120, 60], {}, {}, ['lunch']), undefined)
  assert.equal(withLunch - lastEnd, 60)
  assert.ok(mealAt('lunch', '10:00', '17:00', [120, 60], { lunch: poi }, {}, ['lunch']).restaurant)
  // 점심·저녁을 모두 골라도 둘 다 들어감
  const both = { lunch: poi, dinner: { ...poi, id: 'r2' } }
  assert.ok(mealAt('lunch', '10:00', '20:00', [60, 60], both).restaurant)
  assert.ok(mealAt('dinner', '10:00', '20:00', [60, 60], both).restaurant)
  console.log('식사 자리 계산이 맞습니다.')
} finally {
  await vite.close()
}
