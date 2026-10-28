import { useState } from 'react'
import { loadTrips, saveTrips } from '../lib/storage'
import type { SavedTrip } from '../types'

/** 저장한 여행 목록 — 바꿀 때마다 브라우저에 저장 */
export function useTrips() {
  const [trips, setTripsState] = useState<SavedTrip[]>(loadTrips)
  const [saveFailed, setSaveFailed] = useState(false)

  function setTrips(next: SavedTrip[]) {
    setTripsState(next)
    setSaveFailed(!saveTrips(next))
  }

  return { trips, setTrips, saveFailed }
}
