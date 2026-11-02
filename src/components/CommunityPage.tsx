import { useEffect, useRef, useState, type FormEvent } from 'react'
import { findCountry, tripTitle } from '../data/catalog'
import { getMockFeed } from '../data/mockFeed'
import { t } from '../i18n'
import type { SessionUser } from '../lib/auth'
import { askConfirm } from '../lib/confirm'
import { usePosts } from '../hooks/usePosts'
import { addComment as saveComment, deleteComment, isServerPost, loadReactions, setLiked as saveLiked } from '../lib/reactions'
import { serverEnabled } from '../services/supabase'
import { renderTripImage } from '../lib/shareImage'
import type { Country, FeedComment, FeedPost, SavedTrip } from '../types'
import { UserIcon } from './AuthPage'
import ShareDialog from './ShareDialog'
import WriteDialog from './WriteDialog'

/** 완료 안내가 떠 있는 시간 */
const NOTICE_MS = 2000

type Props = {
  user: SessionUser | null
  /** 글쓰기에서 고를 내 여행 */
  trips: SavedTrip[]
  onRequireLogin: () => void
  onNewPlan: () => void
  isBookmarked: (postId: string) => boolean
  onToggleBookmark: (post: FeedPost) => void
}

/** 여행 일정을 공유하는 피드 — 사람들이 올린 글(서버, 없으면 이 브라우저). 올라온 글이 하나도 없을 때만 예시 게시물(getMockFeed) */
export default function CommunityPage({
  user,
  trips,
  onRequireLogin,
  onNewPlan,
  isBookmarked,
  onToggleBookmark,
}: Props) {
  const [filter, setFilter] = useState<string | null>(null)
  const [sharing, setSharing] = useState<SavedTrip | null>(null)
  const feed = usePosts(user)
  const [writing, setWriting] = useState(false)
  const [loginNeeded, setLoginNeeded] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  // 완료 안내(글 올림·삭제)는 2초 뒤 저절로 사라짐 — 실패 안내는 읽을 수 있게 그대로 둠
  useEffect(() => {
    if (!notice?.ok) return
    const timer = setTimeout(() => setNotice(null), NOTICE_MS)
    return () => clearTimeout(timer)
  }, [notice])

  // 실제 글이 생기면 예시는 숨김 (불러오는 중에는 예시가 잠깐 보였다 사라지지 않게 비워 둠)
  const showingSamples = !feed.loading && feed.posts.length === 0
  const allPosts: FeedPost[] = showingSamples ? getMockFeed() : feed.posts
  const countries = [...new Set(allPosts.map((p) => p.trip.countryCode))]
  const posts = filter ? allPosts.filter((p) => p.trip.countryCode === filter) : allPosts

  async function publish({
    trip,
    caption,
    tags,
    photos,
    cover,
  }: {
    trip: SavedTrip
    caption: string
    tags: string[]
    photos: string[]
    cover?: string
  }): Promise<string | null> {
    if (!user) return t('로그인 후 사용 가능한 기능입니다.')
    // 올린 뒤 내 여행을 고쳐도 게시물은 그대로 남게 복사본으로
    const saved = await feed.publish({ trip: structuredClone(trip), caption, tags, photos, cover })
    // 실패하면 올리지 않고 글쓰기 창에서 안내
    if (!saved)
      return serverEnabled
        ? t('글을 올리지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.')
        : t('저장 공간이 부족합니다. 사진 수를 줄이거나 예전 글을 지운 뒤 다시 올려 주세요.')
    setWriting(false)
    setFilter(null)
    setNotice({ ok: true, text: t('커뮤니티에 글을 올렸습니다.') })
    return null
  }

  return (
    <div className="feed">
      <div className="feed-head">
        <h2 className="wizard-title">{t('커뮤니티')}</h2>
        <div className="chips" role="tablist" aria-label={t('나라별 보기')}>
          <button type="button" className={`chip ${filter === null ? 'active' : ''}`} onClick={() => setFilter(null)}>
            {t('전체')}
          </button>
          {countries.map((code) => (
            <button
              key={code}
              type="button"
              className={`chip ${filter === code ? 'active' : ''}`}
              onClick={() => setFilter(code)}
            >
              {findCountry(code)?.name ?? code}
            </button>
          ))}
          <button
            type="button"
            className="chip chip-write"
            onClick={() => {
              if (!user) {
                setLoginNeeded(true)
                return
              }
              setNotice(null)
              setWriting(true)
            }}
          >
            {t('글쓰기')}
          </button>
        </div>
      </div>
      {loginNeeded && !user && (
        <p className="notice error-notice">
          {t('로그인 후 사용 가능한 기능입니다.')}{' '}
          <button type="button" className="link-btn" onClick={onRequireLogin}>
            {t('로그인하기')}
          </button>
        </p>
      )}
      {notice && <p className={`notice ${notice.ok ? 'success' : 'error-notice'}`}>{notice.text}</p>}
      {!feed.loading && (
        <p className="notice feed-notice">
          {showingSamples
            ? t('아직 올라온 여행이 없어 예시 게시물을 보여 드려요. [글쓰기]로 첫 여행을 올려 보세요!')
            : serverEnabled
              ? t('PLAN:J 사용자들이 올린 여행입니다.')
              : t('이 브라우저에서 올린 글만 보입니다. 서버를 연결하면 다른 사람이 올린 여행도 나옵니다.')}
        </p>
      )}
      {feed.loading && <p className="hint">{t('글을 불러오는 중…')}</p>}
      {feed.loadFailed && <p className="notice error-notice">{t('글을 불러오지 못했습니다. 새로고침해 주세요.')}</p>}
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          user={user}
          saved={!!user && isBookmarked(post.id)}
          onToggleSave={() => onToggleBookmark(post)}
          onRequireLogin={onRequireLogin}
          onShare={setSharing}
          onDelete={
            user && post.author.id === user.id
              ? async () => {
                  if (!(await askConfirm(t('이 글을 삭제할까요?')))) return
                  feed.remove(post.id).then((ok) =>
                    setNotice(
                      ok
                        ? { ok: true, text: t('글을 삭제했습니다.') }
                        : { ok: false, text: t('글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.') },
                    ),
                  )
                }
              : undefined
          }
        />
      ))}
      {writing && (
        <WriteDialog trips={trips} onCancel={() => setWriting(false)} onSubmit={publish} onNewPlan={onNewPlan} />
      )}
      {sharing && (
        <ShareDialog trip={sharing} country={findCountry(sharing.countryCode)} onClose={() => setSharing(null)} />
      )}
    </div>
  )
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000))
  if (minutes < 1) return t('방금')
  if (minutes < 60) return t('{n}분 전', { n: minutes })
  if (minutes < 60 * 24) return t('{n}시간 전', { n: Math.floor(minutes / 60) })
  if (minutes < 60 * 24 * 7) return t('{n}일 전', { n: Math.floor(minutes / 60 / 24) })
  const d = new Date(iso)
  return t('{month}월 {day}일', { month: d.getMonth() + 1, day: d.getDate() })
}

/** 일정 요약 이미지 (공유 이미지와 같은 그림, cover가 있으면 사진 배경) */
function TripImage({ trip, country, cover }: { trip: SavedTrip; country: Country | undefined; cover?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  // 세로 4:5보다 긴 일정만 접어 두고 [전체 일정 보기]로 펼침
  const [tall, setTall] = useState(false)

  useEffect(() => {
    let made: string | null = null
    let cancelled = false
    renderTripImage(trip, country, cover).then(
      (blob) => {
        if (cancelled) return
        made = URL.createObjectURL(blob)
        setUrl(made)
      },
      () => {},
    )
    return () => {
      cancelled = true
      if (made) URL.revokeObjectURL(made)
    }
  }, [trip, country, cover])

  return (
    <div className={`post-image ${url ? '' : 'loading'} ${tall && !expanded ? 'collapsed' : ''}`}>
      {url ? (
        <img
          src={url}
          alt={t('{name} 일정', { name: tripTitle(trip) })}
          onLoad={(e) => setTall(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth > 5 / 4)}
        />
      ) : (
        <div className="post-image-loading hint">{t('일정 불러오는 중…')}</div>
      )}
      {tall && (
        <button type="button" className="post-image-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? t('접기') : t('전체 일정 보기')}
        </button>
      )}
    </div>
  )
}

/** 일정 이미지 + 함께 올린 사진을 옆으로 넘겨 보기 */
function PostMedia({
  trip,
  country,
  photos,
  cover,
}: {
  trip: SavedTrip
  country: Country | undefined
  photos: string[]
  cover?: string
}) {
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)
  const count = photos.length + 1
  if (count === 1) return <TripImage trip={trip} country={country} cover={cover} />

  const go = (next: number) => setIndex(Math.max(0, Math.min(count - 1, next)))

  return (
    <div
      className="post-media"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
        touchX.current = null
      }}
    >
      {index === 0 ? (
        <TripImage trip={trip} country={country} cover={cover} />
      ) : (
        <div className="post-photo">
          <img src={photos[index - 1]} alt={t('{name} 사진 {n}', { name: tripTitle(trip), n: index })} />
        </div>
      )}
      <span className="post-media-count">
        {index + 1}/{count}
      </span>
      {index > 0 && (
        <button type="button" className="post-media-nav prev" aria-label={t('이전 사진')} onClick={() => go(index - 1)}>
          ‹
        </button>
      )}
      {index < count - 1 && (
        <button type="button" className="post-media-nav next" aria-label={t('다음 사진')} onClick={() => go(index + 1)}>
          ›
        </button>
      )}
      <div className="post-media-dots" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className={i === index ? 'active' : ''} />
        ))}
      </div>
    </div>
  )
}

type MoreItem = { label: string; onSelect: () => void; danger?: boolean }

/** [⋯] 버튼을 누르면 아래로 펼쳐지는 메뉴. 바깥을 누르면 닫힘 */
function MoreMenu({ items, label = t('더보기'), small = false }: { items: MoreItem[]; label?: string; small?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className={`post-more-menu ${small ? 'small' : ''}`}>
      <button
        type="button"
        className="icon-btn post-more-btn"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ⋯
      </button>
      {open && (
        <ul className="tab-menu-list" role="menu">
          {items.map((item) => (
            <li key={item.label}>
              <button
                type="button"
                role="menuitem"
                className={item.danger ? 'danger' : ''}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

const Icon = {
  heart: (filled: boolean) => (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.5 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
        fill={filled ? '#ef4444' : 'none'}
        stroke={filled ? '#ef4444' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  ),
  comment: (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        d="M20.5 11.6a8.4 8.4 0 0 1-12.3 7.5L3.5 20.5l1.4-4.5a8.4 8.4 0 1 1 15.6-4.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  ),
  share: (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      {/* 상자에서 위로 나가는 화살표 — 메시지(DM)로 오해되지 않는 공유 모양 */}
      <path
        d="M12 15V3.5M7.5 8 12 3.5 16.5 8M8 11H5.5v9.5h13V11H16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  bookmark: (filled: boolean) => (
    <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
      <path
        d="M5.5 3.5h13v17.5L12 15.6l-6.5 5.4z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

/** 게시글 한 개 — 커뮤니티 피드와 마이페이지(내가 올린 글)에서 씀 */
export function PostCard({
  post,
  user,
  saved,
  onToggleSave,
  onRequireLogin,
  onShare,
  onDelete,
}: {
  post: FeedPost
  user: SessionUser | null
  /** 마이페이지 [찜한 여행]에 들어가 있는지 */
  saved: boolean
  onToggleSave: () => void
  onRequireLogin: () => void
  onShare: (trip: SavedTrip) => void
  /** 내가 쓴 글일 때만 */
  onDelete?: () => void
}) {
  const country = findCountry(post.trip.countryCode)
  // 좋아요·사람들이 단 댓글 (서버 글이면 서버에서, 예시 게시물이면 이 브라우저에서 — lib/reactions)
  const [liked, setLikedState] = useState(false)
  const [likedAtLoad, setLikedAtLoad] = useState(false)
  const [addedComments, setAddedComments] = useState<FeedComment[]>([])
  const comments = [...post.comments, ...addedComments]
  const userId = user?.id

  useEffect(() => {
    let cancelled = false
    loadReactions(post.id, userId).then((r) => {
      if (cancelled) return
      setLikedState(r.liked)
      setLikedAtLoad(r.liked)
      setAddedComments(r.comments)
    })
    return () => {
      cancelled = true
    }
  }, [post.id, userId])

  // 서버 글의 좋아요 수에는 처음부터 내 좋아요가 들어 있으니 빼고, 지금 상태로 다시 더함
  const othersLikes = post.likeCount - (isServerPost(post.id) && likedAtLoad ? 1 : 0)
  const [showAll, setShowAll] = useState(false)
  const [draft, setDraft] = useState('')
  const [loginNeeded, setLoginNeeded] = useState(false)
  // 방금 찜했으면 "찜한 여행에 추가" 안내
  const [savedNotice, setSavedNotice] = useState(false)
  const commentRef = useRef<HTMLInputElement>(null)
  /** 아이콘 줄의 🔖와 같은 동작 */
  function toggleSave() {
    requireLogin(() => {
      setSavedNotice(!saved)
      onToggleSave()
    })
  }

  function toggleLike() {
    if (!user) return
    const next = !liked
    setLikedState(next)
    // 저장에 실패하면 되돌림
    saveLiked(user.id, post.id, next).then((ok) => !ok && setLikedState(!next))
  }

  function removeComment(commentId: string) {
    deleteComment(post.id, commentId).then(
      (ok) => ok && setAddedComments((prev) => prev.filter((c) => c.id !== commentId)),
    )
  }

  /** 로그인한 사람만 할 수 있는 동작 */
  function requireLogin(action: () => void) {
    if (!user) {
      setLoginNeeded(true)
      return
    }
    action()
  }

  async function addComment(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    if (!user) {
      setLoginNeeded(true)
      return
    }
    const saved = await saveComment(post.id, {
      author: { id: user.id, nickname: user.nickname, icon: user.icon ?? '' },
      text,
      postedAt: new Date().toISOString(),
    })
    if (!saved) return
    setAddedComments((prev) => [...prev, saved])
    setDraft('')
    setShowAll(true)
  }

  const visibleComments = showAll ? comments : comments.slice(-2)

  return (
    <article className="post">
      <header className="post-head">
        <UserIcon icon={post.author.icon} size="medium" />
        <div className="post-author">
          <strong>{post.author.nickname}</strong>
          <span className="hint">
            {country?.name ?? post.trip.countryCode} · {t('{n}일 일정', { n: post.trip.days.length })}
          </span>
        </div>
        <span className="hint post-time">{timeAgo(post.postedAt)}</span>
        {/* 글쓴이에게만 보이는 [⋯] 더보기 */}
        {onDelete && (
          <MoreMenu
            items={[
              { label: t('삭제'), onSelect: onDelete, danger: true },
              { label: t('공유'), onSelect: () => onShare(post.trip) },
              { label: saved ? t('찜 해제') : t('찜'), onSelect: toggleSave },
            ]}
          />
        )}
      </header>

      <PostMedia trip={post.trip} country={country} photos={post.photos ?? []} cover={post.cover} />

      <div className="post-actions">
        <button
          type="button"
          className={`icon-btn ${liked ? 'liked' : ''}`}
          aria-label={liked ? t('좋아요 취소') : t('좋아요')}
          aria-pressed={liked}
          onClick={() => requireLogin(toggleLike)}
        >
          {Icon.heart(liked)}
        </button>
        <button type="button" className="icon-btn" aria-label={t('댓글 달기')} onClick={() => commentRef.current?.focus()}>
          {Icon.comment}
        </button>
        <button type="button" className="icon-btn" aria-label={t('공유')} onClick={() => onShare(post.trip)}>
          {Icon.share}
        </button>
        <button
          type="button"
          className="icon-btn post-save"
          aria-label={saved ? t('찜 취소') : t('찜하기')}
          aria-pressed={saved}
          title={saved ? t('찜한 여행에서 빼기') : t('마이페이지 찜한 여행에 추가')}
          onClick={toggleSave}
        >
          {Icon.bookmark(saved)}
        </button>
      </div>

      {loginNeeded && !user && (
        <p className="notice error-notice post-login">
          {t('로그인 후 사용 가능한 기능입니다.')}{' '}
          <button type="button" className="link-btn" onClick={onRequireLogin}>
            {t('로그인하기')}
          </button>
        </p>
      )}

      {savedNotice && saved && (
        <p className="notice success post-login">{t('🔖 마이페이지 [찜한 여행]에 추가했습니다.')}</p>
      )}

      <div className="post-body">
        <strong>{t('좋아요 {n}개', { n: (othersLikes + (liked ? 1 : 0)).toLocaleString() })}</strong>
        <p className="post-caption">
          <strong>{post.author.nickname}</strong> <span className="post-trip-name">[{tripTitle(post.trip)}]</span> {post.caption}
        </p>
        <p className="post-tags">{post.tags.map((tag) => `#${tag}`).join(' ')}</p>

        {comments.length > 2 && !showAll && (
          <button type="button" className="post-more" onClick={() => setShowAll(true)}>
            {t('댓글 {n}개 모두 보기', { n: comments.length })}
          </button>
        )}
        {visibleComments.length > 0 && (
          <ul className="post-comments">
            {visibleComments.map((c) => (
              <li key={c.id} className="post-comment">
                <span>
                  <strong>{c.author.nickname}</strong> {c.text} <span className="hint">{timeAgo(c.postedAt)}</span>
                </span>
                {/* 내가 쓴 댓글에만 [⋯] → 삭제 */}
                {user && c.author.id === user.id && (
                  <MoreMenu
                    small
                    label={t('댓글 더보기')}
                    items={[
                      {
                        label: t('삭제'),
                        danger: true,
                        onSelect: async () => {
                          if (await askConfirm(t('이 댓글을 삭제할까요?'))) removeComment(c.id)
                        },
                      },
                    ]}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form className="post-comment-form" onSubmit={addComment}>
        <input
          ref={commentRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('댓글 달기…')}
          aria-label={t('댓글 달기')}
        />
        <button type="submit" className="link-btn post-comment-submit" disabled={!draft.trim()}>
          {t('게시')}
        </button>
      </form>
    </article>
  )
}
