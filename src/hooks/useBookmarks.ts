import { useState } from 'react'
import type { FeedAuthor, FeedPost } from '../data/mockFeed'
import type { SessionUser } from '../lib/auth'
import type { SavedTrip } from '../types'

// 커뮤니티에서 찜한 게시물 — 지금은 이 브라우저(localStorage)에 사용자별로 보관.
// 원본 게시물이 지워져도 볼 수 있게 일정 내용을 같이 저장한다.

export type Bookmark = { postId: string; author: FeedAuthor; trip: SavedTrip; savedAt: string }

const keyOf = (userId: string) => `trip-route-planner:bookmarks:v1:${userId}`

function load(userId: string | undefined): Bookmark[] {
  if (!userId) return []
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(keyOf(userId)) ?? '[]')
    return Array.isArray(parsed) ? (parsed as Bookmark[]) : []
  } catch {
    return []
  }
}

/** 로그인한 사용자의 찜 목록 (최근에 찜한 것이 앞) */
export function useBookmarks(user: SessionUser | null) {
  const userId = user?.id
  const [state, setState] = useState(() => ({ userId, bookmarks: load(userId) }))
  // 로그인·로그아웃으로 사용자가 바뀌면 그 사람 목록으로 다시 읽음
  const current = state.userId === userId ? state : { userId, bookmarks: load(userId) }
  if (current !== state) setState(current)

  function save(next: Bookmark[]) {
    setState({ userId, bookmarks: next })
    if (!userId) return
    try {
      localStorage.setItem(keyOf(userId), JSON.stringify(next))
    } catch {
      // 저장 공간이 없으면 이번 방문 동안만 유지
    }
  }

  const isBookmarked = (postId: string) => current.bookmarks.some((b) => b.postId === postId)

  function toggle(post: FeedPost) {
    if (isBookmarked(post.id)) save(current.bookmarks.filter((b) => b.postId !== post.id))
    else
      save([
        { postId: post.id, author: post.author, trip: post.trip, savedAt: new Date().toISOString() },
        ...current.bookmarks,
      ])
  }

  function remove(postId: string) {
    save(current.bookmarks.filter((b) => b.postId !== postId))
  }

  return { bookmarks: current.bookmarks, isBookmarked, toggle, remove }
}
