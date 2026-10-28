import { useCallback, useEffect, useRef, useState } from 'react'
import { legKey, type RealLegs } from '../lib/schedule'
import { fetchLeg, hasRealRouting } from '../services/routes'
import type { Country, Leg, Schedule } from '../types'

// 일정의 이동 구간을 실제 길찾기로 채운다.
// 방문 순서는 거리 추정으로 먼저 정하고(모든 쌍을 API로 부르면 너무 많음),
// 정해진 순서의 구간만 실제로 불러서 시간표를 다시 계산한다.

/** 받아 둔 실제 구간 — 화면에서 일정을 계산할 때 넘김 */
export function useRealLegStore() {
  const [legs, setLegs] = useState<Map<string, Leg>>(() => new Map())
  const add = useCallback((key: string, leg: Leg) => {
    setLegs((prev) => new Map(prev).set(key, leg))
  }, [])
  return { legs: legs as RealLegs, add }
}

/** 일정에 아직 실제 값이 없는 구간이 있으면 불러옴. 불러오는 중이면 loading=true */
export function useFetchRealLegs(
  country: Country | undefined,
  schedule: Schedule | null | undefined,
  legs: RealLegs,
  add: (key: string, leg: Leg) => void,
): { loading: boolean; enabled: boolean } {
  const enabled = !!country && hasRealRouting(country)
  const inflight = useRef(new Set<string>())

  const missing = enabled && schedule
    ? schedule.items.flatMap((item) => {
        if (item.kind !== 'move') return []
        const key = legKey(item.leg.from.id, item.leg.to.id)
        return legs.has(key) ? [] : [{ key, item }]
      })
    : []
  const missingKey = missing.map((m) => m.key).join('|')

  useEffect(() => {
    if (!country) return
    for (const { key, item } of missing) {
      if (inflight.current.has(key)) continue
      inflight.current.add(key)
      fetchLeg(item.leg.from, item.leg.to, country, item.start)
        .then((leg) => add(key, leg))
        // 실패하면 추정 구간을 그대로 기록해서 다시 부르지 않음
        .catch(() => add(key, item.leg))
        .finally(() => inflight.current.delete(key))
    }
    // missing은 missingKey로 대표됨
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey, country, add])

  return { loading: missing.length > 0, enabled }
}
