import { useState } from 'react'
import { tripTitle } from '../data/catalog'
import { t } from '../i18n'
import { nextDayNumber, type SaveTarget } from '../lib/storage'
import { serverEnabled } from '../services/supabase'
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
  const initialTrip = trips.find((trip) => trip.id === defaultTripId) ?? null
  const [mode, setMode] = useState<'new' | 'existing'>(initialTrip ? 'existing' : 'new')
  const [name, setName] = useState(t('{country} 여행', { country: country.name }))
  const [tripId, setTripId] = useState(initialTrip?.id ?? trips[0]?.id ?? '')
  const selectedTrip = mode === 'existing' ? trips.find((trip) => trip.id === tripId) : undefined
  const [dayNumber, setDayNumber] = useState(defaultDayNumber ?? nextDayNumber(initialTrip ?? undefined))
  // 여행 시작일 — 일정 10분 전 알림용 (서버에 저장할 때만 알림이 감)
  const [startDate, setStartDate] = useState(initialTrip?.startDate ?? '')

  const overwrites = !!selectedTrip?.days.some((d) => d.dayNumber === dayNumber)
  const canSave = mode === 'new' ? name.trim().length > 0 : !!selectedTrip

  function changeTrip(id: string) {
    setTripId(id)
    const trip = trips.find((trip) => trip.id === id)
    setDayNumber(nextDayNumber(trip))
    setStartDate(trip?.startDate ?? '')
  }

  function changeMode(next: 'new' | 'existing') {
    setMode(next)
    const trip = next === 'new' ? undefined : trips.find((trip) => trip.id === tripId)
    setDayNumber(trip ? nextDayNumber(trip) : 1)
    setStartDate(trip?.startDate ?? '')
  }

  function submit() {
    if (!canSave) return
    // 바꿨을 때만 넘김 (서버가 없으면 시작일 칸도 없음)
    const date = serverEnabled && startDate !== (selectedTrip?.startDate ?? '') ? { startDate } : {}
    const target: SaveTarget =
      mode === 'new' ? { kind: 'new', name: name.trim(), countryCode: country.code, ...date } : { kind: 'existing', tripId, ...date }
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
          {t('일정 저장')}
        </h2>

        <fieldset className="dialog-field">
          <legend>{t('어느 여행에 저장할까요?')}</legend>
          <label className="radio-row">
            <input type="radio" checked={mode === 'new'} onChange={() => changeMode('new')} />
            {t('새 여행')}
          </label>
          {mode === 'new' && (
            <input
              className="text-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('여행 이름 (예: 도쿄 3박 4일)')}
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
            {t('저장해 둔 여행에 추가')} {trips.length === 0 && <span className="muted">{t('(아직 없음)')}</span>}
          </label>
          {mode === 'existing' && (
            <select className="text-input" value={tripId} onChange={(e) => changeTrip(e.target.value)}>
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {tripTitle(trip)} ({t('{n}일 저장됨', { n: trip.days.length })})
                </option>
              ))}
            </select>
          )}
        </fieldset>

        <label className="dialog-field">
          <span className="dialog-label">{t('몇 일차 일정인가요?')}</span>
          <select className="text-input" value={dayNumber} onChange={(e) => setDayNumber(Number(e.target.value))}>
            {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((n) => {
              const taken = selectedTrip?.days.some((d) => d.dayNumber === n)
              return (
                <option key={n} value={n}>
                  {t('{n}일차', { n })}
                  {taken ? ` ${t('(저장됨 · 덮어쓰기)')}` : ''}
                </option>
              )
            })}
          </select>
        </label>
        {overwrites && <p className="hint error">{t('이미 저장된 {n}일차 일정을 이 일정으로 바꿉니다.', { n: dayNumber })}</p>}
        {serverEnabled && (
          <label className="dialog-field">
            <span className="dialog-label">{t('여행 시작일 (1일차 날짜, 선택)')}</span>
            <input className="text-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="hint">{t('날짜를 넣으면 일정마다 10분 전에 알림을 보내 드려요. (계정 설정에서 알림을 켠 기기)')}</span>
          </label>
        )}

        <div className="wizard-nav">
          <button type="button" className="btn" onClick={onCancel}>
            {t('취소')}
          </button>
          <button type="button" className="btn primary" disabled={!canSave} onClick={submit}>
            {overwrites ? t('덮어쓰기') : t('저장')}
          </button>
        </div>
      </div>
    </div>
  )
}
