import { useEffect, useRef, useState, type FormEvent } from 'react'
import { findCountry, tripTitle } from '../data/catalog'
import type { useInbox } from '../hooks/useInbox'
import { t } from '../i18n'
import type { SessionUser } from '../lib/auth'
import { askConfirm } from '../lib/confirm'
import { resizeImage } from '../lib/image'
import {
  deleteMessage,
  fetchConversation,
  hideConversation,
  markRead,
  MAX_DM_LENGTH,
  MAX_DM_PHOTOS,
  photoUrls,
  previewOf,
  sendMessage,
  watchMessages,
} from '../lib/messages'
import { disablePush, enablePush, pushStatus, type PushStatus } from '../lib/push'
import { timeAgo } from '../lib/time'
import type { DmMessage, DmUser, SavedTrip } from '../types'
import { UserIcon } from './AuthPage'

type Props = {
  user: SessionUser | null
  inbox: ReturnType<typeof useInbox>
  /** 메시지로 보낼 수 있는 내 여행 */
  trips: SavedTrip[]
  /** 열어 둔 대화 (없으면 목록) */
  openId: string | null
  onOpen: (conversationId: string | null) => void
  onLogin: () => void
  onOpenCommunity: () => void
  /** 메시지로 받은(보낸) 일정을 지도 화면으로 */
  onViewTrip: (trip: SavedTrip, from: DmUser) => void
}

/** 메시지함 — 대화 목록, 또는 열어 둔 대화 */
export default function MessagesPage({ user, inbox, trips, openId, onOpen, onLogin, onOpenCommunity, onViewTrip }: Props) {
  if (!user) {
    return (
      <div className="wizard dm-page">
        <h2 className="wizard-title">{t('메시지')}</h2>
        <p className="hint">
          {t('로그인하면 다른 사람과 메시지를 주고받을 수 있습니다.')}{' '}
          <button type="button" className="link-btn" onClick={onLogin}>
            {t('로그인하기')}
          </button>
        </p>
      </div>
    )
  }
  if (openId) {
    return (
      <Conversation
        key={openId}
        user={user}
        conversationId={openId}
        trips={trips}
        onBack={() => onOpen(null)}
        onRead={inbox.refresh}
        onViewTrip={onViewTrip}
      />
    )
  }
  return (
    <div className="wizard dm-page">
      <h2 className="wizard-title">{t('메시지')}</h2>
      <PushToggle />
      {inbox.loading ? (
        <p className="hint">{t('메시지를 불러오는 중…')}</p>
      ) : inbox.failed && inbox.threads.length === 0 ? (
        <p className="notice error-notice">{t('메시지를 불러오지 못했습니다. 새로고침해 주세요.')}</p>
      ) : inbox.threads.length === 0 ? (
        <p className="hint">
          {t('아직 주고받은 메시지가 없습니다. 커뮤니티 게시글의 ✉️ 버튼으로 대화를 시작해 보세요.')}{' '}
          <button type="button" className="link-btn" onClick={onOpenCommunity}>
            {t('커뮤니티 둘러보기')}
          </button>
        </p>
      ) : (
        <ul className="dm-threads">
          {inbox.threads.map((thread) => (
            <li key={thread.id}>
              <button type="button" className="dm-thread" onClick={() => onOpen(thread.id)}>
                <UserIcon icon={thread.other.icon} size="medium" />
                <span className="dm-thread-text">
                  <strong>{thread.other.nickname}</strong>
                  <span className={`dm-thread-preview ${thread.unread ? 'unread' : ''}`}>
                    {thread.last.senderId === user.id && !thread.last.deleted && `${t('나')}: `}
                    {previewOf(thread.last)}
                  </span>
                </span>
                <span className="dm-thread-side">
                  <span className="hint">{timeAgo(thread.last.at)}</span>
                  {thread.unread > 0 && <span className="count unread">{thread.unread > 99 ? '99+' : thread.unread}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 이 기기로 메시지 알림 받기 켜기·끄기 */
function PushToggle() {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    pushStatus().then((s) => {
      if (!cancelled) setStatus(s)
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (!status || status === 'unsupported') return null
  if (status === 'needs-install')
    return <p className="notice dm-push">{t('🔔 아이폰은 홈 화면에 앱을 설치하면 메시지 알림을 받을 수 있어요. (iOS 16.4 이상)')}</p>
  if (status === 'denied')
    return <p className="notice dm-push">{t('🔕 알림이 막혀 있어요. 휴대폰(브라우저) 설정에서 PLAN:J 알림을 허용해 주세요.')}</p>

  async function toggle() {
    setBusy(true)
    if (status === 'on') {
      await disablePush()
      setStatus(await pushStatus())
    } else {
      setStatus(await enablePush())
    }
    setBusy(false)
  }

  return (
    <div className="notice dm-push">
      <span>{status === 'on' ? t('🔔 이 기기로 메시지 알림을 받고 있어요.') : t('🔔 앱이 꺼져 있어도 새 메시지를 알림으로 받아 보세요.')}</span>
      <button type="button" className={`btn small ${status === 'on' ? '' : 'primary'}`} disabled={busy} onClick={toggle}>
        {status === 'on' ? t('알림 끄기') : t('알림 켜기')}
      </button>
    </div>
  )
}

/** 오늘이면 시:분, 아니면 월/일 시:분 */
function messageTime(iso: string): string {
  const d = new Date(iso)
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return d.toDateString() === new Date().toDateString() ? hm : `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

function Conversation({
  user,
  conversationId,
  trips,
  onBack,
  onRead,
  onViewTrip,
}: {
  user: SessionUser
  conversationId: string
  trips: SavedTrip[]
  onBack: () => void
  /** 읽음 표시 뒤 메시지함 숫자를 다시 셈 */
  onRead: () => void
  onViewTrip: (trip: SavedTrip, from: DmUser) => void
}) {
  const [data, setData] = useState<{ other: DmUser; messages: DmMessage[] } | null>(null)
  const [failed, setFailed] = useState(false)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [draft, setDraft] = useState('')
  const [photos, setPhotos] = useState<string[]>([])
  const [trip, setTrip] = useState<SavedTrip | null>(null)
  const [attachOpen, setAttachOpen] = useState(false)
  const [pickingTrip, setPickingTrip] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // 대화 불러오기 + 새 메시지가 오면 다시 (열어 둔 동안은 읽음으로)
  useEffect(() => {
    let cancelled = false
    async function load() {
      const loaded = await fetchConversation(user, conversationId)
      if (cancelled) return
      if (!loaded) {
        setFailed(true)
        return
      }
      setFailed(false)
      setData(loaded)
      await markRead(user, conversationId)
      if (!cancelled) onRead()
    }
    void load()
    const stop = watchMessages(user, (changed) => {
      if (changed === null || changed === conversationId) void load()
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [user, conversationId, onRead])

  // 사진을 보여 줄 주소 (서버: 잠깐 쓰는 서명 주소)
  const messages = data?.messages
  useEffect(() => {
    const missing = (messages ?? []).flatMap((m) => m.photos).filter((p) => !(p in urls))
    if (!missing.length) return
    let cancelled = false
    photoUrls(missing).then((found) => {
      // 못 바꾼 사진도 빈 주소로 기억해 두어 계속 다시 묻지 않게
      if (!cancelled) setUrls((prev) => ({ ...prev, ...Object.fromEntries(missing.map((p) => [p, found[p] ?? ''])) }))
    })
    return () => {
      cancelled = true
    }
  }, [messages, urls])

  // 새 메시지가 보이게 맨 아래로
  const count = messages?.length ?? 0
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [count])

  async function addPhotos(files: FileList | null) {
    if (!files) return
    const room = MAX_DM_PHOTOS - photos.length
    if (files.length > room) setError(t('사진은 한 번에 {n}장까지 보낼 수 있습니다.', { n: MAX_DM_PHOTOS }))
    const added: string[] = []
    for (const file of Array.from(files).slice(0, room)) {
      if (!file.type.startsWith('image/')) continue
      try {
        added.push(await resizeImage(file))
      } catch {
        setError(t('읽지 못한 사진이 있습니다. 다른 파일로 시도해 주세요.'))
      }
    }
    setPhotos((prev) => [...prev, ...added])
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (sending || (!draft.trim() && !photos.length && !trip)) return
    setSending(true)
    setError(null)
    const saved = await sendMessage(user, conversationId, { body: draft, photos, trip: trip ?? undefined })
    setSending(false)
    if (!saved) {
      setError(t('메시지를 보내지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'))
      return
    }
    setDraft('')
    setPhotos([])
    setTrip(null)
    setData((prev) => (prev && !prev.messages.some((m) => m.id === saved.id) ? { ...prev, messages: [...prev.messages, saved] } : prev))
  }

  async function remove(message: DmMessage) {
    if (!(await askConfirm(t('이 메시지를 삭제할까요? 상대방 화면에서도 지워집니다.')))) return
    if (!(await deleteMessage(user, message))) {
      setError(t('메시지를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'))
      return
    }
    setData((prev) =>
      prev && {
        ...prev,
        messages: prev.messages.map((m) => (m.id === message.id ? { ...m, deleted: true, body: '', photos: [], trip: undefined } : m)),
      },
    )
  }

  async function removeConversation() {
    if (!(await askConfirm(t('대화를 삭제할까요? 나에게서만 지워지고, 상대방의 대화는 그대로 남습니다.')))) return
    if (await hideConversation(user, conversationId)) {
      onRead()
      onBack()
    } else setError(t('대화를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'))
  }

  const other = data?.other
  const shareable = trips.filter((item) => item.days.length > 0)

  return (
    <div className="wizard dm-page dm-chat">
      <header className="dm-chat-head">
        <button type="button" className="btn small" onClick={onBack} aria-label={t('메시지 목록으로')}>
          ←
        </button>
        {other && <UserIcon icon={other.icon} size="medium" />}
        <strong className="dm-chat-name">{other?.nickname ?? ''}</strong>
        <button type="button" className="btn small danger" onClick={removeConversation} disabled={!data}>
          {t('대화 삭제')}
        </button>
      </header>

      <div className="dm-messages">
        {failed && !data && <p className="notice error-notice">{t('대화를 불러오지 못했습니다. 새로고침해 주세요.')}</p>}
        {data && data.messages.length === 0 && (
          <p className="hint dm-empty">{t('{name}님에게 첫 메시지를 보내 보세요.', { name: other?.nickname ?? '' })}</p>
        )}
        <ul>
          {data?.messages.map((m) => {
            const mine = m.senderId === user.id
            return (
              <li key={m.id} className={`dm-msg ${mine ? 'mine' : ''}`}>
                {m.deleted ? (
                  <p className="dm-bubble deleted">{t('삭제된 메시지입니다.')}</p>
                ) : (
                  <>
                    {m.photos.length > 0 && (
                      <div className={`dm-photos n${Math.min(m.photos.length, 4)}`}>
                        {m.photos.map((p, i) =>
                          urls[p] ? (
                            <a key={i} href={urls[p]} target="_blank" rel="noreferrer">
                              <img src={urls[p]} alt={t('보낸 사진')} />
                            </a>
                          ) : (
                            <span key={i} className="dm-photo-loading" />
                          ),
                        )}
                      </div>
                    )}
                    {m.trip && (
                      <TripCard
                        trip={m.trip}
                        onView={() =>
                          m.trip &&
                          onViewTrip(m.trip, mine ? { id: user.id, nickname: user.nickname, icon: user.icon ?? '' } : other!)
                        }
                      />
                    )}
                    {m.body && <p className="dm-bubble">{m.body}</p>}
                  </>
                )}
                <span className="dm-meta">
                  {messageTime(m.createdAt)}
                  {mine && !m.deleted && (
                    <button type="button" className="link-btn dm-delete" onClick={() => remove(m)}>
                      {t('삭제')}
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        <div ref={endRef} />
      </div>

      {error && <p className="notice error-notice">{error}</p>}

      {(photos.length > 0 || trip) && (
        <div className="dm-attachments">
          {photos.map((p, i) => (
            <span key={i} className="dm-attachment photo">
              <img src={p} alt="" />
              <button type="button" aria-label={t('사진 빼기')} onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}>
                ×
              </button>
            </span>
          ))}
          {trip && (
            <span className="dm-attachment trip">
              🗺️ {tripTitle(trip)}
              <button type="button" aria-label={t('일정 빼기')} onClick={() => setTrip(null)}>
                ×
              </button>
            </span>
          )}
        </div>
      )}

      <form className="dm-compose" onSubmit={send}>
        <div className="dm-attach">
          <button
            type="button"
            className="icon-btn dm-attach-btn"
            aria-label={t('사진·일정 보내기')}
            aria-expanded={attachOpen}
            onClick={() => setAttachOpen(!attachOpen)}
          >
            +
          </button>
          {attachOpen && (
            <ul className="tab-menu-list" role="menu">
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAttachOpen(false)
                    fileRef.current?.click()
                  }}
                >
                  📷 {t('사진')}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setAttachOpen(false)
                    setPickingTrip(true)
                  }}
                >
                  🗺️ {t('내 여행 일정')}
                </button>
              </li>
            </ul>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void addPhotos(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
        <input
          className="text-input"
          value={draft}
          maxLength={MAX_DM_LENGTH}
          placeholder={t('메시지 입력…')}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="submit" className="btn primary" disabled={sending || !data || (!draft.trim() && !photos.length && !trip)}>
          {sending ? t('보내는 중…') : t('보내기')}
        </button>
      </form>

      {pickingTrip && (
        <div className="dialog-backdrop" onClick={() => setPickingTrip(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="dm-trip-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="dm-trip-title" className="wizard-title">
              {t('어떤 일정을 보낼까요?')}
            </h2>
            {shareable.length === 0 ? (
              <p className="hint">{t('보낼 수 있는 여행이 없습니다. [일정 만들기]에서 일정을 만들어 저장해 주세요.')}</p>
            ) : (
              <div className="write-trips">
                {shareable.map((item) => {
                  const c = findCountry(item.countryCode)
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="write-trip"
                      onClick={() => {
                        setTrip(structuredClone(item))
                        setPickingTrip(false)
                      }}
                    >
                      <span>
                        <strong>
                          {c?.flag} {tripTitle(item)}
                        </strong>
                        <span className="hint">
                          {' '}
                          · {c?.name ?? item.countryCode} {t('{n}일', { n: item.days.length })}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <div className="wizard-nav">
              <button type="button" className="btn" onClick={() => setPickingTrip(false)}>
                {t('닫기')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** 메시지 안의 여행 일정 카드 */
function TripCard({ trip, onView }: { trip: SavedTrip; onView: () => void }) {
  const country = findCountry(trip.countryCode)
  return (
    <div className="dm-trip">
      <strong>
        {country?.flag} {tripTitle(trip)}
      </strong>
      <span className="hint">
        {country?.name ?? trip.countryCode} · {t('{n}일 일정', { n: trip.days.length })}
      </span>
      <button type="button" className="btn small" onClick={onView}>
        {t('일정 보기')}
      </button>
    </div>
  )
}
