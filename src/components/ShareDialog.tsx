import { useEffect, useState } from 'react'
import { tripTitle } from '../data/catalog'
import { t } from '../i18n'
import { searchUsers, type SessionUser } from '../lib/auth'
import { fetchInbox, openConversation, sendMessage } from '../lib/messages'
import { renderTripImage } from '../lib/shareImage'
import type { Country, DmUser, SavedTrip } from '../types'
import { UserIcon } from './AuthPage'

type Props = {
  trip: SavedTrip
  country: Country | undefined
  onClose: () => void
  /** 넘기면 [메시지로 보내기]를 보여 줌 (null이면 로그인 안내) */
  user?: SessionUser | null
  onRequireLogin?: () => void
}

/** 여행 일정을 다른 사람에게 메시지로 보내거나, 요약 이미지를 저장함 */
export default function ShareDialog({ trip, country, onClose, user, onRequireLogin }: Props) {
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null)
  const [failed, setFailed] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    renderTripImage(trip, country).then(
      (blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setImage({ blob, url })
      },
      () => !cancelled && setFailed(true),
    )
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [trip, country])

  const title = tripTitle(trip)
  const fileName = `${title.replace(/[\\/:*?"<>|]/g, '_')}_${t('일정')}.png`

  function download() {
    if (!image) return
    const a = document.createElement('a')
    a.href = image.url
    a.download = fileName
    a.click()
    setMessage(t('이미지를 저장했습니다.'))
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog share-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="share-dialog-title" className="wizard-title">
          {t('일정 공유')}
        </h2>
        <div className="share-preview">
          {image ? (
            <img src={image.url} alt={t('{name} 일정 요약', { name: title })} />
          ) : failed ? (
            <p className="hint error">{t('이미지를 만들지 못했습니다.')}</p>
          ) : (
            <p className="hint">{t('이미지 만드는 중…')}</p>
          )}
        </div>
        {user !== undefined && <SendAsMessage trip={trip} user={user} onRequireLogin={onRequireLogin} />}
        {message && <p className="hint">{message}</p>}
        <div className="share-actions">
          <button type="button" className="btn" disabled={!image} onClick={download}>
            {t('이미지 저장')}
          </button>
          <button type="button" className="btn share-close" onClick={onClose}>
            {t('닫기')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 받을 사람(최근 대화 상대, 또는 닉네임으로 찾기)을 골라 일정을 메시지로 보냄 */
function SendAsMessage({
  trip,
  user,
  onRequireLogin,
}: {
  trip: SavedTrip
  user: SessionUser | null
  onRequireLogin?: () => void
}) {
  const [recent, setRecent] = useState<DmUser[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<DmUser[]>([])
  const [to, setTo] = useState<DmUser | null>(null)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    fetchInbox(user).then((threads) => {
      if (!cancelled && threads) setRecent(threads.map((th) => th.other))
    })
    return () => {
      cancelled = true
    }
  }, [user])

  // 글자를 멈추고 잠깐 뒤에 찾음 (한 글자마다 서버에 묻지 않게)
  useEffect(() => {
    if (!user || !query.trim()) return
    let cancelled = false
    const timer = setTimeout(() => {
      searchUsers(query, user.id).then((list) => !cancelled && setResults(list))
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [user, query])

  if (!user) {
    return (
      <div className="share-send">
        <h3 className="share-send-title">{t('메시지로 보내기')}</h3>
        <p className="hint">
          {t('로그인하면 다른 사람에게 메시지로 보낼 수 있어요.')}{' '}
          {onRequireLogin && (
            <button type="button" className="link-btn" onClick={onRequireLogin}>
              {t('로그인하기')}
            </button>
          )}
        </p>
      </div>
    )
  }

  async function send() {
    if (!user || !to) return
    setSending(true)
    const conversationId = await openConversation(user, to)
    // 보낸 뒤 원래 여행을 고쳐도 메시지 속 일정은 그대로 남게 복사본으로
    const sent = conversationId && (await sendMessage(user, conversationId, { body: note, photos: [], trip: structuredClone(trip) }))
    setSending(false)
    if (!sent) {
      setStatus({ ok: false, text: t('보내지 못했습니다. 잠시 후 다시 시도해 주세요.') })
      return
    }
    setStatus({ ok: true, text: t('{name}님에게 보냈어요.', { name: to.nickname }) })
    setTo(null)
    setNote('')
  }

  const people = query.trim() ? results : recent
  return (
    <div className="share-send">
      <h3 className="share-send-title">{t('메시지로 보내기')}</h3>
      {to ? (
        <>
          <div className="share-to">
            <UserIcon icon={to.icon} />
            <strong>{to.nickname}</strong>
            <button type="button" className="link-btn" onClick={() => setTo(null)}>
              {t('바꾸기')}
            </button>
          </div>
          <div className="share-compose">
            <input
              className="text-input"
              value={note}
              maxLength={200}
              placeholder={t('함께 보낼 말 (선택)')}
              onChange={(e) => setNote(e.target.value)}
            />
            <button type="button" className="btn primary" disabled={sending} onClick={send}>
              {sending ? t('보내는 중…') : t('보내기')}
            </button>
          </div>
        </>
      ) : (
        <>
          <input
            className="text-input"
            value={query}
            placeholder={t('닉네임으로 찾기')}
            onChange={(e) => {
              setQuery(e.target.value)
              setStatus(null)
            }}
          />
          {!query.trim() && recent.length > 0 && <p className="hint">{t('최근 대화')}</p>}
          {people.length > 0 ? (
            <div className="share-people">
              {people.map((p) => (
                <button key={p.id} type="button" className="share-person" onClick={() => setTo(p)}>
                  <UserIcon icon={p.icon} />
                  <span>{p.nickname}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="hint">
              {query.trim() ? t('찾는 사람이 없습니다.') : t('받을 사람의 닉네임을 입력해 주세요.')}
            </p>
          )}
        </>
      )}
      {status && <p className={`hint ${status.ok ? 'success' : 'error'}`}>{status.text}</p>}
    </div>
  )
}
