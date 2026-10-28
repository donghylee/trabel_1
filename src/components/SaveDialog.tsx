import { useState } from 'react'
import { nextDayNumber, type SaveTarget } from '../lib/storage'
import type { Country, SavedTrip } from '../types'

type Props = {
  country: Country
  /** 같은 나라의 저장된 여행 */
  trips: SavedTrip[]
  /** 저장된 일정을 고치는 중이면 그 여행·일차를 기본으로 */
  defaultTripId: string | null
  defaultDayNumber: number | null
  onCancel: () => void
  onSave: (target: SaveTarget, dayNumber: number) => void
}

const MAX_DAYS = 30

export default function SaveDialog({ country, trips, defaultTripId, defaultDayNumber, onCancel, onSave }: Props) {
  const initialTrip = trips.find((t) => t.id === defaultTripId) ?? null
  const [mode, setMode] = useState<'new' | 'existing'>(initialTrip ? 'existing' : 'new')
  const [name, setName] = useState(`${country.name} 여행`)
  const [tripId, setTripId] = useState(initialTrip?.id ?? trips[0]?.id ?? '')
  const selectedTrip = mode === 'existing' ? trips.find((t) => t.id === tripId) : undefined
  const [dayNumber, setDayNumber] = useState(defaultDayNumber ?? nextDayNumber(initialTrip ?? undefined))

  const overwrites = !!selectedTrip?.days.some((d) => d.dayNumber === dayNumber)
  const canSave = mode === 'new' ? name.trim().length > 0 : !!selectedTrip

  function changeTrip(id: string) {
    setTripId(id)
    setDayNumber(nextDayNumber(trips.find((t) => t.id === id)))
  }

  function changeMode(next: 'new' | 'existing') {
    setMode(next)
    setDayNumber(next === 'new' ? 1 : nextDayNumber(trips.find((t) => t.id === tripId)))
  }

  function submit() {
    if (!canSave) return
    const target: SaveTarget =
      mode === 'new' ? { kind: 'new', name: name.trim(), countryCode: country.code } : { kind: 'existing', tripId }
    onSave(target, dayNumber)
  }

  return (
    <div className="dialog-backdrop" onClick={onCancel}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-dialog-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
      >
        <h2 id="save-dialog-title" className="wizard-title">
          일정 저장
        </h2>

        <fieldset className="dialog-field">
          <legend>어느 여행에 저장할까요?</legend>
          <label className="radio-row">
            <input type="radio" checked={mode === 'new'} onChange={() => changeMode('new')} />새 여행
          </label>
          {mode === 'new' && (
            <input
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="여행 이름 (예: 도쿄 3박 4일)"
              autoFocus
            />
          )}
          <label className="radio-row">
            <input
              type="radio"
              checked={mode === 'existing'}
              disabled={trips.length === 0}
              onChange={() => changeMode('existing')}
            />
            저장해 둔 여행에 추가 {trips.length === 0 && <span className="muted">(아직 없음)</span>}
          </label>
          {mode === 'existing' && (
            <select className="text-input" value={tripId} onChange={(e) => changeTrip(e.target.value)}>
              {trips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.days.length}일 저장됨)
                </option>
              ))}
            </select>
          )}
        </fieldset>

        <label className="dialog-field">
          <span className="dialog-label">몇 일차 일정인가요?</span>
          <select className="text-input" value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))}>
            {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((n) => {
              const taken = selectedTrip?.days.some((d) => d.dayNumber === n)
              return (
                <option key={n} value={n}>
                  {n}일차{taken ? ' (저장됨 · 덮어쓰기)' : ''}
                </option>
              )
            })}
          </select>
        </label>
        {overwrites && <p className="hint error">이미 저장된 {dayNumber}일차 일정을 이 일정으로 바꿉니다.</p>}

        <div className="wizard-nav">
          <button type="button" className="btn" onClick={onCancel}>
            취소
          </button>
          <button type="button" className="btn primary" disabled={!canSave} onClick={submit}>
            {overwrites ? '덮어쓰기' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
