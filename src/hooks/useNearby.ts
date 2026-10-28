import { useEffect, useState } from 'react'
import { searchNearby } from '../services/places'
import type { Currency, NearbyKind, NearbyPlace, Place } from '../types'

const kinds: NearbyKind[] = ['restaurant', 'cafe', 'attraction']

/** 방문지마다 주변 장소를 검색해 { placeId: 결과 } 형태로 돌려준다 */
export function useNearby(places: Place[], currency: Currency) {
  const [results, setResults] = useState<Record<string, NearbyPlace[]>>({})
  const [loading, setLoading] = useState(false)
  const key = places.map((p) => p.id).join(',')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all(
      places.map(async (place) => {
        // 한 종류가 실패해도(요금 한도, 네트워크 등) 나머지는 보여줌
        const lists = await Promise.all(
          kinds.map((kind) => searchNearby(place, kind, currency).catch(() => [] as NearbyPlace[])),
        )
        return [place.id, lists.flat()] as const
      }),
    ).then((entries) => {
      if (cancelled) return
      setResults(Object.fromEntries(entries))
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // 장소 목록이 실제로 바뀔 때만 다시 검색
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, currency])

  return { results, loading }
}
