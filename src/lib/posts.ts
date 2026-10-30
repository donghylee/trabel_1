import type { FeedPost } from '../data/mockFeed'

// 커뮤니티에 직접 올린 글 — 서버가 생기기 전까지는 이 브라우저(localStorage)에만 보관.
// 서버를 붙이면 loadPosts/savePosts 안쪽만 API 호출로 바꾸면 된다.

const STORAGE_KEY = 'trip-route-planner:posts:v1'

/** 피드에 내 글을 표시하기 위해 작성자 ID를 같이 둠 */
export type MyPost = FeedPost & { authorId: string }

export function loadPosts(): MyPost[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? (parsed as MyPost[]) : []
  } catch {
    return []
  }
}

/** 저장에 성공하면 true */
export function savePosts(posts: MyPost[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts))
    return true
  } catch {
    return false
  }
}

/** "#도쿄 #3박4일, 맛집" → ['도쿄', '3박4일', '맛집'] */
export function parseTags(text: string): string[] {
  return [...new Set(text.split(/[\s,#]+/).map((t) => t.trim()).filter(Boolean))].slice(0, 10)
}
