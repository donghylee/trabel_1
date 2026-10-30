import { useState, type ReactNode } from 'react'
import { getLang, setCurrentLang, type Lang } from '.'
import { I18nContext } from './context'

export default function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getLang)

  function setLang(next: Lang) {
    setCurrentLang(next)
    setLangState(next)
  }

  return <I18nContext.Provider value={{ lang, setLang }}>{children}</I18nContext.Provider>
}
