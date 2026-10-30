// t('…') / t("…") 로 감싼 한국어 문장 중 src/i18n/en.ts에 영어가 없는 것을 찾는다.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path] : []
  })
}

const unescape = (text) => text.replace(/\\(['"\\])/g, '$1')

const enSource = readFileSync('src/i18n/en.ts', 'utf8')
const keys = new Set([...enSource.matchAll(/^\s*'((?:[^'\\]|\\.)*)':/gm)].map((m) => unescape(m[1])))
const missing = new Map()
for (const file of walk('src')) {
  if (file.includes(join('src', 'i18n'))) continue
  const source = readFileSync(file, 'utf8')
  for (const m of source.matchAll(/\bt\(\s*(['"])((?:(?!\1)[^\\]|\\.)*)\1/g)) {
    const text = unescape(m[2])
    if (/[가-힣]/.test(text) && !keys.has(text)) missing.set(text, file)
  }
}
for (const [text, file] of missing) console.log(`${file}: ${text}`)
console.log(missing.size ? `\n영어가 없는 문장 ${missing.size}개` : '모든 문장에 영어가 있습니다.')
process.exitCode = missing.size ? 1 : 0
