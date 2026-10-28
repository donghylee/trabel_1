import { useMemo, useState, type ReactNode } from 'react'
import { useDragReorder } from '../hooks/useDragReorder'
import { useNearby } from '../hooks/useNearby'
import { nearbyKindIcons, rankNearby } from '../lib/recommend'
import { mealLabels } from '../lib/schedule'
import { STAY_OPTIONS, formatDuration, toHHMM, toMinutes } from '../lib/time'
import { formatDistance, formatFare, modeIcons, modeLabels, pathStyles, recommendedOption } from '../lib/travel'
import type {
  Adjustment,
  Country,
  Leg,
  MealChoices,
  MealKind,
  MealSlots,
  NearbyPlace,
  Place,
  Recommendation,
  Schedule,
  TravelMode,
  TravelOption,
} from '../types'
import MapView, { type MapMarker, type MapPath } from './MapView'
import NearbyPanel, { Stars, type KindFilter, type ScopeFilter } from './NearbyPanel'

type Props = {
  country: Country
  /** 선택한 장소 id를 이름으로 바꿀 때 쓰는 장소 목록 */
  places: Place[]
  schedule: Schedule
  adjustments: Adjustment[]
  isCustomOrder: boolean
  mealChoices: MealChoices
  title: string
  /** 제목 오른쪽 버튼들 */
  actions?: ReactNode
  /** 제목 아래 알림 (저장 완료 등) */
  banner?: ReactNode
  /** 없으면 읽기 전용 (마이페이지에서 저장한 일정 볼 때) */
  editor?: ScheduleEditor
  routeStatus?: RouteStatus
}

export type ScheduleEditor = {
  onMove: (placeId: string, direction: -1 | 1) => void
  /** 끌어서 놓았을 때 새 방문 순서와 음식점(주황색 원) 자리 */
  onReorder: (order: string[], mealSlots: MealSlots) => void
  onChangeStay: (placeId: string, minutes: number) => void
  onChangeTimes: (startTime: string, endTime: string) => void
  onResetOrder: () => void
  onApply: (adjustment: Adjustment) => void
  onAddPlace: (rec: Recommendation) => void
  onChooseMeal: (meal: MealKind, poi: NearbyPlace | null) => void
}

const RECOMMENDATION_COUNT = 6
const MEAL_OPTION_COUNT = 3

/** 이동 구간 길찾기 상태 — 실제 경로 API를 쓰는지, 불러오는 중인지 */
export type RouteStatus = { enabled: boolean; loading: boolean; note: string }

function optionText(option: TravelOption, country: Country, showSource: boolean): string {
  const parts = [`${modeLabels[option.mode]} ${formatDuration(option.minutes)}`]
  if (option.fare) parts.push(formatFare(option.fare, country.currency) + (option.fareEstimated ? '(추정)' : ''))
  if (option.transfers) parts.push(`환승 ${option.transfers}회`)
  // 실제 길찾기를 쓰는 중이면 거리로 계산한 값에만 "추정"을 붙여 구분
  if (showSource && option.estimated) parts.push('추정')
  return parts.join(' · ')
}

function MoveRow({ leg, country, showSource }: { leg: Leg; country: Country; showSource: boolean }) {
  const best = leg.options.find((o) => o.mode === leg.recommended)!
  const others = leg.options.filter((o) => o.mode !== leg.recommended)
  return (
    <div className="move-row">
      <div className="move-main">
        <span className="move-icon">{modeIcons[best.mode]}</span>
        <span>
          {optionText(best, country, showSource)} · {formatDistance(best.meters)}
        </span>
        <span className="badge">추천</span>
        {showSource && best.source && <span className="source-tag">{best.source}</span>}
      </div>
      {others.length > 0 && (
        <div className="move-alt">{others.map((o) => optionText(o, country, showSource)).join('  /  ')}</div>
      )}
    </div>
  )
}

/** 결과 화면에서 바로 바꾸는 활동 시간 — 종료가 출발보다 늦을 때만 반영 */
function TimeRangeEditor({
  startTime,
  endTime,
  onChange,
}: {
  startTime: string
  endTime: string
  onChange: (startTime: string, endTime: string) => void
}) {
  const [start, setStart] = useState(startTime)
  const [end, setEnd] = useState(endTime)
  // 조정안 버튼 등 다른 곳에서 시간이 바뀌면 입력칸도 맞춤 (입력 중인 칸은 다시 만들지 않아 포커스 유지)
  const [synced, setSynced] = useState({ startTime, endTime })
  if (synced.startTime !== startTime || synced.endTime !== endTime) {
    setSynced({ startTime, endTime })
    setStart(startTime)
    setEnd(endTime)
  }
  const valid = !!start && !!end && toMinutes(end) > toMinutes(start)

  function update(nextStart: string, nextEnd: string) {
    setStart(nextStart)
    setEnd(nextEnd)
    if (nextStart && nextEnd && toMinutes(nextEnd) > toMinutes(nextStart)) onChange(nextStart, nextEnd)
  }

  return (
    <div className="time-edit">
      <span className="time-edit-label">활동 시간</span>
      <input type="time" aria-label="출발 시각" value={start} onChange={(e) => update(e.target.value, end)} />
      <span className="muted">~</span>
      <input type="time" aria-label="종료 시각" value={end} onChange={(e) => update(start, e.target.value)} />
      {!valid && <span className="hint error">종료 시각은 출발 시각보다 늦어야 합니다.</span>}
    </div>
  )
}

export default function ScheduleView({
  country,
  places,
  schedule,
  adjustments,
  isCustomOrder,
  mealChoices,
  title,
  actions,
  banner,
  editor,
  routeStatus,
}: Props) {
  const [focus, setFocus] = useState<{ id: string; seq: number } | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  // 끌어서 옮길 수 있는 줄: 방문 장소(id)와 경로에 넣은 음식점("meal:lunch")
  const dragIds = schedule.items.flatMap((it) =>
    it.kind === 'visit' ? [it.place.id] : it.kind === 'meal' && it.restaurant ? [`meal:${it.meal}`] : [],
  )
  const { drag, rowProps } = useDragReorder(dragIds, (sequence) => {
    // 새 줄 순서 → 방문 순서 + 음식점이 몇 번 장소 다음인지
    const order = sequence.filter((id) => !id.startsWith('meal:'))
    const slots: MealSlots = {}
    sequence.forEach((id, index) => {
      if (id.startsWith('meal:')) {
        slots[id.slice(5) as MealKind] = sequence.slice(0, index).filter((x) => !x.startsWith('meal:')).length
      }
    })
    editor?.onReorder(order, slots)
  })
  // 끄는 중: 끄는 줄을 뺀 목록에서 몇 번째 자리에 놓일지 → 그 자리에 파란 선
  const dragOthers = drag ? dragIds.filter((id) => id !== drag.id) : []
  const dropChanges = drag ? dragIds.indexOf(drag.id) !== drag.overIndex : false
  const dropBeforeId = drag && dropChanges ? dragOthers[drag.overIndex] : undefined
  const dropAfterId =
    drag && dropChanges && drag.overIndex === dragOthers.length ? dragOthers[dragOthers.length - 1] : undefined
  const dragClasses = (id: string) =>
    [
      editor && 'draggable',
      drag?.id === id && 'dragging',
      dropBeforeId === id && 'drop-before',
      dropAfterId === id && 'drop-after',
    ]
      .filter(Boolean)
      .join(' ')
  const dragGhostName = drag
    ? drag.id.startsWith('meal:')
      ? mealChoices[drag.id.slice(5) as MealKind]?.name
      : places.find((p) => p.id === drag.id)?.name
    : undefined
  const [kind, setKind] = useState<KindFilter>('all')
  const [scope, setScope] = useState<ScopeFilter>('all')

  const placeName = (id: string) => places.find((p) => p.id === id)?.name ?? id
  const spare = schedule.limitAt - schedule.endAt

  const stops = useMemo(
    () => schedule.items.flatMap((it) => (it.kind === 'visit' ? [{ place: it.place, order: it.order }] : [])),
    [schedule],
  )
  const stopPlaces = useMemo(() => stops.map((s) => s.place), [stops])
  const { results: nearby, loading } = useNearby(stopPlaces, country.currency)

  // 선택한 방문지가 일정에서 빠지면 '동선 전체'로
  const activeScope = scope === 'all' || stops.some((s) => s.place.id === scope) ? scope : 'all'

  // 이미 일정에 있거나 식사 장소로 고른 곳은 추천에서 제외
  const excludeIds = useMemo(
    () =>
      new Set([
        ...stops.map((s) => s.place.id),
        ...Object.values(mealChoices).flatMap((poi) => (poi ? [poi.id] : [])),
      ]),
    [stops, mealChoices],
  )

  const recommendations = useMemo(() => {
    const candidates = (activeScope === 'all' ? Object.values(nearby).flat() : nearby[activeScope] ?? []).filter(
      (p) => kind === 'all' || p.kind === kind,
    )
    const anchors = activeScope === 'all' ? stopPlaces : stopPlaces.filter((p) => p.id === activeScope)
    return rankNearby(candidates, anchors, excludeIds, RECOMMENDATION_COUNT)
  }, [nearby, stopPlaces, kind, activeScope, excludeIds])

  function mealOptions(near: Place): Recommendation[] {
    const restaurants = (nearby[near.id] ?? []).filter((p) => p.kind === 'restaurant')
    return rankNearby(restaurants, [near], excludeIds, MEAL_OPTION_COUNT)
  }

  const { markers, paths } = useMemo(() => {
    const markers: MapMarker[] = []
    const paths: MapPath[] = []
    for (const item of schedule.items) {
      if (item.kind === 'visit') {
        markers.push({
          id: item.place.id,
          label: String(item.order),
          title: item.place.name,
          subtitle: `${toHHMM(item.start)} ~ ${toHHMM(item.end)}`,
          position: item.place.location,
        })
      } else if (item.kind === 'move') {
        // 실제 경로 API를 붙이기 전까지는 두 장소를 직선으로 연결
        paths.push({
          id: `${item.leg.from.id}>${item.leg.to.id}`,
          // 실제 길찾기 경로 모양이 있으면 그대로, 없으면 두 지점을 직선으로
          points: recommendedOption(item.leg).path ?? [item.leg.from.location, item.leg.to.location],
          mode: item.leg.recommended,
        })
      } else if (item.kind === 'lodging') {
        const existing = markers.find((m) => m.id === item.place.id)
        const time = `${item.role === 'depart' ? '출발' : '도착'} ${toHHMM(item.start)}`
        if (existing) {
          existing.subtitle += ` · ${time}`
        } else {
          markers.push({
            id: item.place.id,
            label: '🏨',
            title: `숙소 · ${item.place.name}`,
            subtitle: time,
            position: item.place.location,
            variant: 'lodging',
          })
        }
      } else {
        const chosen = mealChoices[item.meal]
        if (chosen && item.restaurant) {
          // 고른 음식점은 경로 지점 — 번호 없이 주황색 원으로 표시
          markers.push({
            id: chosen.id,
            label: '',
            title: `${mealLabels[item.meal]} · ${chosen.name}`,
            subtitle: `⭐ ${chosen.rating.toFixed(1)} (${chosen.reviewCount.toLocaleString()}) · ${toHHMM(item.start)} ~ ${toHHMM(item.end)}`,
            position: item.restaurant.location,
            variant: 'meal',
          })
        }
      }
    }
    for (const rec of recommendations) {
      if (markers.some((m) => m.id === rec.poi.id)) continue
      markers.push({
        id: rec.poi.id,
        label: nearbyKindIcons[rec.poi.kind],
        title: rec.poi.name,
        subtitle: `⭐ ${rec.poi.rating.toFixed(1)} (${rec.poi.reviewCount.toLocaleString()}) · 도보 ${rec.walkMinutes}분`,
        position: rec.poi.location,
        variant: 'poi',
      })
    }
    return { markers, paths }
  }, [schedule, recommendations, mealChoices])

  const usedModes = [...new Set(paths.map((p) => p.mode))]

  function focusOnMap(id: string) {
    setHighlightedId(id)
    setFocus((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }))
  }

  function onMarkerClick(id: string) {
    setHighlightedId(id)
    document.getElementById(`stop-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function adjustmentText(a: Adjustment): string {
    switch (a.kind) {
      case 'reduceStay':
        return `${placeName(a.placeId)} 머무는 시간을 ${formatDuration(a.stayMinutes)}으로 줄이기`
      case 'remove':
        return `${placeName(a.placeId)} 일정에서 빼기`
      case 'extendEnd':
        return `종료 시각을 ${a.endTime}까지 늦추기`
    }
  }

  return (
    <div className="result-layout">
      <section className="result-map">
        <MapView
          center={country.center}
          markers={markers}
          paths={paths}
          focus={focus}
          onMarkerClick={onMarkerClick}
        />
        {usedModes.length > 0 && (
          <div className="map-legend">
            {usedModes.map((mode: TravelMode) => (
              <span key={mode}>
                <i
                  className="legend-line"
                  style={{
                    borderTopColor: pathStyles[mode].color,
                    borderTopStyle: pathStyles[mode].dashArray ? 'dashed' : 'solid',
                  }}
                />
                {modeLabels[mode]}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="wizard schedule">
        <div className="schedule-head">
          <h2 className="wizard-title">
            {country.flag} {title}
          </h2>
          {actions && <div className="schedule-actions">{actions}</div>}
        </div>
        {banner}

        <dl className="stats">
          <div>
            <dt>일정</dt>
            <dd>
              {toHHMM(schedule.startAt)} ~ {toHHMM(schedule.endAt)}
            </dd>
          </div>
          <div>
            <dt>총 이동</dt>
            <dd>{formatDuration(schedule.totalMoveMinutes)}</dd>
          </div>
          <div>
            <dt>걷는 거리</dt>
            <dd>{formatDistance(schedule.totalWalkMeters)}</dd>
          </div>
          <div>
            <dt>{spare >= 0 ? '남는 시간' : '초과'}</dt>
            <dd className={spare < 0 ? 'error' : ''}>{formatDuration(Math.abs(spare))}</dd>
          </div>
        </dl>

        {editor && (
          <TimeRangeEditor
            startTime={toHHMM(schedule.startAt)}
            endTime={toHHMM(schedule.limitAt)}
            onChange={editor.onChangeTimes}
          />
        )}

        {schedule.overMinutes > 0 && (
          <div className="warning">
            <p>
              ⚠️ 종료 시각({toHHMM(schedule.limitAt)})보다 <strong>{formatDuration(schedule.overMinutes)}</strong> 늦게
              끝납니다.{editor && ' 아래 중 하나를 고르면 바로 다시 계산합니다.'}
            </p>
            {editor && (
              <div className="adjustments">
                {adjustments.map((a) => (
                  <button key={JSON.stringify(a)} type="button" className="btn small" onClick={() => editor.onApply(a)}>
                    {adjustmentText(a)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {editor && (
          <div className="order-bar">
            <span className="hint">
              {isCustomOrder ? '직접 바꾼 순서입니다.' : '이동시간이 가장 짧은 순서로 정했습니다.'} 장소나 주황색 원을
              꾹 눌러 끌면 순서를 바꿀 수 있어요.
            </span>
            {isCustomOrder && (
              <button type="button" className="btn small" onClick={editor.onResetOrder}>
                최적 순서로 되돌리기
              </button>
            )}
          </div>
        )}

        <ol className="timeline">
          {schedule.items.map((item, i) => {
            if (item.kind === 'move') {
              return (
                <li
                  key={i}
                  className="timeline-move"
                  style={{ borderLeftColor: pathStyles[item.leg.recommended].color }}
                >
                  <MoveRow leg={item.leg} country={country} showSource={!!routeStatus?.enabled} />
                </li>
              )
            }
            if (item.kind === 'meal') {
              const chosen = mealChoices[item.meal]
              const options = chosen ? [] : mealOptions(item.near)
              const dragId = `meal:${item.meal}`
              const movable = !!item.restaurant
              return (
                <li
                  key={i}
                  id={chosen ? `stop-${chosen.id}` : undefined}
                  className={[
                    'timeline-stop meal',
                    chosen && highlightedId === chosen.id && 'highlighted',
                    movable && dragClasses(dragId),
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  {...(editor && movable ? rowProps(dragId) : {})}
                >
                  {editor && movable && (
                    <span className="drag-grip" aria-hidden="true">
                      ⠿
                    </span>
                  )}
                  <span className="stop-time">{toHHMM(item.start)}</span>
                  {item.restaurant ? (
                    <span className="stop-marker meal-stop" aria-label="식사 장소" />
                  ) : (
                    <span className="stop-marker">🍽️</span>
                  )}
                  <div className="stop-body">
                    {chosen ? (
                      <>
                        <button type="button" className="as-link" onClick={() => focusOnMap(chosen.id)}>
                          <div className="stop-name">
                            {mealLabels[item.meal]} · {chosen.name}
                          </div>
                        </button>
                        <div className="hint">
                          <Stars rating={chosen.rating} reviewCount={chosen.reviewCount} /> ·{' '}
                          {formatDuration(item.end - item.start)}{' '}
                          {editor && (
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() => editor.onChooseMeal(item.meal, null)}
                            >
                              다른 곳 고르기
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="stop-name">{mealLabels[item.meal]} 식사</div>
                        <div className="hint">
                          {item.near.name} 근처 · {formatDuration(item.end - item.start)}
                          {editor ? ' · 아래에서 음식점을 골라 주세요' : ' · 음식점 미정'}
                        </div>
                        {!editor ? null : loading ? (
                          <p className="hint">음식점을 찾는 중…</p>
                        ) : (
                          <ul className="meal-options">
                            {options.map((rec) => (
                              <li key={rec.poi.id}>
                                <span className="meal-option-name">{rec.poi.name}</span>
                                <Stars rating={rec.poi.rating} reviewCount={rec.poi.reviewCount} />
                                <span className="muted">도보 {rec.walkMinutes}분</span>
                                <button
                                  type="button"
                                  className="btn small"
                                  onClick={() => editor.onChooseMeal(item.meal, rec.poi)}
                                >
                                  선택
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </li>
              )
            }
            if (item.kind === 'lodging') {
              // 출발·도착 두 줄 중 첫 줄에만 id를 붙여 지도 마커 클릭 시 스크롤 대상이 되게 함
              const isFirst = schedule.items.findIndex((it) => it.kind === 'lodging') === i
              return (
                <li
                  key={i}
                  id={isFirst ? `stop-${item.place.id}` : undefined}
                  className={`timeline-stop lodging ${highlightedId === item.place.id ? 'highlighted' : ''}`}
                >
                  <span className="stop-time">{toHHMM(item.start)}</span>
                  <span className="stop-marker">🏨</span>
                  <button type="button" className="stop-body as-link" onClick={() => focusOnMap(item.place.id)}>
                    <div className="stop-name">{item.role === 'depart' ? '숙소에서 출발' : '숙소 도착'}</div>
                    <div className="hint">{item.place.name}</div>
                  </button>
                </li>
              )
            }
            const last = schedule.order.length
            const id = item.place.id
            const rowClass = ['timeline-stop', highlightedId === id && 'highlighted', dragClasses(id)]
              .filter(Boolean)
              .join(' ')
            const stayMinutes = item.end - item.start
            // 목록에 없는 값(예: 45분)도 고를 수 있게 끼워 넣음
            const stayChoices = STAY_OPTIONS.includes(stayMinutes)
              ? STAY_OPTIONS
              : [...STAY_OPTIONS, stayMinutes].sort((a, b) => a - b)
            return (
              <li key={i} id={`stop-${id}`} className={rowClass} {...(editor ? rowProps(id) : {})}>
                {editor && (
                  <span className="drag-grip" aria-hidden="true">
                    ⠿
                  </span>
                )}
                <span className="stop-time">{toHHMM(item.start)}</span>
                <span className="stop-marker number">{item.order}</span>
                <button type="button" className="stop-body as-link" onClick={() => focusOnMap(item.place.id)}>
                  <div className="stop-name">{item.place.name}</div>
                  <div className="hint">
                    {toHHMM(item.start)} ~ {toHHMM(item.end)}
                    {!editor && ` · ${formatDuration(stayMinutes)}`} · 지도에서 보기
                  </div>
                </button>
                {editor && (
                  <select
                    className="stay-inline"
                    aria-label={`${item.place.name} 머무를 시간`}
                    value={stayMinutes}
                    onChange={(e) => editor.onChangeStay(id, Number(e.target.value))}
                  >
                    {stayChoices.map((m) => (
                      <option key={m} value={m}>
                        {formatDuration(m)}
                      </option>
                    ))}
                  </select>
                )}
                {editor && (
                <div className="reorder">
                  <button
                    type="button"
                    aria-label="앞으로"
                    disabled={item.order === 1}
                    onClick={() => editor.onMove(item.place.id, -1)}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    aria-label="뒤로"
                    disabled={item.order === last}
                    onClick={() => editor.onMove(item.place.id, 1)}
                  >
                    ▼
                  </button>
                </div>
                )}
              </li>
            )
          })}
        </ol>
        {drag && (
          <div className="drag-ghost" style={{ left: drag.x + 14, top: drag.y - 22 }} aria-hidden="true">
            ⠿ {dragGhostName ?? ''}
          </div>
        )}
        <p className="hint">
          {routeStatus?.loading ? '🔄 실제 경로를 불러오는 중… ' : ''}
          {routeStatus?.note ?? '이동시간은 거리로 계산한 추정치이고, 지도 경로선은 직선입니다.'}
        </p>

        <NearbyPanel
          stops={stops}
          kind={kind}
          scope={activeScope}
          onKindChange={setKind}
          onScopeChange={setScope}
          recommendations={recommendations}
          loading={loading}
          highlightedId={highlightedId}
          onFocus={focusOnMap}
          onAdd={editor?.onAddPlace}
        />
      </div>
    </div>
  )
}
