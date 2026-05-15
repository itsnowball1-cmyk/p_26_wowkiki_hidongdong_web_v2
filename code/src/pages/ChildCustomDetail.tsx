import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { api, type CustomDetailDto } from '../lib/api'

type Props = { id: number }

const DEFAULT_WORDS = [
  '고릴라', '금반지', '굼뱅이', '군만두', '고구마맛탕', '곰팡이', '가로', '고모부',
  '거북이', '강아지', '고양이', '구급차', '국자', '귀', '까치', '꽃',
  '김밥', '김치', '꼬리', '고래', '곰', '과자', '구두', '글씨',
  '가위', '가족', '가지', '거미', '건전지'
]

export default function ChildCustomDetail({ id }: Props) {
  const [detail, setDetail] = useState<CustomDetailDto | null>(null)
  const [selectedWords, setSelectedWords] = useState<Set<string>>(new Set(['건전지']))
  const [coreWords, setCoreWords] = useState<string[]>(DEFAULT_WORDS)

  useEffect(() => {
    api.customDetail(id).then(setDetail).catch(() => {})
  }, [id])
  const [newWord, setNewWord] = useState('')
  const [gameCount, setGameCount] = useState(10)
  const [filterOptions, setFilterOptions] = useState<Record<string, boolean>>({
    properAge: true,
    canRead: true,
    wordLength: false,
    removeClosed: true,
    removeNonNoun: false,
    ageAcquired: true,
    removeMispronounced: true
  })

  const toggleWord = (word: string) => {
    setSelectedWords((p) => {
      const next = new Set(p)
      if (next.has(word)) next.delete(word)
      else next.add(word)
      return next
    })
  }

  const removeWord = (word: string) => {
    setCoreWords((p) => p.filter((w) => w !== word))
    setSelectedWords((p) => {
      const next = new Set(p)
      next.delete(word)
      return next
    })
  }

  const addWord = () => {
    const w = newWord.trim()
    if (!w || coreWords.includes(w)) return
    setCoreWords((p) => [...p, w])
    setNewWord('')
  }

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-10 py-6 space-y-6 max-w-[1680px]">
          {/* Header: 아동 정보 + 임시저장함 */}
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold text-ink-900">아동 정보</h2>
            <OutlineButtonSmall onClick={() => alert('임시저장함을 엽니다.')}>임시저장함</OutlineButtonSmall>
          </div>

          {/* Row 1: Info stack (left) + Learning status (right) */}
          <div className="grid grid-cols-1 xl:grid-cols-[315px_1fr] gap-5">
            <div className="space-y-2">
              <InfoCard>
                <CardLabel>아동 식별 코드</CardLabel>
                <CardValue>{detail?.identifier ?? '-'}</CardValue>
              </InfoCard>
              <InfoCard>
                <CardLabel>담당치료사</CardLabel>
                <CardValue>{detail?.therapist_name ?? '-'}</CardValue>
              </InfoCard>
              <InfoCard>
                <CardLabel>치료 방문 일정</CardLabel>
                <div className="flex items-center gap-2">
                  {detail?.schedule && detail.schedule.length > 0 ? (
                    <>
                      <span className="text-[14px] text-ink-900">매주</span>
                      {detail.schedule.map((d) => (
                        <span
                          key={d}
                          className="inline-grid place-items-center w-[23px] h-[20px] rounded-[3px] bg-[#57987E] text-white text-[12px]"
                        >
                          {d}
                        </span>
                      ))}
                    </>
                  ) : (
                    <span className="text-[14px] text-ink-400">-</span>
                  )}
                </div>
              </InfoCard>
            </div>

            <div className="bg-surface-card border border-line rounded-[10px] px-6 py-5 space-y-3 min-h-[137px]">
              <StatusRow label="현재 학습 내용">
                {detail?.current ? (
                  <>
                    <span className="text-[#FF6060] font-medium">{detail.current.sound}</span>
                    {(detail.current.by || detail.current.at) && (
                      <span className="text-ink-500 text-[13px] ml-2">
                        / {[detail.current.by, detail.current.at].filter(Boolean).join(' ')}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-[#AAAAAA]">학습 기록이 없습니다.</span>
                )}
              </StatusRow>
              <StatusRow label="예약된 학습 내용">
                {detail?.reserved && typeof detail.reserved === 'object' && 'sound' in detail.reserved ? (
                  <span className="text-[#FF6060] font-medium">{(detail.reserved as { sound: string }).sound}</span>
                ) : (
                  <span className="text-[#AAAAAA]">예약된 정보가 없습니다.</span>
                )}
              </StatusRow>
            </div>
          </div>

          {/* 진단 리포트 — full width */}
          <section>
            <h3 className="text-[18px] font-semibold text-ink-900 mb-2">진단 리포트</h3>
            <div className="bg-surface-card border border-line rounded-[10px] overflow-hidden relative">
              <div className="absolute top-0 right-0 w-16 h-16 bg-[#57987E]" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }} />
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="bg-line-soft border-b border-line">
                    <th className="h-[37px] px-6 text-left font-medium text-ink-700 w-[33%]">위치</th>
                    <th className="h-[37px] px-6 text-left font-medium text-ink-700 w-[33%]">조음</th>
                    <th className="h-[37px] px-6 text-left font-medium text-ink-700">종류</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail?.diagnosis_rows ?? []).length === 0 && (
                    <tr>
                      <td colSpan={3} className="h-[47px] px-6 text-ink-400 text-[13px]">진단 데이터 없음</td>
                    </tr>
                  )}
                  {(detail?.diagnosis_rows ?? []).map(({ pos, phoneme, type }, i) => (
                    <tr key={i} className="border-b border-line last:border-b-0">
                      <td className="h-[47px] px-6 text-ink-900">{pos}</td>
                      <td className="h-[47px] px-6 text-ink-900">{phoneme}</td>
                      <td className="h-[47px] px-6">
                        <span
                          className={`text-[12px] px-2 py-0.5 rounded font-medium ${
                            type === 'CHANGE' ? 'bg-tag-blue text-ink-700' : 'bg-tag-pink text-ink-700'
                          }`}
                        >
                          {type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 치료 단어 설정 section */}
          <section className="space-y-5">
            <h3 className="text-[18px] font-bold text-ink-900">치료 단어 설정</h3>

            {/* 목표조음정의 + 단어 필터 */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <TargetArticulationPanel />
              <WordFilterPanel options={filterOptions} setOptions={setFilterOptions} />
            </div>

            {/* 단어 추출 button (centered) */}
            <div className="flex justify-center">
              <button
                type="button"
                className="h-11 px-8 rounded-[10px] bg-brand text-white text-[15px] font-medium hover:opacity-90 transition"
              >
                단어 추출
              </button>
            </div>

            {/* 핵심단어 / 훈련단어 헤더 + 게임 훈련 횟수 (우측) */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-6 text-[15px]">
                <span className="font-medium text-ink-900">핵심단어</span>
                <span>
                  <span className="font-medium text-ink-900">훈련단어</span>{' '}
                  <span className="text-brand font-semibold">{coreWords.length}</span>
                </span>
              </div>
              <GameTrainingCount value={gameCount} onChange={setGameCount} />
            </div>

            {/* Word chip grid */}
            <div className="bg-surface-card border border-line rounded-[10px] p-5">
              <div className="flex flex-wrap gap-2">
                {coreWords.map((word) => {
                  const active = selectedWords.has(word)
                  return (
                    <WordChip
                      key={word}
                      word={word}
                      active={active}
                      onToggle={() => toggleWord(word)}
                      onRemove={() => removeWord(word)}
                    />
                  )
                })}
              </div>
            </div>

            {/* Add new word */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addWord()
                }}
                placeholder="리스트에 없는 단어를 직접 추가하세요."
                className="flex-1 h-10 px-4 rounded-full border border-line text-[14px] placeholder:text-ink-300 focus:outline-none focus:border-brand"
              />
              <OutlineButtonSmall onClick={addWord}>추가</OutlineButtonSmall>
            </div>
          </section>

          {/* Bottom actions */}
          <div className="flex justify-end gap-2 pt-6 pb-12">
            <OutlineButtonSmall onClick={() => alert('초기화되었습니다.')}>초기화</OutlineButtonSmall>
            <OutlineButtonSmall onClick={() => alert('임시저장되었습니다.')}>임시저장</OutlineButtonSmall>
            <OutlineButtonSmall onClick={() => alert('예약되었습니다.')}>예약하기</OutlineButtonSmall>
            <button
              type="button"
              onClick={() => alert('적용되었습니다.')}
              className="h-9 px-6 rounded-[5px] bg-brand text-white text-[14px] font-medium hover:opacity-90 transition"
            >
              적용
            </button>
          </div>

        </main>
      </div>
    </div>
  )
}

/* ---------------------------------- */
/* Info card primitives               */
/* ---------------------------------- */
function InfoCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface-card border border-[#ADADAD] rounded-[5px] px-5 py-3 flex items-center gap-4 min-h-[44px]">
      {children}
    </div>
  )
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] font-medium text-ink-700 shrink-0">{children}</span>
}

function CardValue({ children }: { children: React.ReactNode }) {
  return <span className="text-[14px] text-ink-900">{children}</span>
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center text-[14px]">
      <span className="text-ink-700 font-medium">{label}</span>
      <div className="text-ink-900">{children}</div>
    </div>
  )
}

/* ---------------------------------- */
/* 목표조음정의 panel                  */
/* ---------------------------------- */
const POSITION_OPTIONS = ['어두초성', '어중초성', '어중종성', '어말종성']
const CONSONANT_OPTIONS = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const CORE_VOWEL_OPTIONS = ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㅡ', 'ㅣ', 'ㅐ', 'ㅔ']

type SortRule = {
  key: string
  label: string
  enabled: boolean
  priority: number
}

const INITIAL_SORT_RULES: SortRule[] = [
  { key: 'easyVowel', label: '쉬운 모음 결합', enabled: true, priority: 2 },
  { key: 'familiar', label: '친숙한 단어', enabled: true, priority: 1 },
  { key: 'ageMastered', label: '연령대 완전습득자음', enabled: true, priority: 3 }
]

function TargetArticulationPanel() {
  const [position, setPosition] = useState(POSITION_OPTIONS[0])
  const [consonant, setConsonant] = useState(CONSONANT_OPTIONS[0])
  const [coreVowel, setCoreVowel] = useState(CORE_VOWEL_OPTIONS[0])
  const [sortRules, setSortRules] = useState<SortRule[]>(INITIAL_SORT_RULES)

  const toggleEnabled = (key: string) =>
    setSortRules((rules) => rules.map((r) => (r.key === key ? { ...r, enabled: !r.enabled } : r)))

  const setPriority = (key: string, value: number) =>
    setSortRules((rules) =>
      rules.map((r) => (r.key === key ? { ...r, priority: Math.max(1, value) } : r))
    )

  return (
    <div className="bg-surface-card border border-line rounded-[10px] p-6 min-h-[475px]">
      <h3 className="text-[18px] font-extrabold text-ink-900 mb-6">목표조음정의</h3>

      {/* 상단: 3 dropdowns */}
      <div className="space-y-4 mb-8">
        <FieldRow label="목표 위치">
          <Select value={position} onChange={setPosition} options={POSITION_OPTIONS} />
        </FieldRow>
        <FieldRow label="목표 조음">
          <Select value={consonant} onChange={setConsonant} options={CONSONANT_OPTIONS} />
        </FieldRow>
        <FieldRow label="핵심 1음절">
          <Select value={coreVowel} onChange={setCoreVowel} options={CORE_VOWEL_OPTIONS} />
        </FieldRow>
      </div>

      {/* 하단: 정렬순서 테이블 */}
      <div className="border-t border-line pt-5">
        <div className="grid grid-cols-[1fr_90px_90px] gap-3 pb-2 border-b border-line text-[13px] font-medium text-ink-700">
          <span>정렬순서</span>
          <span className="text-center">적용여부</span>
          <span className="text-center">우선순위</span>
        </div>

        <ul className="divide-y divide-line">
          {sortRules.map((rule) => (
            <li key={rule.key} className="grid grid-cols-[1fr_90px_90px] gap-3 py-3 items-center">
              <span className="text-[14px] text-ink-900">{rule.label}</span>
              <div className="flex justify-center">
                <CheckboxBox checked={rule.enabled} onChange={() => toggleEnabled(rule.key)} />
              </div>
              <div className="flex justify-center">
                <input
                  type="number"
                  min={1}
                  value={rule.priority}
                  onChange={(e) => setPriority(rule.key, Number(e.target.value) || 1)}
                  className="w-14 h-8 text-center border border-line rounded-[5px] text-[14px] focus:outline-none focus:border-brand"
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-4 items-center">
      <span className="text-[14px] font-medium text-ink-900">{label}</span>
      <div className="max-w-[280px]">{children}</div>
    </div>
  )
}

function CheckboxBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onChange}
      className={`w-5 h-5 rounded-[3px] border grid place-items-center transition-colors ${
        checked ? 'bg-brand border-brand' : 'bg-white border-[#B2B2B2] hover:border-brand'
      }`}
    >
      {checked && (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="white" strokeWidth="2">
          <path d="M1 5l3.5 3.5L11 1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

/* ---------------------------------- */
/* 단어 필터 panel                     */
/* ---------------------------------- */
const AGE_ACQUIRED_OPTIONS = ['완전습득', '숙달', '관습적', '출현']
const WORD_LENGTH_OPTIONS = ['1', '2', '3', '4', '5']
const AGE_MIN_BOUND = 3
const AGE_MAX_BOUND = 10

type FilterState = {
  ageMin: number
  ageMax: number
  removeMispronounced: boolean
  ageAcquired: string
  removeNonNoun: boolean
  removeClosed: boolean
  lengthMin: string
  lengthMax: string
  canRead: '가능' | '불가'
}

function WordFilterPanel({
  options,
  setOptions
}: {
  options: Record<string, boolean>
  setOptions: (fn: (prev: Record<string, boolean>) => Record<string, boolean>) => void
}) {
  const [filter, setFilter] = useState<FilterState>({
    ageMin: AGE_MIN_BOUND,
    ageMax: AGE_MAX_BOUND,
    removeMispronounced: options.removeMispronounced,
    ageAcquired: AGE_ACQUIRED_OPTIONS[0],
    removeNonNoun: options.removeNonNoun,
    removeClosed: options.removeClosed,
    lengthMin: '1',
    lengthMax: '5',
    canRead: '가능'
  })

  const setField = <K extends keyof FilterState>(k: K, v: FilterState[K]) =>
    setFilter((p) => ({ ...p, [k]: v }))

  const toggleBool = (k: 'removeMispronounced' | 'removeNonNoun' | 'removeClosed') => {
    setFilter((p) => ({ ...p, [k]: !p[k] }))
    setOptions((p) => ({ ...p, [k]: !p[k] }))
  }

  const clampAgeMin = (n: number) => Math.max(AGE_MIN_BOUND, Math.min(filter.ageMax, n))
  const clampAgeMax = (n: number) => Math.max(filter.ageMin, Math.min(AGE_MAX_BOUND, n))

  return (
    <div className="bg-surface-card border border-line rounded-[10px] p-6 min-h-[475px]">
      <h3 className="text-[18px] font-extrabold text-ink-900 mb-5">단어 필터</h3>

      <ul className="divide-y divide-line">
        {/* 1. 단어 적정 나이 — range 3~10 with +/- and input */}
        <FilterRow label="단어 적정 나이">
          <div className="flex items-center gap-2">
            <NumberStepper
              value={filter.ageMin}
              onChange={(n) => setField('ageMin', clampAgeMin(n))}
              min={AGE_MIN_BOUND}
              max={AGE_MAX_BOUND}
            />
            <span className="text-ink-500">~</span>
            <NumberStepper
              value={filter.ageMax}
              onChange={(n) => setField('ageMax', clampAgeMax(n))}
              min={AGE_MIN_BOUND}
              max={AGE_MAX_BOUND}
            />
            <span className="text-[13px] text-ink-500 ml-1">세</span>
          </div>
        </FilterRow>

        {/* 2. 목표 이외 오조음제거 — checkbox */}
        <FilterRow label="목표 이외 오조음제거">
          <CheckboxBox checked={filter.removeMispronounced} onChange={() => toggleBool('removeMispronounced')} />
        </FilterRow>

        {/* 3. 연령대 습득 자음 — dropdown */}
        <FilterRow label="연령대 습득 자음">
          <div className="w-[140px]">
            <Select value={filter.ageAcquired} onChange={(v) => setField('ageAcquired', v)} options={AGE_ACQUIRED_OPTIONS} />
          </div>
        </FilterRow>

        {/* 4. 명사 이외 제거 — checkbox */}
        <FilterRow label="명사 이외 제거">
          <CheckboxBox checked={filter.removeNonNoun} onChange={() => toggleBool('removeNonNoun')} />
        </FilterRow>

        {/* 5. 폐쇄형 단어 제거 — checkbox */}
        <FilterRow label="폐쇄형 단어 제거">
          <CheckboxBox checked={filter.removeClosed} onChange={() => toggleBool('removeClosed')} />
        </FilterRow>

        {/* 6. 단어 길이 — 1~5 dropdown range */}
        <FilterRow label="단어 길이">
          <div className="flex items-center gap-2">
            <div className="w-[64px]">
              <Select
                value={filter.lengthMin}
                onChange={(v) => {
                  const min = Number(v)
                  const max = Math.max(min, Number(filter.lengthMax))
                  setFilter((p) => ({ ...p, lengthMin: v, lengthMax: String(max) }))
                }}
                options={WORD_LENGTH_OPTIONS}
              />
            </div>
            <span className="text-ink-500">~</span>
            <div className="w-[64px]">
              <Select
                value={filter.lengthMax}
                onChange={(v) => {
                  const max = Number(v)
                  const min = Math.min(max, Number(filter.lengthMin))
                  setFilter((p) => ({ ...p, lengthMax: v, lengthMin: String(min) }))
                }}
                options={WORD_LENGTH_OPTIONS}
              />
            </div>
          </div>
        </FilterRow>

        {/* 7. 한글 읽기 가능 — 가능/불가 segmented */}
        <FilterRow label="한글 읽기 가능">
          <Segmented
            value={filter.canRead}
            onChange={(v) => setField('canRead', v)}
            options={['가능', '불가'] as const}
          />
        </FilterRow>
      </ul>
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[1fr_auto] gap-3 py-3 items-center min-h-[50px]">
      <span className="text-[14px] text-ink-900">{label}</span>
      <div className="flex justify-end">{children}</div>
    </li>
  )
}

function NumberStepper({
  value,
  onChange,
  min,
  max
}: {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
}) {
  return (
    <div className="inline-flex items-center border border-line rounded-[5px] overflow-hidden bg-white">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        className="w-7 h-8 grid place-items-center text-ink-700 hover:bg-surface-active disabled:text-ink-300 disabled:hover:bg-transparent"
        aria-label="감소"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value)
          if (Number.isNaN(n)) return
          onChange(Math.max(min, Math.min(max, n)))
        }}
        className="w-10 h-8 text-center text-[14px] focus:outline-none border-x border-line"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        className="w-7 h-8 grid place-items-center text-ink-700 hover:bg-surface-active disabled:text-ink-300 disabled:hover:bg-transparent"
        aria-label="증가"
      >
        +
      </button>
    </div>
  )
}

function Segmented<T extends string>({
  value,
  onChange,
  options
}: {
  value: T
  onChange: (v: T) => void
  options: readonly T[]
}) {
  return (
    <div className="inline-flex bg-line-soft p-0.5 rounded-[5px]">
      {options.map((opt) => {
        const active = opt === value
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`h-7 px-4 rounded-[3px] text-[13px] font-medium transition-colors ${
              active ? 'bg-brand text-white' : 'text-ink-700 hover:text-ink-900'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------- */
/* 게임 훈련 횟수                      */
/* ---------------------------------- */
function GameTrainingCount({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[14px] font-medium text-ink-900">게임 훈련 횟수</span>
      <div className="inline-flex items-center border border-line rounded-[5px] overflow-hidden">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          className="w-8 h-9 grid place-items-center text-ink-700 hover:bg-surface-active"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
          className="w-12 h-9 text-center text-[14px] focus:outline-none border-x border-line"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-8 h-9 grid place-items-center text-ink-700 hover:bg-surface-active"
        >
          +
        </button>
      </div>
      <span className="text-[13px] text-ink-500">회</span>
    </div>
  )
}

/* ---------------------------------- */
/* Word chip                          */
/* ---------------------------------- */
function WordChip({
  word,
  active,
  onToggle,
  onRemove
}: {
  word: string
  active: boolean
  onToggle: () => void
  onRemove: () => void
}) {
  return (
    <div
      className={`group inline-flex items-center gap-1.5 h-9 pl-4 pr-2 rounded-[10px] text-[14px] cursor-pointer transition-colors ${
        active
          ? 'bg-brand text-white ring-2 ring-brand'
          : 'bg-[#57987E] text-white hover:bg-[#4A8770]'
      }`}
      onClick={onToggle}
    >
      <span>{word}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        className="w-5 h-5 grid place-items-center rounded-full text-white hover:bg-white/20"
        aria-label={`${word} 제거`}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M1 1l8 8M9 1L1 9" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

/* ---------------------------------- */
/* Form primitives                    */
/* ---------------------------------- */
function Select({
  value,
  onChange,
  options
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 pl-3 pr-9 appearance-none border border-line rounded-[5px] bg-white text-[14px] focus:outline-none focus:border-brand"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
        <polygon points="0,0 10,0 5,6" />
      </svg>
    </div>
  )
}

function OutlineButtonSmall({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-9 px-4 rounded-[5px] border border-brand text-brand text-[13px] font-medium hover:bg-brand hover:text-white transition-colors"
    >
      {children}
    </button>
  )
}
