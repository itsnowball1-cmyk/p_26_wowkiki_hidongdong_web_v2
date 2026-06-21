// 단어 사전 + 한글-IPA-MFA 매핑 로더.
//
// 데이터 출처: 참고_client/_Project/data/{words_dic,hangul_ipa_mfa}.txt
//   - words_dic.txt    : word,pron,pumsa(int),fitAge(int)
//   - hangul_ipa_mfa.txt: hangul,ipa,mfa (한글 자모 → IPA → MFA 발음 기호)
//
// 모듈은 첫 호출에 한 번만 파일을 읽고 메모리 인덱스를 구축한다. ESM 의
// import.meta.url 기준으로 ./data/ 경로를 푼다 (dev: server/data, prod:
// dist-server/data — Dockerfile.api 에서 복사).

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// __dirname 대체 (ESM)
const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')

// ── 품사 enum (PumsaMgr.PumsaEnum 와 동일) ──────────────────────────────
export const PUMSA = {
  NOUN: 0, PRONOUN: 1, VERB: 2, ADJECTIVE: 3, ADVERB: 4,
  DETECTIVE_GWAN: 5, INTERJECTION: 6, INVESTIGATION: 7, PARTICLE: 8
} as const

// ── 위치(pos) 라벨 ───────────────────────────────────────────────────────
export type WordPos = '어두초성' | '어중초성' | '어중종성' | '어말종성'

// ── 한글 음절 분해 ───────────────────────────────────────────────────────
const ONSET = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
const CODA  = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']

function decompose(syllable: string): { onset: string; coda: string } | null {
  const code = syllable.codePointAt(0)
  if (code == null || code < 0xAC00 || code > 0xD7A3) return null
  const idx = code - 0xAC00
  const onsetIdx = Math.floor(idx / (21 * 28))
  const codaIdx  = idx % 28
  return { onset: ONSET[onsetIdx] ?? '', coda: CODA[codaIdx] ?? '' }
}

// 단어를 분해해 (joum, pos) 키 목록을 만든다. (예: "달걀" →
// {ㄷ|어두초성, ㄹ|어중종성, ㄱ|어중초성, ㄹ|어말종성})
export function analyzeWord(word: string): Set<string> {
  const result = new Set<string>()
  const syllables = [...word].filter(ch => {
    const code = ch.codePointAt(0) ?? 0
    return code >= 0xAC00 && code <= 0xD7A3
  })
  const n = syllables.length
  syllables.forEach((sy, i) => {
    const d = decompose(sy)
    if (!d) return
    if (d.onset) {
      const pos: WordPos = i === 0 ? '어두초성' : '어중초성'
      result.add(`${d.onset}|${pos}`)
    }
    if (d.coda) {
      const pos: WordPos = i === n - 1 ? '어말종성' : '어중종성'
      result.add(`${d.coda}|${pos}`)
    }
  })
  return result
}

// 단어에 받침이 하나라도 있는지
export function hasJongseong(word: string): boolean {
  for (const ch of word) {
    const d = decompose(ch)
    if (d?.coda) return true
  }
  return false
}

export type DicWord = { word: string; pron: string; pumsa: number; fitAge: number }
export type IpaEntry = { hangul: string; ipa: string; mfa: string }

let cachedWords: DicWord[] | null = null
let cachedIndex: Map<string, DicWord[]> | null = null
let cachedIpa:   IpaEntry[] | null = null

export function loadDictionary(): { words: DicWord[]; index: Map<string, DicWord[]> } {
  if (cachedWords && cachedIndex) return { words: cachedWords, index: cachedIndex }
  const raw = readFileSync(join(DATA_DIR, 'words_dic.txt'), 'utf-8')
  const words: DicWord[] = []
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim(); if (!t) continue
    const parts = t.split(',')
    if (parts.length < 4) continue
    const [word, pron, pumsaS, ageS] = parts
    if (!word) continue
    words.push({
      word: word.trim(),
      pron: (pron ?? word).trim(),
      pumsa: Number(pumsaS) || 0,
      fitAge: Number(ageS) || 0
    })
  }
  // (joum, pos) 별 단어 인덱스
  const idx = new Map<string, DicWord[]>()
  for (const w of words) {
    for (const key of analyzeWord(w.word)) {
      let lst = idx.get(key)
      if (!lst) { lst = []; idx.set(key, lst) }
      lst.push(w)
    }
  }
  cachedWords = words; cachedIndex = idx
  return { words, index: idx }
}

export function loadIpaTable(): IpaEntry[] {
  if (cachedIpa) return cachedIpa
  const raw = readFileSync(join(DATA_DIR, 'hangul_ipa_mfa.txt'), 'utf-8')
  const entries: IpaEntry[] = []
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim(); if (!t) continue
    const [hangul, ipa, mfa] = t.split(',')
    if (!hangul) continue
    entries.push({ hangul: hangul.trim(), ipa: (ipa ?? '').trim(), mfa: (mfa ?? '').trim() })
  }
  cachedIpa = entries
  return entries
}

// ── 단어 추출 ───────────────────────────────────────────────────────────
export type ExtractOpts = {
  aim_joum: string
  pos: WordPos
  min_len?: number
  max_len?: number
  is_cvcword_del_yn?: 'Y' | 'N'   // 받침 있는 단어 제거
  is_only_noun_yn?:  'Y' | 'N'   // 명사/대명사만 (client: NOUN || PRONOUN)
  suit_age?: number               // 단어 적정 나이 (fitAge ≤ suit_age)
  orderby_ewords_yn?: 'Y' | 'N'   // 친숙도 (fitAge 낮은 단어 먼저)
}

export function extractWords(opts: ExtractOpts, limit = 50): DicWord[] {
  const { index } = loadDictionary()
  const key = `${opts.aim_joum}|${opts.pos}`
  const pool = index.get(key) ?? []
  const minL = opts.min_len ?? 1
  const maxL = opts.max_len ?? 99
  const cvcDel = opts.is_cvcword_del_yn === 'Y'
  const nounOnly = opts.is_only_noun_yn === 'Y'

  const filtered = pool.filter(w => {
    const len = [...w.word].length
    if (len < minL || len > maxL) return false
    if (nounOnly && !(w.pumsa === PUMSA.NOUN || w.pumsa === PUMSA.PRONOUN)) return false
    if (cvcDel && hasJongseong(w.word)) return false
    if (opts.suit_age && w.fitAge > opts.suit_age) return false
    return true
  })

  if (opts.orderby_ewords_yn === 'Y') {
    filtered.sort((a, b) => a.fitAge - b.fitAge || [...a.word].length - [...b.word].length)
  }
  // 중복 제거 (같은 단어가 인덱스에 여러 번 들어 있을 수 있는데, 현재 구현은 단어당 1회)
  const seen = new Set<string>()
  const uniq: DicWord[] = []
  for (const w of filtered) {
    if (seen.has(w.word)) continue
    seen.add(w.word); uniq.push(w)
    if (uniq.length >= limit) break
  }
  return uniq
}
