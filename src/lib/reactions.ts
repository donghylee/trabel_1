import { supabase } from '../services/supabase'
import type { FeedComment } from '../types'

// 게시물에 누른 좋아요와 단 댓글.
// - 서버(Supabase)에 올라간 글이면 likes·comments 테이블 — 모두에게 보임
// - 예시 게시물이거나 서버가 없으면 이 브라우저(localStorage)에만

const likesKey = (userId: string) => `trip-route-planner:likes:v1:${userId}`
const COMMENTS_KEY = 'trip-route-planner:comments:v1'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** 서버 테이블에 있는 글인지 (예시 게시물·브라우저에만 올린 글은 id가 uuid가 아님) */
export const isServerPost = (postId: string) => !!supabase && UUID.test(postId)

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

function localComments(postId: string): FeedComment[] {
  return read<Record<string, FeedComment[]>>(COMMENTS_KEY, {})[postId] ?? []
}

function saveLocalComments(postId: string, comments: FeedComment[]): boolean {
  const all = read<Record<string, FeedComment[]>>(COMMENTS_KEY, {})
  if (comments.length) all[postId] = comments
  else delete all[postId]
  return write(COMMENTS_KEY, all)
}

type CommentRow = {
  id: string
  text: string
  created_at: string
  author_id: string
  profiles: { nickname: string; icon: string | null } | null
}

/** 내가 좋아요를 눌렀는지 + 사람들이 단 댓글 (오래된 것부터) */
export async function loadReactions(postId: string, userId: string | undefined): Promise<{ liked: boolean; comments: FeedComment[] }> {
  if (!isServerPost(postId) || !supabase) {
    return { liked: !!userId && read<string[]>(likesKey(userId), []).includes(postId), comments: localComments(postId) }
  }
  const [likes, comments] = await Promise.all([
    userId
      ? supabase.from('likes').select('post_id', { count: 'exact', head: true }).eq('post_id', postId).eq('user_id', userId)
      : null,
    supabase
      .from('comments')
      .select('id, text, created_at, author_id, profiles(nickname, icon)')
      .eq('post_id', postId)
      .order('created_at'),
  ])
  return {
    liked: (likes?.count ?? 0) > 0,
    comments: ((comments.data ?? []) as unknown as CommentRow[]).map((r) => ({
      id: r.id,
      author: { id: r.author_id, nickname: r.profiles?.nickname ?? '', icon: r.profiles?.icon ?? '' },
      text: r.text,
      postedAt: r.created_at,
    })),
  }
}

/** 저장에 성공하면 true */
export async function setLiked(userId: string, postId: string, liked: boolean): Promise<boolean> {
  if (isServerPost(postId) && supabase) {
    const { error } = liked
      ? await supabase.from('likes').upsert({ post_id: postId, user_id: userId })
      : await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId)
    return !error
  }
  const others = read<string[]>(likesKey(userId), []).filter((id) => id !== postId)
  return write(likesKey(userId), liked ? [...others, postId] : others)
}

/** 댓글을 달고 저장된 댓글을 돌려줌. 실패하면 null */
export async function addComment(postId: string, comment: Omit<FeedComment, 'id'>): Promise<FeedComment | null> {
  if (isServerPost(postId) && supabase) {
    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, author_id: comment.author.id, text: comment.text })
      .select('id, created_at')
      .single<{ id: string; created_at: string }>()
    return error || !data ? null : { ...comment, id: data.id, postedAt: data.created_at }
  }
  const saved: FeedComment = { ...comment, id: `local-${Date.now()}` }
  return saveLocalComments(postId, [...localComments(postId), saved]) ? saved : null
}

/** 저장에 성공하면 true */
export async function deleteComment(postId: string, commentId: string): Promise<boolean> {
  if (isServerPost(postId) && supabase) {
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    return !error
  }
  return saveLocalComments(
    postId,
    localComments(postId).filter((c) => c.id !== commentId),
  )
}
