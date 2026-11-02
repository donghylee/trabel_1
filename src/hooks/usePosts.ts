import { useEffect, useState } from 'react'
import type { SessionUser } from '../lib/auth'
import { deletePhotos, uploadPhotos } from '../lib/photos'
import { deleteServerPost, fetchServerPosts, insertServerPost, loadPosts, savePosts } from '../lib/posts'
import { serverEnabled } from '../services/supabase'
import type { FeedPost } from '../types'

type NewPost = Omit<FeedPost, 'id' | 'postedAt' | 'author' | 'likeCount' | 'comments'>

/**
 * 커뮤니티에 사람들이 올린 글 (예시 게시물은 빼고).
 * 서버가 있으면 모두의 글을 받아 오고, 없으면 이 브라우저에서 올린 글만.
 * publish·remove는 실패하면 안내 문구를 돌려줌 (성공이면 null).
 * mine이면 로그인한 사람이 올린 글만 (마이페이지).
 */
export function usePosts(user: SessionUser | null, mine = false) {
  const authorId = mine ? (user?.id ?? null) : undefined
  const [posts, setPosts] = useState<FeedPost[]>(() =>
    serverEnabled ? [] : loadPosts().filter((p) => authorId === undefined || p.author.id === authorId),
  )
  const [loading, setLoading] = useState(serverEnabled)
  const [loadFailed, setLoadFailed] = useState(false)

  useEffect(() => {
    if (!serverEnabled) return
    let cancelled = false
    // 내 글만 보는데 로그인하지 않았으면 받아 올 것이 없음
    if (authorId === null) {
      setPosts([])
      setLoading(false)
      return
    }
    fetchServerPosts(authorId).then((list) => {
      if (cancelled) return
      setPosts(list ?? [])
      setLoadFailed(list === null)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [authorId])

  async function publish(input: NewPost): Promise<FeedPost | null> {
    if (!user) return null
    const post = {
      ...input,
      author: { id: user.id, nickname: user.nickname, icon: user.icon ?? '' },
      likeCount: 0,
      comments: [],
    }
    if (serverEnabled) {
      // 사진은 먼저 저장소(Storage)에 올리고, 글에는 주소만 넣음
      // 일정 이미지 배경도 직접 올린 사진이면 함께 올림 (나라 사진은 앱 안 주소 그대로)
      const uploaded = await uploadPhotos('post-photos', user.id, [...(post.photos ?? []), ...(post.cover ? [post.cover] : [])])
      if (!uploaded) return null
      const photos = post.cover ? uploaded.slice(0, -1) : uploaded
      const cover = post.cover ? uploaded[uploaded.length - 1] : undefined
      const saved = await insertServerPost({ ...post, photos, cover }, user.id)
      if (saved) setPosts((prev) => [saved, ...prev])
      // 글 저장에 실패하면 올려 둔 사진도 지움
      else void deletePhotos('post-photos', uploaded)
      return saved
    }
    const saved: FeedPost = { ...post, id: `my-${Date.now().toString(36)}`, postedAt: new Date().toISOString() }
    const next = [saved, ...posts]
    // 사진이 커서 브라우저 저장 공간을 넘으면 올리지 않음
    if (!savePosts(next)) return null
    setPosts(next)
    return saved
  }

  async function remove(postId: string): Promise<boolean> {
    const next = posts.filter((p) => p.id !== postId)
    // 로컬에서는 내 글만 들고 있을 수 있으니 저장할 때는 전체 목록에서 뺌
    const ok = serverEnabled ? await deleteServerPost(postId) : savePosts(loadPosts().filter((p) => p.id !== postId))
    if (!ok) return false
    // 글에 붙였던 사진도 저장소에서 지움
    const removed = posts.find((p) => p.id === postId)
    if (serverEnabled) void deletePhotos('post-photos', [...(removed?.photos ?? []), ...(removed?.cover ? [removed.cover] : [])])
    setPosts(next)
    return true
  }

  return { posts, loading, loadFailed, publish, remove }
}
