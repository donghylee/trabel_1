import { useEffect, useMemo, useState } from 'react'
import { googleEnabled } from '../services/google'
import { categoryLabels } from '../data/catalog'
import { distanceMeters, formatDistance } from '../lib/travel'
import { famousNearby } from '../services/landmarks'
import type { Country, LatLng, Place } from '../types'
import MapView, { type MapMarker } from './MapView'

/** 지금 지도에서 보고 있는 위치를 가리키는 마커 id */
const CANDIDATE_MARKER_ID = 'candidate'

export type PinStatus = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string }

type NearbyState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; places: Place[] }
  | { status: 'error'; message: string }

type Props = {
  country: Country
  selected: Place[]
  /** 지금 보고 있는 장소 (검색 결과·지도에서 누른 곳·주변 장소) */
  candidate: Place | null
  /** 주변 유명한 곳을 찾는 기준 위치 (검색 결과·지도에서 누른 곳) */
  anchor: Place | null
  /** 올라갈 때마다 지도가 candidate로 이동 */
  focusSeq: number
  pinStatus: PinStatus
  isSelected: (place: Place) => boolean
  onMapClick: (point: LatLng) => void
  onPreview: (place: Place) => void
  onAdd: (place: Place) => void
}

export default function PlaceMapPanel({
  country,
  selected,
  candidate,
  anchor,
  focusSeq,
  pinStatus,
  isSelected,
  onMapClick,
  onPreview,
  onAdd,
}: Props) {
  const [nearby, setNearby] = useState<NearbyState>({ status: 'idle' })

  useEffect(() => {
    if (!anchor) return
    let cancelled = false
    setNearby({ status: 'loading' })
    famousNearby(anchor.location)
      .then((places) => {
        if (cancelled) return
        // 기준 위치 자신은 빼고 보여줌
        setNearby({ status: 'done', places: places.filter((p) => p.name !== anchor.name) })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setNearby({ status: 'error', message: err instanceof Error ? err.message : '주변 장소를 불러오지 못했습니다.' })
      })
    return () => {
      cancelled = true
    }
  }, [anchor])

  const nearbyPlaces = useMemo(() => (nearby.status === 'done' ? nearby.places : []), [nearby])
  const focus = useMemo(() => (focusSeq > 0 ? { id: CANDIDATE_MARKER_ID, seq: focusSeq } : null), [focusSeq])

  const markers = useMemo(() => {
    const list: MapMarker[] = selected.map((place, i) => ({
      id: place.id,
      label: String(i + 1),
      title: place.name,
      subtitle: '선택한 장소',
      position: place.location,
    }))
    for (const place of nearbyPlaces) {
      if (place.id === candidate?.id || isSelected(place)) continue
      list.push({
        id: place.id,
        label: '📸',
        title: place.name,
        subtitle: `${categoryLabels[place.category]} · 눌러서 보기`,
        position: place.location,
        variant: 'poi',
      })
    }
    if (candidate) {
      list.push({
        id: CANDIDATE_MARKER_ID,
        label: '📍',
        title: candidate.name,
        subtitle: candidate.address || categoryLabels[candidate.category],
        position: candidate.location,
        variant: 'candidate',
      })
    }
    return list
    // isSelected는 selected에서 나오므로 selected만 의존성으로 둠
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, nearbyPlaces, candidate])

  const lastSelected = selected[selected.length - 1]
  const candidatePicked = candidate ? isSelected(candidate) : false

  return (
    <div className="map-panel">
      <div className="picker-map">
        <MapView
          center={lastSelected?.location ?? country.center}
          initialZoom={lastSelected ? 13 : 7}
          markers={markers}
          paths={[]}
          focus={focus}
          onMarkerClick={(id) => {
            const place = nearbyPlaces.find((p) => p.id === id)
            if (place) onPreview(place)
          }}
          onMapClick={onMapClick}
        />
        <p className="map-tip">
          {pinStatus.kind === 'loading' ? '위치를 확인하는 중…' : '지도를 누르면 그 위치를 고를 수 있어요'}
        </p>
      </div>
      {pinStatus.kind === 'error' && <p className="hint error">{pinStatus.message}</p>}

      {candidate && (
        <div className="candidate-card">
          <span className="candidate-icon">📍</span>
          <div className="candidate-body">
            <div>
              <span className="place-option-name">{candidate.name}</span>{' '}
              <span className="tag">{categoryLabels[candidate.category]}</span>
            </div>
            {candidate.address && <div className="hint">{candidate.address}</div>}
          </div>
          <button type="button" className="btn small primary" disabled={candidatePicked} onClick={() => onAdd(candidate)}>
            {candidatePicked ? '추가됨' : '+ 추가'}
          </button>
        </div>
      )}

      {anchor && (
        <div className="famous-nearby">
          <h3 className="section-label">
            {anchor.name} 주변 유명한 곳{' '}
            <span className="muted">· {googleEnabled ? 'Google 인기순' : '위키백과에 소개된 곳'}</span>
          </h3>
          {nearby.status === 'loading' && <p className="hint">주변 장소를 찾는 중…</p>}
          {nearby.status === 'error' && <p className="hint error">{nearby.message}</p>}
          {nearby.status === 'done' && nearbyPlaces.length === 0 && (
            <p className="hint">반경 1.5km 안에서 알려진 관광지를 찾지 못했습니다.</p>
          )}
          {nearbyPlaces.length > 0 && (
            <ul className="famous-list">
              {nearbyPlaces.map((place) => {
                const picked = isSelected(place)
                return (
                  <li key={place.id} className={candidate?.id === place.id ? 'previewing' : ''}>
                    <button type="button" className="famous-name as-link" onClick={() => onPreview(place)}>
                      📸 <span className="place-option-name">{place.name}</span>
                      <span className="hint">
                        {categoryLabels[place.category]} · {formatDistance(Math.round(distanceMeters(anchor.location, place.location)))}
                      </span>
                    </button>
                    <button type="button" className="btn small" disabled={picked} onClick={() => onAdd(place)}>
                      {picked ? '추가됨' : '+ 추가'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
