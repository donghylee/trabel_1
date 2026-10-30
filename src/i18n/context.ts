import { createContext, useContext } from 'react'
import type { Lang } from '.'

export type I18n = { lang: Lang; setLang: (lang: Lang) => void }

export const I18nContext = createContext<I18n>({ lang: 'ko', setLang: () => {} })

/** 언어가 바뀌면 다시 그려지도록 컴포넌트에서 lang을 받아 씀 */
export function useI18n(): I18n {
  return useContext(I18nContext)
}
