import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from '../config'

// 서버(Supabase) 연결. 주소와 anon 키가 설정돼 있을 때만 만든다.
// 없으면 null — 로그인·저장한 여행·커뮤니티는 지금처럼 이 브라우저(localStorage)에만 저장된다.
// 테이블 구조는 supabase/schema.sql, 설정 방법은 docs/SUPABASE_SETUP.md

export const supabase: SupabaseClient | null =
  config.supabaseUrl && config.supabaseAnonKey
    ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null

/** 비밀번호 찾기 전용 연결 — 인증번호를 확인해도 앱의 로그인 상태는 바뀌지 않게 따로 만들고 저장하지 않음 */
export function createRecoveryClient(): SupabaseClient | null {
  return config.supabaseUrl && config.supabaseAnonKey
    ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'planj-recovery' },
      })
    : null
}

/** 서버를 쓰는지 (키가 설정됐는지) */
export const serverEnabled = supabase !== null
