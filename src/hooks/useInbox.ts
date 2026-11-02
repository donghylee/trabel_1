import { useCallback, useEffect, useState } from 'react'
import type { SessionUser } from '../lib/auth'
import { fetchInbox, watchMessages } from '../lib/messages'
import type { DmThread } from '../types'

/**
 * 로그인한 사람의 메시지함 (대화 목록 + 안 읽은 수).
 * 새 메시지가 오면 저절로 다시 읽음 — 하단 탭 [메시지]의 숫자 배지에도 씀
 */
export function useInbox(user: SessionUser | null) {
  const [state, setState] = useState<{ userId?: string; threads: DmThread[]; loading: boolean; failed: boolean }>({
    threads: [],
    loading: false,
    failed: false,
  })

  const refresh = useCallback(async () => {
    if (!user) return
    const threads = await fetchInbox(user)
    setState((prev) => ({
      userId: user.id,
      threads: threads ?? (prev.userId === user.id ? prev.threads : []),
      loading: false,
      failed: threads === null,
    }))
  }, [user])

  useEffect(() => {
    if (!user) return
    setState((prev) => (prev.userId === user.id ? prev : { userId: user.id, threads: [], loading: true, failed: false }))
    void refresh()
    return watchMessages(user, () => void refresh())
  }, [user, refresh])

  // 로그아웃했거나 다른 계정으로 바뀐 직후에는 비워서 보여 줌
  const threads = user && state.userId === user.id ? state.threads : []
  const unread = threads.reduce((sum, thread) => sum + thread.unread, 0)
  return { threads, unread, loading: !!user && (state.loading || state.userId !== user.id), failed: state.failed, refresh }
}
