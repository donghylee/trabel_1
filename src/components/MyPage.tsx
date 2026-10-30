import { useMemo, useState, type ReactNode } from 'react'
import { findCountry, localizePlaceName, placesOf, tripTitle } from '../data/catalog'
import type { Bookmark } from '../hooks/useBookmarks'
import { useFetchRealLegs, useRealLegStore } from '../hooks/useRealLegs'
import { t } from '../i18n'
import { buildSchedule } from '../lib/schedule'
import { routeNote } from '../services/routes'
import type { SavedDay, SavedTrip } from '../types'
import { UserIcon } from './AuthPage'
import ScheduleView from './ScheduleView'
import ShareDialog from './ShareDialog'

export type MyPageSelection = { tripId: string; dayNumber: number | null } | null

type Props = {
  trips: SavedTrip[]
  /** 로그인하지 않았으면 null */
  bookmarks: Bookmark[] | null
  onRemoveBookmark: (postId: string) => void
  onOpenCommunity: () => void
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
      <strong>{t('{n}일차', { n: day.dayNumber })}</strong>
      <span className="muted">
        {startTime}~{endTime}
      </span>
      <span className="day-route">
        {lodgingName && '🏨 → '}
        {placeNames.map(localizePlaceName).join(' → ')}
      </span>
    </span>
  )
}

/** 저장한 하루 일정을 다시 계산해서 읽기 전용으로 보여줌 */
function SavedDayView({
  trip,
  day,
  panelTop,
  onEdit,
  onDelete,
}: {
  trip: SavedTrip
  day: SavedDay
  panelTop: ReactNode
  onEdit: () => void
  onDelete: () => void
}) {
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
  if (!country || !result) return <p className="hint">{t('이 일정을 불러오지 못했습니다.')}</p>

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
      title={`${tripTitle(trip)} · ${t('{n}일차', { n: day.dayNumber })}`}
      panelTop={panelTop}
      actions={
        <>
          <button type="button" className="btn small" onClick={onEdit}>
            {t('수정하기')}
          </button>
          <button type="button" className="btn small danger" onClick={onDelete}>
            {t('삭제')}
          </button>
        </>
      }
    />
  )
}

export default function MyPage({
  trips,
  bookmarks,
  onRemoveBookmark,
  onOpenCommunity,
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
  const [sharing, setSharing] = useState<SavedTrip | null>(null)
  const trip = trips.find((x) => x.id === selection?.tripId)
  const shareDialog = sharing && (
    <ShareDialog
      trip={sharing}
      country={findCountry(sharing.countryCode)}
      onClose={() => setSharing(null)}
    />
  )

  // 여행 상세
  if (trip) {
    const day = trip.days.find((d) => d.dayNumber === selection?.dayNumber) ?? trip.days[0]
    const country = findCountry(trip.countryCode)
    // 목록으로·여행 이름·일차 탭·공유 — 오른쪽 정보창 맨 위에 둠 (일차가 없으면 화면 위에)
    const tripBar = (
      <div className="trip-bar">
        <button type="button" className="btn small" onClick={() => onSelect(null)}>
          ← {t('목록')}
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
              {t('확인')}
            </button>
          </form>
        ) : (
          <h2 className="trip-name">
            {country?.flag} {tripTitle(trip)}
            <button type="button" className="link-btn" onClick={() => setRenaming(trip.name)}>
              {t('이름 변경')}
            </button>
          </h2>
        )}
        <button type="button" className="btn small" disabled={trip.days.length === 0} onClick={() => setSharing(trip)}>
          📤 {t('공유')}
        </button>
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
              {t('{n}일차', { n: d.dayNumber })}
            </button>
          ))}
          <button type="button" className="tab add" onClick={() => onAddDay(trip)}>
            {t('+ 일차 추가')}
          </button>
        </div>
      </div>
    )
    return (
      <div className="mypage-detail">
        {day ? (
          <SavedDayView
            trip={trip}
            day={day}
            panelTop={tripBar}
            onEdit={() => onEditDay(trip, day)}
            onDelete={() => {
              if (window.confirm(t('{name} {n}일차 일정을 삭제할까요?', { name: tripTitle(trip), n: day.dayNumber }))) {
                onDeleteDay(trip, day.dayNumber)
              }
            }}
          />
        ) : (
          <>
            {tripBar}
            <div className="app-main">
              <p className="hint">{t('저장된 일차가 없습니다. [+ 일차 추가]로 일정을 만들어 주세요.')}</p>
            </div>
          </>
        )}
        {shareDialog}
      </div>
    )
  }

  // 여행 목록
  return (
    <>
      <div className="wizard mypage">
        <div className="schedule-head">
          <h2 className="wizard-title">{t('내 여행')}</h2>
          <button type="button" className="btn small primary" onClick={onNewPlan}>
            {t('+ 새 여행 계획')}
          </button>
        </div>

        {trips.length === 0 ? (
          <p className="hint">
            {t('아직 저장한 여행이 없습니다. 일정을 만든 뒤 결과 화면의 [저장] 버튼으로 1일차, 2일차처럼 저장할 수 있습니다.')}
          </p>
        ) : (
          <ul className="trip-list">
            {trips.map((item) => {
              const c = findCountry(item.countryCode)
              return (
                <li key={item.id} className="trip-card">
                  <button type="button" className="trip-card-main as-link" onClick={() => onSelect({ tripId: item.id, dayNumber: null })}>
                    <div className="trip-card-title">
                      {c?.flag} {tripTitle(item)}
                    </div>
                    <div className="hint">
                      {t('{n}일 저장 · 마지막 수정 {date}', { n: item.days.length, date: formatDate(item.updatedAt) })}
                    </div>
                  </button>
                  <ul className="trip-days">
                    {item.days.map((d) => (
                      <li key={d.dayNumber}>
                        <button
                          type="button"
                          className="as-link"
                          onClick={() => onSelect({ tripId: item.id, dayNumber: d.dayNumber })}
                        >
                          <DaySummary day={d} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="trip-card-actions">
                    <button type="button" className="btn small" onClick={() => onSelect({ tripId: item.id, dayNumber: null })}>
                      {t('열기')}
                    </button>
                    <button type="button" className="btn small" disabled={item.days.length === 0} onClick={() => setSharing(item)}>
                      📤 {t('공유')}
                    </button>
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() => {
                        if (window.confirm(t('"{name}" 여행을 통째로 삭제할까요? ({n}일 일정)', { name: tripTitle(item), n: item.days.length })))
                          onDeleteTrip(item)
                      }}
                    >
                      {t('여행 삭제')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <p className="hint">{t('저장한 일정은 지금 사용하는 브라우저에만 보관됩니다.')}</p>
      </div>

      {/* 커뮤니티에서 즐겨찾기한 다른 사람의 여행이 모일 자리 (커뮤니티 기능을 붙이면 채움) */}
      <div className="wizard mypage">
        <div className="schedule-head">
          <h2 className="wizard-title">{t('찜한 여행')}</h2>
        </div>
        {bookmarks === null ? (
          <p className="hint">{t('로그인하면 커뮤니티에서 찜한 여행을 여기서 볼 수 있습니다.')}</p>
        ) : bookmarks.length === 0 ? (
          <p className="hint">
            {t('아직 찜한 여행이 없습니다. 커뮤니티에서 마음에 드는 여행의 🔖를 누르면 여기에 모입니다.')}{' '}
            <button type="button" className="link-btn" onClick={onOpenCommunity}>
              {t('커뮤니티 둘러보기')}
            </button>
          </p>
        ) : (
          <ul className="trip-list">
            {bookmarks.map((b) => {
              const c = findCountry(b.trip.countryCode)
              return (
                <li key={b.postId} className="trip-card">
                  <div className="bookmark-author">
                    <UserIcon icon={b.author.icon} />
                    <span>{b.author.nickname}</span>
                    <span className="hint">· {t('찜한 날 {date}', { date: formatDate(b.savedAt) })}</span>
                  </div>
                  <button type="button" className="trip-card-main as-link" onClick={() => setSharing(b.trip)}>
                    <div className="trip-card-title">
                      {c?.flag} {tripTitle(b.trip)}
                    </div>
                    <div className="hint">
                      {c?.name ?? b.trip.countryCode} · {t('{n}일 일정', { n: b.trip.days.length })}
                    </div>
                  </button>
                  <ul className="trip-days">
                    {b.trip.days.map((d) => (
                      <li key={d.dayNumber}>
                        <DaySummary day={d} />
                      </li>
                    ))}
                  </ul>
                  <div className="trip-card-actions">
                    <button type="button" className="btn small" onClick={() => setSharing(b.trip)}>
                      {t('일정 보기')}
                    </button>
                    <button
                      type="button"
                      className="btn small danger"
                      onClick={() => {
                        if (window.confirm(t('"{name}"을(를) 찜한 여행에서 뺄까요?', { name: tripTitle(b.trip) }))) onRemoveBookmark(b.postId)
                      }}
                    >
                      {t('찜 해제')}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      {shareDialog}
    </>
  )
}
