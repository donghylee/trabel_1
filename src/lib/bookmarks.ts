import { supabase } from '../services/supabase'
import type { Bookmark, FeedAuthor, SavedTrip } from '../types'

// 커뮤니티에서 찜한 게시물.
// - 서버(Supabase)를 쓰면 bookmarks 테이블 — 다른 기기에서 로그인해도 보임
// - 아니면 이 브라우저(localStorage)에 사용자별로

const keyOf = (userId: string) => `trip-route-planner:bookmarks:v1:${userId}`

export function loadBookmarks(userId: string | undefined): Bookmark[] {
  if (!userId) return []
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(keyOf(userId)) ?? '[]')
    return Array.isArray(parsed) ? (parsed as Bookmark[]) : []
  } catch {
    return []
  }
}

/** 저장에 성공하면 true */
export function saveBookmarks(userId: string, bookmarks: Bookmark[]): boolean {
  try {
    localStorage.setItem(keyOf(userId), JSON.stringify(bookmarks))
    return true
  } catch {
    return false
  }
}

type BookmarkRow = { post_id: string; author: FeedAuthor; trip_snapshot: SavedTrip; created_at: string }

/** 내 찜 목록 (최근에 찜한 것이 앞). 실패하면 null */
export async function fetchServerBookmarks(userId: string): Promise<Bookmark[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('bookmarks')
    .select('post_id, author, trip_snapshot, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return null
  return (data as BookmarkRow[]).map((r) => ({ postId: r.post_id, author: r.author, trip: r.trip_snapshot, savedAt: r.created_at }))
}

export async function addServerBookmark(userId: string, bookmark: Bookmark): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('bookmarks').upsert({
    post_id: bookmark.postId,
    user_id: userId,
    author: bookmark.author,
    trip_snapshot: bookmark.trip,
    created_at: bookmark.savedAt,
  })
  return !error
}

export async function removeServerBookmark(userId: string, postId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('bookmarks').delete().eq('user_id', userId).eq('post_id', postId)
  return !error
}
