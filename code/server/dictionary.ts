// 단어 사전 + 한글-IPA-MFA 매핑 로더 + 단어 추출 파이프라인.
//
// 알고리즘은 참고_client/_Project/_Script/Data/DataMgr_Joum.cs 의 메서드들
// (FilterAdoptAge, FilterOjoumButTarget, FilterExceptNoun, FilterCVCWord,
// FilterWordLen, OrderByWordLen, OrderByFriendlyWord) 을 그대로 포팅.
// 원칙: [[feedback-client-joum-source-of-truth]]
//
// 데이터 출처: 참고_client/_Project/data/{words_dic,hangul_ipa_mfa}.txt
//   - words_dic.txt    : word,pron,pumsa(int),fitAge(int)
//   - hangul_ipa_mfa.txt: hangul,ipa,mfa
//
// 외부 편집 가능: 운영 환경에서는 호스트의 words_dic.txt 가 컨테이너
// /app/dist-server/data/words_dic.txt 로 마운트됨 (deploy/nas/docker-compose.yml).
// 변경 후 api 컨테이너 재기동하면 새 사전이 로드됨.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

import { getUnusableJoums, type GrowthGrade } from './joum_growth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, 'data')

// ── 품사 enum (PumsaMgr.PumsaEnum) ────────────────────────────────────
export const PUMSA = {
  NOUN: 0, PRONOUN: 1, VERB: 2, ADJECTIVE: 3, ADVERB: 4,
  DETECTIVE_GWAN: 5, INTERJECTION: 6, INVESTIGATION: 7, PARTICLE: 8
} as const

// ── 위치 enum (JoumPosMgr.PosEnum string) ────────────────────────────
export type WordPos = '어두초성' | '어중초성' | '어중종성' | '어말종성'

// ── 한글 음절 분해 ───────────────────────────────────────────────────────
const ONSET = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
const CODA  = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ']
// 19 기본 자음 (겹받침 분리용)
const BASIC_19 = new Set(['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'])
// 겹받침 → 구성 자음들 (JoumGrowthAgeMgr 테이블이 단일 자음 기반이라 분해 필요)
const COMPOUND_CODA: Record<string, string[]> = {
  'ㄳ': ['ㄱ','ㅅ'], 'ㄵ': ['ㄴ','ㅈ'], 'ㄶ': ['ㄴ','ㅎ'],
  'ㄺ': ['ㄹ','ㄱ'], 'ㄻ': ['ㄹ','ㅁ'], 'ㄼ': ['ㄹ','ㅂ'],
  'ㄽ': ['ㄹ','ㅅ'], 'ㄾ': ['ㄹ','ㅌ'], 'ㄿ': ['ㄹ','ㅍ'],
  'ㅀ': ['ㄹ','ㅎ'], 'ㅄ': ['ㅂ','ㅅ']
}
function expandCoda(coda: string): string[] {
  if (!coda) return []
  if (COMPOUND_CODA[coda]) return COMPOUND_CODA[coda]
  return BASIC_19.has(coda) ? [coda] : []
}

type Decomp = { onset: string; coda: string }
function decompose(syllable: string): Decomp | null {
  const code = syllable.codePointAt(0)
  if (code == null || code < 0xAC00 || code > 0xD7A3) return null
  const idx = code - 0xAC00
  const onsetIdx = Math.floor(idx / (21 * 28))
  const codaIdx  = idx % 28
  return { onset: ONSET[onsetIdx] ?? '', coda: CODA[codaIdx] ?? '' }
}

function syllablesOf(word: string): string[] {
  return [...word].filter(ch => {
    const code = ch.codePointAt(0) ?? 0
    return code >= 0xAC00 && code <= 0xD7A3
  })
}

// 단어 → (joum, pos) 키 집합. 예: "달걀" →
// {ㄷ|어두초성, ㄹ|어중종성, ㄱ|어중초성, ㄹ|어말종성}
export function analyzeWord(word: string): Set<string> {
  const result = new Set<string>()
  const syllables = syllablesOf(word)
  const n = syllables.length
  syllables.forEach((sy, i) => {
    const d = decompose(sy); if (!d) return
    if (d.onset) {
      const pos: WordPos = i === 0 ? '어두초성' : '어중초성'
      result.add(`${d.onset}|${pos}`)
    }
    for (const cj of expandCoda(d.coda)) {
      const pos: WordPos = i === n - 1 ? '어말종성' : '어중종성'
      result.add(`${cj}|${pos}`)
    }
  })
  return result
}

// 단어에 등장하는 모든 자음 (위치 무시, 단일 자음으로 분해된 받침 포함)
export function wordJoumSet(word: string): Set<string> {
  const out = new Set<string>()
  for (const sy of syllablesOf(word)) {
    const d = decompose(sy); if (!d) continue
    if (d.onset) out.add(d.onset)
    for (const cj of expandCoda(d.coda)) out.add(cj)
  }
  return out
}

// 단어의 마지막 음절에 받침이 있는지 (FilterCVCWord 의 기준)
export function lastSyllableHasCoda(word: string): boolean {
  const syllables = syllablesOf(word)
  if (syllables.length === 0) return false
  const d = decompose(syllables[syllables.length - 1])
  return !!(d && d.coda)
}

export function syllableCount(word: string): number {
  return syllablesOf(word).length
}

// ── 사전 로딩 ────────────────────────────────────────────────────────────
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
  // (joum, pos) 별 단어 인덱스 — GenerateJoumPosWordList 의 입력
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

// 캐시 무효화 (외부 편집 후 호출 가능 — 추후 admin endpoint 에서)
export function invalidateDictionaryCache(): void {
  cachedWords = null; cachedIndex = null
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

// ── 단어 추출 파이프라인 (DataMgr_Joum.cs:2326-2386 와 동일 순서/조건) ──
export type ExtractOpts = {
  aim_joum: string
  pos: WordPos
  suit_age?: number               // 적정 나이 (FilterAdoptAge: word.fitAge <= suit_age)
  growth_grade?: GrowthGrade      // 연령대 습득 자음 단계 (FilterAdoptAge)
  is_ojoum_del_yn?: 'Y' | 'N'    // FilterOjoumButTarget
  child_ojoum_joums?: string[]   //   해당 아동의 ojoum 자모 (단일 자음). 목표(aim_joum)는 발신측에서 미리 제외해도 무방.
  is_only_noun_yn?: 'Y' | 'N'    // FilterExceptNoun (NOUN || PRONOUN)
  is_cvcword_del_yn?: 'Y' | 'N'  // FilterCVCWord (마지막 음절 종성 있으면 제거)
  min_len?: number; max_len?: number  // FilterWordLen (inclusive)
  orderby_ewords_yn?: 'Y' | 'N'  // OrderByFriendlyWord (asc fitAge)
  // orderby_evowels_yn 는 client 에서 EazyVowelDataTable 사용 — 현재 보류
}

export function extractWords(opts: ExtractOpts, limit = 50): DicWord[] {
  const { index } = loadDictionary()

  // 1) GenerateJoumPosWordList — (joum, pos) 키로 풀 검색
  const key = `${opts.aim_joum}|${opts.pos}`
  const pool0 = index.get(key) ?? []
  // 중복 제거 (단어 자체가 여러 (joum, pos) 키로 들어가도 풀 내에서는 1회)
  let pool: DicWord[] = []
  {
    const seen = new Set<string>()
    for (const w of pool0) {
      if (seen.has(w.word)) continue
      seen.add(w.word); pool.push(w)
    }
  }

  // 2) FilterAdoptAge (suit_age + growth_grade)
  //    - word.fitAge <= suit_age 인 단어만 통과
  //    - 단어가 미성숙(unusable) 자음을 하나라도 포함하면 제거 (단, 목표 자음은 허용)
  const suit_age = opts.suit_age
  if (suit_age != null && suit_age > 0) {
    pool = pool.filter(w => w.fitAge <= suit_age)
    if (opts.growth_grade != null) {
      const unusable = getUnusableJoums(suit_age, opts.growth_grade)
      // 목표 자음은 unusable 에 있어도 단어에 등장 허용 (FilterOjoumButTarget 와 동일 컨셉)
      unusable.delete(opts.aim_joum)
      if (unusable.size > 0) {
        pool = pool.filter(w => {
          for (const j of wordJoumSet(w.word)) if (unusable.has(j)) return false
          return true
        })
      }
    }
  }

  // 3) FilterOjoumButTarget — 아동의 오조음 자모(목표 제외) 포함 단어 제거
  if (opts.is_ojoum_del_yn === 'Y' && opts.child_ojoum_joums && opts.child_ojoum_joums.length > 0) {
    const ojoumSet = new Set(opts.child_ojoum_joums.filter(j => j !== opts.aim_joum))
    if (ojoumSet.size > 0) {
      pool = pool.filter(w => {
        for (const j of wordJoumSet(w.word)) if (ojoumSet.has(j)) return false
        return true
      })
    }
  }

  // 4) FilterExceptNoun — NOUN || PRONOUN 만
  if (opts.is_only_noun_yn === 'Y') {
    pool = pool.filter(w => w.pumsa === PUMSA.NOUN || w.pumsa === PUMSA.PRONOUN)
  }

  // 5) FilterCVCWord — 마지막 음절에 받침 있는 단어 제거
  //    (client 메서드 이름은 "CVC 단어 제거" 지만 코드는 last syllable 의 jong 만 검사)
  if (opts.is_cvcword_del_yn === 'Y') {
    pool = pool.filter(w => !lastSyllableHasCoda(w.word))
  }

  // 6) FilterWordLen (inclusive)
  const minL = opts.min_len ?? 1
  const maxL = opts.max_len ?? 99
  pool = pool.filter(w => {
    const len = syllableCount(w.word)
    return len >= minL && len <= maxL
  })

  // 7) OrderByWordLen — 2음절 우선, 그다음 3음절, 그다음 나머지
  //    client 는 buckets 단위로 prepend 하는 방식이라 결과 순서는 [2-syll..., 3-syll..., others...]
  const bucket2: DicWord[] = []
  const bucket3: DicWord[] = []
  const bucketOther: DicWord[] = []
  for (const w of pool) {
    const len = syllableCount(w.word)
    if (len === 2) bucket2.push(w)
    else if (len === 3) bucket3.push(w)
    else bucketOther.push(w)
  }
  pool = [...bucket2, ...bucket3, ...bucketOther]

  // 8) OrderByFriendlyWord — orderby_ewords_yn='Y' 시 fitAge 오름차순 안정 정렬
  //    (bucket 내부에서만 sort — bucket 간 순서는 유지)
  if (opts.orderby_ewords_yn === 'Y') {
    const sortBucket = (b: DicWord[]) => b.sort((a, c) => a.fitAge - c.fitAge)
    sortBucket(bucket2); sortBucket(bucket3); sortBucket(bucketOther)
    pool = [...bucket2, ...bucket3, ...bucketOther]
  }

  // 9) OrderByEasyMoum — EazyVowelDataTable 기반. client 에서도 데이터 미준비로
  //    보류 (orderby_evowels_yn 옵션은 메타데이터로만 저장).

  return pool.slice(0, limit)
}
