import { useMemo, useRef, useState } from 'react'
import { categoryLabel, placesOf } from '../../data/catalog'
import { useDragReorder } from '../../hooks/useDragReorder'
import { t } from '../../i18n'
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
  /** 순서를 직접 정했는지 */
  orderFixed: boolean
  onChange: (selections: PlaceSelection[], customPlaces: Place[]) => void
  onOrderChange: (selections: PlaceSelection[], orderFixed: boolean) => void
}

export default function PlaceStep({ country, customPlaces, selections, orderFixed, onChange, onOrderChange }: Props) {
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
  // 언어를 바꾸면 country(이름이 바뀐 목록)도 바뀌므로 함께 다시 계산
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const selectedList = useMemo(() => selectedPlaces.map((s) => s.place), [selectedKey, country])

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
          setPinStatus({ kind: 'error', message: t('{country} 밖의 위치입니다. {country} 안을 눌러 주세요.', { country: country.name }) })
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setPinStatus({ kind: 'error', message: err instanceof Error ? err.message : t('위치를 확인하지 못했습니다.') })
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

  /** 선택한 장소 순서 바꾸기 (끌기 또는 ▲▼) — 바꾸면 이 순서대로 일정을 만듦 */
  function reorder(order: string[]) {
    const byId = new Map(selections.map((s) => [s.placeId, s]))
    onOrderChange(order.flatMap((id) => byId.get(id) ?? []), true)
  }

  function move(placeId: string, direction: -1 | 1) {
    const order = selections.map((s) => s.placeId)
    const i = order.indexOf(placeId)
    const j = i + direction
    if (j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    reorder(order)
  }

  const selectedIds = selectedPlaces.map((s) => s.place.id)
  const { drag, rowProps } = useDragReorder(selectedIds, reorder)
  // 끄는 중: 놓일 자리에 파란 선
  const dragOthers = drag ? selectedIds.filter((id) => id !== drag.id) : []
  const dropChanges = drag ? selectedIds.indexOf(drag.id) !== drag.overIndex : false
  const dropBeforeId = drag && dropChanges ? dragOthers[drag.overIndex] : undefined
  const dropAfterId =
    drag && dropChanges && drag.overIndex === dragOthers.length ? dragOthers[dragOthers.length - 1] : undefined

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
        placeholder={t('{country}에서 장소 이름을 검색하세요 (예: {example})', {
          country: country.name,
          example: basePlaces[0]?.name ?? t('박물관'),
        })}
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
        <h3 className="section-label">
          {t('선택한 장소')} {selections.length > 0 && t('{n}곳', { n: selections.length })}
        </h3>
        {selectedPlaces.length === 0 ? (
          <p className="hint">
            {t('위에서 검색하거나 아래 추천 장소를 눌러 추가해 주세요. 방문 순서는 앱이 자동으로 정합니다.')}
          </p>
        ) : (
          <>
            <p className="hint order-hint">
              {orderFixed ? (
                <>
                  {t('직접 정한 순서대로 일정을 만듭니다.')}{' '}
                  <button type="button" className="link-btn" onClick={() => onOrderChange(selections, false)}>
                    {t('자동 순서로 되돌리기')}
                  </button>
                </>
              ) : (
                t('끌어서 옮기거나 ▲▼로 순서를 바꿀 수 있습니다. 바꾸지 않으면 앱이 가장 효율적인 순서로 정합니다.')
              )}
            </p>
            <ul className="place-options">
              {selectedPlaces.map(({ place, stayMinutes }, index) => (
                <li
                  key={place.id}
                  className={[
                    'place-option selected draggable',
                    drag?.id === place.id && 'dragging',
                    dropBeforeId === place.id && 'drop-before',
                    dropAfterId === place.id && 'drop-after',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  {...rowProps(place.id)}
                >
                  <div className="reorder">
                    <button
                      type="button"
                      aria-label={t('{name} 위로', { name: place.name })}
                      disabled={index === 0}
                      onClick={() => move(place.id, -1)}
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      aria-label={t('{name} 아래로', { name: place.name })}
                      disabled={index === selectedPlaces.length - 1}
                      onClick={() => move(place.id, 1)}
                    >
                      ▼
                    </button>
                  </div>
                  <span className={`order-badge ${orderFixed ? '' : 'auto'}`}>{orderFixed ? index + 1 : '·'}</span>
                  <div className="place-option-main">
                    <span className="place-option-name">{place.name}</span>
                    <span className="tag">{categoryLabel(place.category)}</span>
                  </div>
                  <label className="stay-select">
                    {t('머무를 시간')}
                    <select value={stayMinutes} onChange={(e) => setStay(place.id, Number(e.target.value))}>
                      {STAY_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {formatDuration(m)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="remove-btn" aria-label={t('{name} 빼기', { name: place.name })} onClick={() => remove(place.id)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            {drag && (
              <div className="drag-ghost" style={{ left: drag.x + 14, top: drag.y - 22 }} aria-hidden="true">
                ⠿ {selectedPlaces.find((s) => s.place.id === drag.id)?.place.name ?? ''}
              </div>
            )}
          </>
        )}
        {selections.length > 0 && <p className="hint">{t('머무를 시간 합계 {d}', { d: formatDuration(totalStay) })}</p>}
      </div>

      {quickPickGroups.length > 0 && (
        <div className="quick-picks">
          <h3 className="section-label">{t('추천 장소')}</h3>
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
