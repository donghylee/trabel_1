import { useEffect, useState } from 'react'
import type { SessionUser } from '../lib/auth'
import { addServerBookmark, fetchServerBookmarks, loadBookmarks, removeServerBookmark, saveBookmarks } from '../lib/bookmarks'
import { serverEnabled } from '../services/supabase'
import type { Bookmark, FeedPost } from '../types'

/** 로그인한 사용자의 찜 목록 (최근에 찜한 것이 앞) — 서버가 있으면 서버, 없으면 이 브라우저 */
export function useBookmarks(user: SessionUser | null) {
  const userId = user?.id
  const [state, setState] = useState(() => ({
    userId,
    bookmarks: serverEnabled ? [] : loadBookmarks(userId),
  }))

  // 로그인·로그아웃으로 사용자가 바뀌면 그 사람 목록으로 다시 읽음
  useEffect(() => {
    if (!serverEnabled) {
      setState({ userId, bookmarks: loadBookmarks(userId) })
      return
    }
    if (!userId) {
      setState({ userId, bookmarks: [] })
      return
    }
    let cancelled = false
    fetchServerBookmarks(userId).then((list) => {
      if (!cancelled) setState({ userId, bookmarks: list ?? [] })
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  const bookmarks = state.userId === userId ? state.bookmarks : []

  // 화면부터 바꾸고 저장 — 서버 저장에 실패하면 되돌림
  function change(next: Bookmark[], save: () => Promise<boolean> | boolean) {
    const prev = bookmarks
    setState({ userId, bookmarks: next })
    Promise.resolve(save()).then((ok) => {
      if (!ok && serverEnabled) setState({ userId, bookmarks: prev })
    })
  }

  const isBookmarked = (postId: string) => bookmarks.some((b) => b.postId === postId)

  function toggle(post: FeedPost) {
    if (!userId) return
    if (isBookmarked(post.id)) {
      remove(post.id)
      return
    }
    const bookmark: Bookmark = { postId: post.id, author: post.author, trip: post.trip, savedAt: new Date().toISOString() }
    const next = [bookmark, ...bookmarks]
    change(next, () => (serverEnabled ? addServerBookmark(userId, bookmark) : saveBookmarks(userId, next)))
  }

  function remove(postId: string) {
    if (!userId) return
    const next = bookmarks.filter((b) => b.postId !== postId)
    change(next, () => (serverEnabled ? removeServerBookmark(userId, postId) : saveBookmarks(userId, next)))
  }

  return { bookmarks, isBookmarked, toggle, remove }
}
