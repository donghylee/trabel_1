import { useMemo, useRef, useState } from 'react'
import { categoryLabels, placesOf } from '../../data/catalog'
import { isSamePlace } from '../../lib/place'
import { STAY_OPTIONS, formatDuration } from '../../lib/time'
import { placeAt } from '../../services/geocode'
import type { Country, LatLng, Place, PlaceSelection } from '../../types'
import PlaceMapPanel, { type PinStatus } from '../PlaceMapPanel'
import PlaceSearch from '../PlaceSearch'

type Props = {
  country: Country
  customPlaces: Place[]
  selections: PlaceSelection[]
  onChange: (selections: PlaceSelection[], customPlaces: Place[]) => void
}

export default function PlaceStep({ country, customPlaces, selections, onChange }: Props) {
  const basePlaces = placesOf(country)
  const allPlaces = [...basePlaces, ...customPlaces]
  const selectedPlaces = selections.flatMap((s) => {
    const place = allPlaces.find((p) => p.id === s.placeId)
    return place ? [{ place, stayMinutes: s.stayMinutes }] : []
  })
  const totalStay = selections.reduce((sum, s) => sum + s.stayMinutes, 0)
  // 마지막으로 고른 장소 근처 결과를 우선 (아직 없으면 유명한 곳 순)
  const searchNear = selectedPlaces[selectedPlaces.length - 1]?.place.location ?? null
  const selectedKey = selections.map((s) => s.placeId).join(',')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedList = useMemo(() => selectedPlaces.map((s) => s.place), [selectedKey])

  // 지도에서 보고 있는 장소, 그리고 "주변 유명한 곳"의 기준 위치
  const [candidate, setCandidate] = useState<Place | null>(null)
  const [anchor, setAnchor] = useState<Place | null>(null)
  const [focusSeq, setFocusSeq] = useState(0)
  const [pinStatus, setPinStatus] = useState<PinStatus>({ kind: 'idle' })
  const pinRequest = useRef<AbortController | null>(null)

  /** 지도에 띄워 보기. asAnchor면 그 주변 유명한 곳도 새로 찾음 */
  function preview(place: Place, asAnchor: boolean) {
    setCandidate(place)
    if (asAnchor) setAnchor(place)
    setFocusSeq((n) => n + 1)
  }

  function pickOnMap(point: LatLng) {
    pinRequest.current?.abort()
    const controller = new AbortController()
    pinRequest.current = controller
    setPinStatus({ kind: 'loading' })
    placeAt(point, country, controller.signal)
      .then((place) => {
        if (place) {
          preview(place, true)
          setPinStatus({ kind: 'idle' })
        } else {
          setPinStatus({ kind: 'error', message: `${country.name} 밖의 위치입니다. ${country.name} 안을 눌러 주세요.` })
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setPinStatus({ kind: 'error', message: err instanceof Error ? err.message : '위치를 확인하지 못했습니다.' })
      })
  }

  /** 이미 고른 장소인지 (기본 목록의 경복궁과 검색 결과의 경복궁처럼 id가 달라도 같은 곳이면 true) */
  function isSelected(place: Place): boolean {
    return selectedPlaces.some((s) => isSamePlace(s.place, place))
  }

  function add(place: Place) {
    if (isSelected(place)) return
    const isCustom = !basePlaces.some((p) => p.id === place.id)
    onChange(
      [...selections, { placeId: place.id, stayMinutes: place.defaultStayMinutes }],
      isCustom && !customPlaces.some((p) => p.id === place.id) ? [...customPlaces, place] : customPlaces,
    )
  }

  function remove(placeId: string) {
    onChange(
      selections.filter((s) => s.placeId !== placeId),
      customPlaces.filter((p) => p.id !== placeId),
    )
  }

  function setStay(placeId: string, stayMinutes: number) {
    onChange(
      selections.map((s) => (s.placeId === placeId ? { ...s, stayMinutes } : s)),
      customPlaces,
    )
  }

  const quickPickGroups = country.regions
    .map((r) => ({ name: r.name, places: r.places.filter((p) => !isSelected(p)) }))
    .filter((g) => g.places.length > 0)

  return (
    <div className="place-step">
      <PlaceSearch
        country={country}
        near={searchNear}
        placeholder={`${country.name}에서 장소 이름을 검색하세요 (예: ${basePlaces[0]?.name ?? '박물관'})`}
        isPicked={isSelected}
        onPick={add}
        autoFocus
        onPreview={(place) => preview(place, true)}
        previewId={candidate?.id ?? null}
        onResults={(results) => {
          // 첫 번째 결과를 바로 지도에 보여줌
          if (results[0]) preview(results[0], true)
        }}
      />

      <PlaceMapPanel
        country={country}
        selected={selectedList}
        candidate={candidate}
        anchor={anchor}
        focusSeq={focusSeq}
        pinStatus={pinStatus}
        isSelected={isSelected}
        onMapClick={pickOnMap}
        onPreview={(place) => preview(place, false)}
        onAdd={add}
      />

      <div className="selected-places">
        <h3 className="section-label">선택한 장소 {selections.length > 0 && `${selections.length}곳`}</h3>
        {selectedPlaces.length === 0 ? (
          <p className="hint">위에서 검색하거나 아래 추천 장소를 눌러 추가해 주세요. 방문 순서는 앱이 자동으로 정합니다.</p>
        ) : (
          <ul className="place-options">
            {selectedPlaces.map(({ place, stayMinutes }) => (
              <li key={place.id} className="place-option selected">
                <div className="place-option-main">
                  <span className="place-option-name">{place.name}</span>
                  <span className="tag">{categoryLabels[place.category]}</span>
                </div>
                <label className="stay-select">
                  머무를 시간
                  <select value={stayMinutes} onChange={(e) => setStay(place.id, Number(e.target.value))}>
                    {STAY_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {formatDuration(m)}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" className="remove-btn" aria-label={`${place.name} 빼기`} onClick={() => remove(place.id)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {selections.length > 0 && <p className="hint">머무를 시간 합계 {formatDuration(totalStay)}</p>}
      </div>

      {quickPickGroups.length > 0 && (
        <div className="quick-picks">
          <h3 className="section-label">추천 장소</h3>
          {quickPickGroups.map((group) => (
            <div key={group.name} className="quick-pick-group">
              <span className="quick-pick-region">{group.name}</span>
              <div className="chips">
                {group.places.map((place) => (
                  <button key={place.id} type="button" className="chip" onClick={() => add(place)}>
                    + {place.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
