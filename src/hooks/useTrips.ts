import { useEffect, useRef, useState } from 'react'
import type { SessionUser } from '../lib/auth'
import { fetchServerTrips, loadTrips, pushServerTrips, saveTrips } from '../lib/storage'
import { serverEnabled } from '../services/supabase'
import type { SavedTrip } from '../types'

/**
 * 로그인한 사람의 저장한 여행 — 바꿀 때마다 저장 (서버가 있으면 서버, 없으면 이 브라우저).
 * 서버: 로그인하면 내 여행을 받아 오고, 바꾸면 화면부터 바꾼 뒤 서버에 반영한다.
 * 브라우저: 한 브라우저를 여러 계정이 쓰면 각자 자기 여행만 보인다.
 *   주인이 없는 예전 여행은 로그인한 사람에게 보이고, 처음 바꿀 때 그 사람 것으로 정해진다.
 */
export function useTrips(user: SessionUser | null) {
  const server = useServerTrips(user)
  const local = useLocalTrips(user)
  return serverEnabled ? server : local
}

function useServerTrips(user: SessionUser | null) {
  const userId = serverEnabled ? user?.id : undefined
  const [state, setState] = useState<{ userId?: string; trips: SavedTrip[] }>({ trips: [] })
  const [saveFailed, setSaveFailed] = useState(false)
  // 저장 요청이 겹쳐도 마지막으로 서버에 보낸 목록을 기준으로 비교
  const lastPushed = useRef<SavedTrip[]>([])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchServerTrips(userId).then((trips) => {
      if (cancelled) return
      lastPushed.current = trips ?? []
      setState({ userId, trips: trips ?? [] })
      setSaveFailed(trips === null)
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  // 다른 계정으로 바뀌었는데 아직 받아 오는 중이면 빈 목록
  const trips = userId && state.userId === userId ? state.trips : []

  function setTrips(next: SavedTrip[]) {
    if (!userId) return
    const withOwner = next.map((trip) => (trip.ownerId ? trip : { ...trip, ownerId: userId }))
    const prev = lastPushed.current
    lastPushed.current = withOwner
    setState({ userId, trips: withOwner })
    pushServerTrips(prev, withOwner, userId).then((ok) => setSaveFailed(!ok))
  }

  return { trips, setTrips, saveFailed }
}

function useLocalTrips(user: SessionUser | null) {
  const [allTrips, setAllTrips] = useState<SavedTrip[]>(() => (serverEnabled ? [] : loadTrips()))
  const [saveFailed, setSaveFailed] = useState(false)
  const userId = user?.id
  const isMine = (trip: SavedTrip) => !!userId && (!trip.ownerId || trip.ownerId === userId)
  const trips = allTrips.filter(isMine)

  function setTrips(next: SavedTrip[]) {
    if (!userId) return
    const others = allTrips.filter((trip) => !isMine(trip))
    const all = [...next.map((trip) => (trip.ownerId ? trip : { ...trip, ownerId: userId })), ...others]
    setAllTrips(all)
    setSaveFailed(!saveTrips(all))
  }

  return { trips, setTrips, saveFailed }
}
