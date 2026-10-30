import { useEffect, useRef, useState, type FormEvent } from 'react'
import { findCountry } from '../data/catalog'
import { mockFeed, type FeedComment, type FeedPost } from '../data/mockFeed'
import type { SessionUser } from '../lib/auth'
import { loadPosts, savePosts, type MyPost } from '../lib/posts'
import { renderTripImage } from '../lib/shareImage'
import type { Country, SavedTrip } from '../types'
import { UserIcon } from './AuthPage'
import ShareDialog from './ShareDialog'
import WriteDialog from './WriteDialog'

type Props = {
  user: SessionUser | null
  /** 글쓰기에서 고를 내 여행 */
  trips: SavedTrip[]
  onRequireLogin: () => void
  onNewPlan: () => void
  isBookmarked: (postId: string) => boolean
  onToggleBookmark: (post: FeedPost) => void
}

/** 여행 일정을 공유하는 피드 — 직접 올린 글(이 브라우저에 저장) + 예시 게시물(mockFeed) */
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
  const [myPosts, setMyPosts] = useState<MyPost[]>(loadPosts)
  const [writing, setWriting] = useState(false)
  const [loginNeeded, setLoginNeeded] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const allPosts: FeedPost[] = [...myPosts, ...mockFeed]
  const countries = [...new Set(allPosts.map((p) => p.trip.countryCode))]
  const posts = filter ? allPosts.filter((p) => p.trip.countryCode === filter) : allPosts

  function changePosts(next: MyPost[]) {
    setMyPosts(next)
    if (!savePosts(next)) setNotice({ ok: false, text: '이 브라우저에 저장하지 못했습니다. 새로고침하면 사라질 수 있습니다.' })
  }

  function publish({
    trip,
    caption,
    tags,
    photos,
  }: {
    trip: SavedTrip
    caption: string
    tags: string[]
    photos: string[]
  }): string | null {
    if (!user) return '로그인 후 사용 가능한 기능입니다.'
    const now = new Date().toISOString()
    const post: MyPost = {
      id: `my-${Date.now().toString(36)}`,
      authorId: user.id,
      author: { nickname: user.nickname, icon: user.icon ?? '' },
      // 올린 뒤 내 여행을 고쳐도 게시물은 그대로 남게 복사본으로
      trip: structuredClone(trip),
      caption,
      tags,
      photos,
      likeCount: 0,
      comments: [],
      postedAt: now,
    }
    const next = [post, ...myPosts]
    // 사진이 커서 브라우저 저장 공간을 넘으면 올리지 않고 글쓰기 창에서 안내
    if (!savePosts(next)) return '저장 공간이 부족합니다. 사진 수를 줄이거나 예전 글을 지운 뒤 다시 올려 주세요.'
    setMyPosts(next)
    setWriting(false)
    setFilter(null)
    setNotice({ ok: true, text: '커뮤니티에 글을 올렸습니다.' })
    return null
  }

  return (
    <div className="feed">
      <div className="feed-head">
        <h2 className="wizard-title">커뮤니티</h2>
        <div className="chips" role="tablist" aria-label="나라별 보기">
          <button type="button" className={`chip ${filter === null ? 'active' : ''}`} onClick={() => setFilter(null)}>
            전체
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
            글쓰기
          </button>
        </div>
      </div>
      {loginNeeded && !user && (
        <p className="notice error-notice">
          로그인 후 사용 가능한 기능입니다.{' '}
          <button type="button" className="link-btn" onClick={onRequireLogin}>
            로그인하기
          </button>
        </p>
      )}
      {notice && <p className={`notice ${notice.ok ? 'success' : 'error-notice'}`}>{notice.text}</p>}
      <p className="notice feed-notice">지금은 예시 게시물과 이 브라우저에서 올린 글만 보입니다. 서버를 연결하면 다른 사람이 올린 여행도 나옵니다.</p>
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
            user && 'authorId' in post && post.authorId === user.id
              ? () => {
                  if (window.confirm('이 글을 삭제할까요?')) {
                    changePosts(myPosts.filter((p) => p.id !== post.id))
                    setNotice({ ok: true, text: '글을 삭제했습니다.' })
                  }
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
  if (minutes < 1) return '방금'
  if (minutes < 60) return `${minutes}분 전`
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`
  if (minutes < 60 * 24 * 7) return `${Math.floor(minutes / 60 / 24)}일 전`
  const d = new Date(iso)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** 일정 요약 이미지 (공유 이미지와 같은 그림) */
function TripImage({ trip, country }: { trip: SavedTrip; country: Country | undefined }) {
  const [url, setUrl] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  // 세로 4:5보다 긴 일정만 접어 두고 [전체 일정 보기]로 펼침
  const [tall, setTall] = useState(false)

  useEffect(() => {
    let made: string | null = null
    let cancelled = false
    renderTripImage(trip, country).then(
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
  }, [trip, country])

  return (
    <div className={`post-image ${url ? '' : 'loading'} ${tall && !expanded ? 'collapsed' : ''}`}>
      {url ? (
        <img
          src={url}
          alt={`${trip.name} 일정`}
          onLoad={(e) => setTall(e.currentTarget.naturalHeight / e.currentTarget.naturalWidth > 5 / 4)}
        />
      ) : (
        <div className="post-image-loading hint">일정 불러오는 중…</div>
      )}
      {tall && (
        <button type="button" className="post-image-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? '접기' : '전체 일정 보기'}
        </button>
      )}
    </div>
  )
}

/** 일정 이미지 + 함께 올린 사진을 옆으로 넘겨 보기 */
function PostMedia({ trip, country, photos }: { trip: SavedTrip; country: Country | undefined; photos: string[] }) {
  const [index, setIndex] = useState(0)
  const touchX = useRef<number | null>(null)
  const count = photos.length + 1
  if (count === 1) return <TripImage trip={trip} country={country} />

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
        <TripImage trip={trip} country={country} />
      ) : (
        <div className="post-photo">
          <img src={photos[index - 1]} alt={`${trip.name} 사진 ${index}`} />
        </div>
      )}
      <span className="post-media-count">
        {index + 1}/{count}
      </span>
      {index > 0 && (
        <button type="button" className="post-media-nav prev" aria-label="이전 사진" onClick={() => go(index - 1)}>
          ‹
        </button>
      )}
      {index < count - 1 && (
        <button type="button" className="post-media-nav next" aria-label="다음 사진" onClick={() => go(index + 1)}>
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
function MoreMenu({ items, label = '더보기', small = false }: { items: MoreItem[]; label?: string; small?: boolean }) {
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

function PostCard({
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
  const [liked, setLiked] = useState(false)
  const [comments, setComments] = useState<FeedComment[]>(post.comments)
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

  /** 로그인한 사람만 할 수 있는 동작 */
  function requireLogin(action: () => void) {
    if (!user) {
      setLoginNeeded(true)
      return
    }
    action()
  }

  function addComment(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    if (!user) {
      setLoginNeeded(true)
      return
    }
    setComments([
      ...comments,
      {
        id: `local-${Date.now()}`,
        authorId: user.id,
        author: { nickname: user.nickname, icon: user.icon ?? '' },
        text,
        postedAt: new Date().toISOString(),
      },
    ])
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
            {country?.name ?? post.trip.countryCode} · {post.trip.days.length}일 일정
          </span>
        </div>
        <span className="hint post-time">{timeAgo(post.postedAt)}</span>
        {/* 글쓴이에게만 보이는 [⋯] 더보기 */}
        {onDelete && (
          <MoreMenu
            items={[
              { label: '삭제', onSelect: onDelete, danger: true },
              { label: '공유', onSelect: () => onShare(post.trip) },
              { label: saved ? '찜 해제' : '찜', onSelect: toggleSave },
            ]}
          />
        )}
      </header>

      <PostMedia trip={post.trip} country={country} photos={post.photos ?? []} />

      <div className="post-actions">
        <button
          type="button"
          className={`icon-btn ${liked ? 'liked' : ''}`}
          aria-label={liked ? '좋아요 취소' : '좋아요'}
          aria-pressed={liked}
          onClick={() => requireLogin(() => setLiked(!liked))}
        >
          {Icon.heart(liked)}
        </button>
        <button type="button" className="icon-btn" aria-label="댓글 달기" onClick={() => commentRef.current?.focus()}>
          {Icon.comment}
        </button>
        <button type="button" className="icon-btn" aria-label="공유" onClick={() => onShare(post.trip)}>
          {Icon.share}
        </button>
        <button
          type="button"
          className="icon-btn post-save"
          aria-label={saved ? '찜 취소' : '찜하기'}
          aria-pressed={saved}
          title={saved ? '찜한 여행에서 빼기' : '마이페이지 찜한 여행에 추가'}
          onClick={toggleSave}
        >
          {Icon.bookmark(saved)}
        </button>
      </div>

      {loginNeeded && !user && (
        <p className="notice error-notice post-login">
          로그인 후 사용 가능한 기능입니다.{' '}
          <button type="button" className="link-btn" onClick={onRequireLogin}>
            로그인하기
          </button>
        </p>
      )}

      {savedNotice && saved && (
        <p className="notice success post-login">🔖 마이페이지 [찜한 여행]에 추가했습니다.</p>
      )}

      <div className="post-body">
        <strong>좋아요 {(post.likeCount + (liked ? 1 : 0)).toLocaleString()}개</strong>
        <p className="post-caption">
          <strong>{post.author.nickname}</strong> <span className="post-trip-name">[{post.trip.name}]</span> {post.caption}
        </p>
        <p className="post-tags">{post.tags.map((t) => `#${t}`).join(' ')}</p>

        {comments.length > 2 && !showAll && (
          <button type="button" className="post-more" onClick={() => setShowAll(true)}>
            댓글 {comments.length}개 모두 보기
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
                {user && c.authorId === user.id && (
                  <MoreMenu
                    small
                    label="댓글 더보기"
                    items={[
                      {
                        label: '삭제',
                        danger: true,
                        onSelect: () => {
                          if (window.confirm('이 댓글을 삭제할까요?')) setComments(comments.filter((x) => x.id !== c.id))
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
          placeholder="댓글 달기…"
          aria-label="댓글 달기"
        />
        <button type="submit" className="link-btn post-comment-submit" disabled={!draft.trim()}>
          게시
        </button>
      </form>
    </article>
  )
}
