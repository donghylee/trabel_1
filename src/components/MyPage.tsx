import { useMemo, useState } from 'react'
import { findCountry, placesOf } from '../data/catalog'
import { useFetchRealLegs, useRealLegStore } from '../hooks/useRealLegs'
import { buildSchedule } from '../lib/schedule'
import { routeNote } from '../services/routes'
import type { SavedDay, SavedTrip } from '../types'
import ScheduleView from './ScheduleView'

export type MyPageSelection = { tripId: string; dayNumber: number | null } | null

type Props = {
  trips: SavedTrip[]
  selection: MyPageSelection
  onSelect: (selection: MyPageSelection) => void
  onEditDay: (trip: SavedTrip, day: SavedDay) => void
  onAddDay: (trip: SavedTrip) => void
  onDeleteDay: (trip: SavedTrip, dayNumber: number) => void
  onDeleteTrip: (trip: SavedTrip) => void
  onRenameTrip: (trip: SavedTrip, name: string) => void
  onNewPlan: () => void
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}

function DaySummary({ day }: { day: SavedDay }) {
  const { startTime, endTime, placeNames, lodgingName } = day.summary
  return (
    <span className="day-summary">
      <strong>{day.dayNumber}일차</strong>
      <span className="muted">
        {startTime}~{endTime}
      </span>
      <span className="day-route">
        {lodgingName && '🏨 → '}
        {placeNames.join(' → ')}
      </span>
    </span>
  )
}

/** 저장한 하루 일정을 다시 계산해서 읽기 전용으로 보여줌 */
function SavedDayView({ trip, day, onEdit, onDelete }: { trip: SavedTrip; day: SavedDay; onEdit: () => void; onDelete: () => void }) {
  const country = findCountry(trip.countryCode)
  const realLegs = useRealLegStore()
  const result = useMemo(() => {
    if (!country) return null
    const places = [...placesOf(country), ...day.input.customPlaces]
    const schedule = buildSchedule(
      day.input,
      places,
      country.currency,
      day.customOrder ?? undefined,
      day.mealChoices,
      day.mealSlots ?? {},
      realLegs.legs,
    )
    return { places, schedule }
  }, [country, day, realLegs.legs])
  const routeFetch = useFetchRealLegs(country, result?.schedule, realLegs.legs, realLegs.add)
  if (!country || !result) return <p className="hint">이 일정을 불러오지 못했습니다.</p>

  return (
    <ScheduleView
      key={`${trip.id}-${day.dayNumber}`}
      country={country}
      routeStatus={{ ...routeFetch, note: routeNote(country) }}
      places={result.places}
      schedule={result.schedule}
      adjustments={[]}
      isCustomOrder={day.customOrder !== null}
      mealChoices={day.mealChoices}
      title={`${trip.name} · ${day.dayNumber}일차`}
      actions={
        <>
          <button type="button" className="btn small" onClick={onEdit}>
            수정하기
          </button>
          <button type="button" className="btn small danger" onClick={onDelete}>
            삭제
          </button>
        </>
      }
    />
  )
}

export default function MyPage({
  trips,
  selection,
  onSelect,
  onEditDay,
  onAddDay,
  onDeleteDay,
  onDeleteTrip,
  onRenameTrip,
  onNewPlan,
}: Props) {
  const [renaming, setRenaming] = useState<string | null>(null)
  const trip = trips.find((t) => t.id === selection?.tripId)

  // 여행 상세
  if (trip) {
    const day = trip.days.find((d) => d.dayNumber === selection?.dayNumber) ?? trip.days[0]
    const country = findCountry(trip.countryCode)
    return (
      <div className="mypage-detail">
        <div className="trip-bar">
          <button type="button" className="btn small" onClick={() => onSelect(null)}>
            ← 목록
          </button>
          {renaming !== null ? (
            <form
              className="rename-form"
              onSubmit={(e) => {
                e.preventDefault()
                if (renaming.trim()) onRenameTrip(trip, renaming.trim())
                setRenaming(null)
              }}
            >
              <input className="text-input" value={renaming} onChange={(e) => setRenaming(e.target.value)} autoFocus />
              <button type="submit" className="btn small primary">
                확인
              </button>
            </form>
          ) : (
            <h2 className="trip-name">
              {country?.flag} {trip.name}
              <button type="button" className="link-btn" onClick={() => setRenaming(trip.name)}>
                이름 변경
              </button>
            </h2>
          )}
          <div className="day-tabs" role="tablist">
            {trip.days.map((d) => (
              <button
                key={d.dayNumber}
                type="button"
                role="tab"
                aria-selected={d.dayNumber === day?.dayNumber}
                className={`tab ${d.dayNumber === day?.dayNumber ? 'active' : ''}`}
                onClick={() => onSelect({ tripId: trip.id, dayNumber: d.dayNumber })}
              >
                {d.dayNumber}일차
              </button>
            ))}
            <button type="button" className="tab add" onClick={() => onAddDay(trip)}>
              + 일차 추가
            </button>
          </div>
        </div>
        {day ? (
          <SavedDayView
            trip={trip}
            day={day}
            onEdit={() => onEditDay(trip, day)}
            onDelete={() => {
              if (window.confirm(`${trip.name} ${day.dayNumber}일차 일정을 삭제할까요?`)) {
                onDeleteDay(trip, day.dayNumber)
              }
            }}
          />
        ) : (
          <div className="app-main">
            <p className="hint">저장된 일차가 없습니다. [+ 일차 추가]로 일정을 만들어 주세요.</p>
          </div>
        )}
      </div>
    )
  }

  // 여행 목록
  return (
    <div className="wizard mypage">
      <div className="schedule-head">
        <h2 className="wizard-title">내 여행</h2>
        <button type="button" className="btn small primary" onClick={onNewPlan}>
          + 새 여행 계획
        </button>
      </div>

      {trips.length === 0 ? (
        <p className="hint">
          아직 저장한 여행이 없습니다. 일정을 만든 뒤 결과 화면의 [저장] 버튼으로 1일차, 2일차처럼 저장할 수 있습니다.
        </p>
      ) : (
        <ul className="trip-list">
          {trips.map((t) => {
            const c = findCountry(t.countryCode)
            return (
              <li key={t.id} className="trip-card">
                <button type="button" className="trip-card-main as-link" onClick={() => onSelect({ tripId: t.id, dayNumber: null })}>
                  <div className="trip-card-title">
                    {c?.flag} {t.name}
                  </div>
                  <div className="hint">
                    {t.days.length}일 저장 · 마지막 수정 {formatDate(t.updatedAt)}
                  </div>
                </button>
                <ul className="trip-days">
                  {t.days.map((d) => (
                    <li key={d.dayNumber}>
                      <button
                        type="button"
                        className="as-link"
                        onClick={() => onSelect({ tripId: t.id, dayNumber: d.dayNumber })}
                      >
                        <DaySummary day={d} />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="trip-card-actions">
                  <button type="button" className="btn small" onClick={() => onSelect({ tripId: t.id, dayNumber: null })}>
                    열기
                  </button>
                  <button
                    type="button"
                    className="btn small danger"
                    onClick={() => {
                      if (window.confirm(`"${t.name}" 여행을 통째로 삭제할까요? (${t.days.length}일 일정)`)) onDeleteTrip(t)
                    }}
                  >
                    여행 삭제
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      <p className="hint">저장한 일정은 지금 사용하는 브라우저에만 보관됩니다.</p>
    </div>
  )
}
