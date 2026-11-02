import { supabase } from '../services/supabase'
import type { FeedPost, SavedTrip } from '../types'

// 커뮤니티에 직접 올린 글.
// - 서버(Supabase)를 쓰면 posts 테이블 (fetchServerPosts / insertServerPost / deleteServerPost)
// - 아니면 이 브라우저(localStorage)에만 (loadPosts / savePosts)

const STORAGE_KEY = 'trip-route-planner:posts:v1'
const FEED_LIMIT = 50

type FeedRow = {
  id: string
  author_id: string
  author_nickname: string
  author_icon: string | null
  trip_snapshot: SavedTrip
  caption: string
  tags: string[]
  photos: string[]
  /** 2026-11 추가 (supabase/migrations/003_post_cover.sql) — 그 전 DB에는 없음 */
  cover?: string | null
  like_count: number
  comment_count: number
  created_at: string
}

const toPost = (r: FeedRow): FeedPost => ({
  id: r.id,
  author: { id: r.author_id, nickname: r.author_nickname, icon: r.author_icon ?? '' },
  trip: r.trip_snapshot,
  caption: r.caption,
  tags: r.tags,
  photos: r.photos,
  cover: r.cover ?? undefined,
  // 서버 수에는 내 좋아요도 들어 있음 — 화면(PostCard)에서 내 것을 빼고 다시 더함
  likeCount: r.like_count,
  commentCount: r.comment_count,
  // 댓글은 글마다 따로 받아 옴 (lib/reactions)
  comments: [],
  postedAt: r.created_at,
})

/** 최근 글 (새 글이 앞). authorId를 주면 그 사람 글 전부. 실패하면 null */
export async function fetchServerPosts(authorId?: string): Promise<FeedPost[] | null> {
  if (!supabase) return null
  const query = supabase.from('post_feed').select('*').order('created_at', { ascending: false })
  const { data, error } = await (authorId ? query.eq('author_id', authorId) : query.limit(FEED_LIMIT))
  return error || !data ? null : (data as FeedRow[]).map(toPost)
}

/** 글을 올리고 서버가 정한 id·시각을 붙인 글을 돌려줌. 실패하면 null */
export async function insertServerPost(post: Omit<FeedPost, 'id' | 'postedAt'>, userId: string): Promise<FeedPost | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('posts')
    .insert({
      author_id: userId,
      trip_snapshot: post.trip,
      caption: post.caption,
      tags: post.tags,
      photos: post.photos ?? [],
      // 배경을 고르지 않았으면 열을 아예 보내지 않음 (cover 열을 추가하기 전 DB에서도 글쓰기가 되게)
      ...(post.cover ? { cover: post.cover } : {}),
    })
    .select('id, created_at')
    .single<{ id: string; created_at: string }>()
  return error || !data ? null : { ...post, id: data.id, postedAt: data.created_at }
}

export async function deleteServerPost(postId: string): Promise<boolean> {
  if (!supabase) return false
  const { error } = await supabase.from('posts').delete().eq('id', postId)
  return !error
}

/** 예전 저장 형식: 작성자 ID가 author 밖(authorId)에 있었음 */
type StoredPost = FeedPost & { authorId?: string }

export function loadPosts(): FeedPost[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return (parsed as StoredPost[]).map(({ authorId, ...post }) =>
      authorId && !post.author.id ? { ...post, author: { ...post.author, id: authorId } } : post,
    )
  } catch {
    return []
  }
}

/** 저장에 성공하면 true */
export function savePosts(posts: FeedPost[]): boolean {
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
