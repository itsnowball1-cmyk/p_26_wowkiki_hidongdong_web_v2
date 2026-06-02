import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

type TermItem = {
  idx?: number
  term_type: string
  title: string
  required: boolean
  version: string
  content: string
  change_summary?: string | null
  created_date?: string
}

type HistoryItem = {
  idx: number
  term_type: string
  title: string
  version: string
  change_summary: string | null
  is_active: number
  created_at: string
}

type View = 'list' | 'view' | 'new-version'

type Role = 'child' | 'iadmin' | 'doctor' | 'therapist'

const ROLE_LABELS: Record<Role, string> = {
  child: '아동', iadmin: '기관 관리자', doctor: '의사', therapist: '치료사',
}

function getTermTypes(role: Role) {
  const prefix = role
  return [
    { key: `${prefix}_privacy_use`,    label: '개인정보 수집 및 이용 동의', required: true },
    { key: `${prefix}_sensitive_use`,  label: '민감정보 수집 및 이용 동의', required: true },
    { key: `${prefix}_privacy_third`,  label: '개인정보 제3자 제공 동의서', required: false },
    { key: `${prefix}_sensitive_third`,label: '민감정보 제3자 제공 동의서', required: false },
  ]
}

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }

function nextVersion(current?: string): string {
  if (!current) return 'v1.0'
  const m = current.match(/v(\d+)\.(\d+)/)
  if (!m) return 'v1.0'
  return `v${m[1]}.${Number(m[2]) + 1}`
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']
const KR_DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

function genTimeOptions(): string[] {
  const opts: string[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const period = h < 12 ? 'AM' : 'PM'
      const hour = h % 12 === 0 ? 12 : h % 12
      opts.push(`${period} ${String(hour).padStart(2, '0')}:${m === 0 ? '00' : '30'}`)
    }
  }
  return opts
}
const TIME_OPTIONS = genTimeOptions()

function DatePickerModal({ date, time, onConfirm, onClose }: {
  date: string; time: string
  onConfirm: (date: string, time: string) => void
  onClose: () => void
}) {
  const parseDate = (d: string) => { const [y, mo, day] = d.split('-').map(Number); return new Date(y, mo - 1, day) }
  const [selected, setSelected] = useState(() => parseDate(date))
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())
  const [selTime, setSelTime] = useState(time)
  const [showTimeDropdown, setShowTimeDropdown] = useState(false)

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) } else setViewMonth(m => m - 1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) } else setViewMonth(m => m + 1) }

  const toStr = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  const isSelected = (d: number) => selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d
  const displayDate = `${selected.getFullYear()}년 ${selected.getMonth() + 1}월 ${selected.getDate()}일 ${KR_DAYS[selected.getDay()]}`

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-[16px] w-[480px] p-8 relative" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute top-6 right-6 text-[#9E9E9E] hover:text-[#333]">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 2L16 16M16 2L2 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
        </button>
        <p className="text-[20px] font-bold text-black mb-1">약관 적용시간</p>
        <p className="text-[13px] text-[#727272] mb-6">입력한 시간에 맞춰 커스텀 정보가 앱에 자동 적용됩니다.</p>
        <p className="text-[17px] font-bold text-black text-center mb-4">{displayDate}</p>
        <div className="border border-[#E0E0E0] rounded-[12px] p-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="w-8 h-8 flex items-center justify-center text-[#727272] hover:text-black">
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <span className="text-[15px] font-semibold text-black">{viewYear}년 {viewMonth + 1}월</span>
            <button type="button" onClick={nextMonth} className="w-8 h-8 flex items-center justify-center text-[#727272] hover:text-black">
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1L6 6L1 11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => <span key={d} className="text-center text-[13px] text-[#9E9E9E] font-medium py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((day, i) => (
              <div key={i} className="flex items-center justify-center">
                {day ? (
                  <button type="button" onClick={() => setSelected(new Date(viewYear, viewMonth, day))}
                    className={`w-9 h-9 rounded-full text-[14px] font-medium transition-colors ${isSelected(day) ? 'bg-[#005744] text-white' : 'text-[#333] hover:bg-[#F0F0F0]'}`}>
                    {day}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-center gap-4 mb-6">
          <span className="text-[14px] text-[#333]">적용 시간</span>
          <div className="relative">
            <button type="button" onClick={() => setShowTimeDropdown(p => !p)}
              className="h-[40px] px-4 border border-[#DEDEDE] rounded-[8px] text-[14px] text-[#333] flex items-center gap-2 min-w-[130px] justify-between">
              {selTime}
              <svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1L6 6L11 1" stroke="#727272" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            {showTimeDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-[#DEDEDE] rounded-[8px] shadow-lg z-10 max-h-[200px] overflow-y-auto w-[130px]">
                {TIME_OPTIONS.map(t => (
                  <button key={t} type="button" onClick={() => { setSelTime(t); setShowTimeDropdown(false) }}
                    className={`w-full px-4 py-2 text-left text-[13px] hover:bg-[#F5F5F5] transition-colors ${t === selTime ? 'text-[#005744] font-semibold' : 'text-[#333]'}`}>
                    {t}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button type="button"
            onClick={() => onConfirm(toStr(selected.getFullYear(), selected.getMonth(), selected.getDate()), selTime)}
            className="w-[160px] h-[48px] rounded-[8px] bg-[#005744] text-white text-[15px] font-semibold hover:opacity-90 transition">
            예약
          </button>
          <button type="button" onClick={onClose}
            className="w-[160px] h-[48px] rounded-[8px] border border-[#005744] text-[#005744] text-[15px] font-semibold hover:bg-[#005744] hover:text-white transition">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TermsPage({ role }: { role: Role }) {
  const TERM_TYPES = getTermTypes(role)
  const isChildRole = role === 'child'
  const [view, setView] = useState<View>('list')
  const [selectedType, setSelectedType] = useState<typeof TERM_TYPES[0] | null>(null)
  const [selectedTerm, setSelectedTerm] = useState<TermItem | null>(null)

  const [terms, setTerms] = useState<Record<string, TermItem>>({})
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage, setHistoryPage] = useState(1)
  const [historyFilter, setHistoryFilter] = useState<Set<string>>(new Set())
  const [historySearch, setHistorySearch] = useState('')
  const [historySearchInput, setHistorySearchInput] = useState('')
  const [historyLoading, setHistoryLoading] = useState(false)

  // 새 버전 등록 폼
  const [newVersion, setNewVersion] = useState('')
  const [newSummary, setNewSummary] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newDate, setNewDate] = useState(todayStr())
  const [newTime, setNewTime] = useState('AM 09:00')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [applyToAll, setApplyToAll] = useState(false)
  const [saving, setSaving] = useState(false)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const loadTerms = () => {
    setLoading(true)
    fetch(`/api/admin/terms?role=${role}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then((rows: TermItem[]) => {
        const map: Record<string, TermItem> = {}
        rows.forEach(r => { map[r.term_type] = r })
        setTerms(map)
      })
      .finally(() => setLoading(false))
  }

  const loadHistory = (page = 1, filter = historyFilter, search = historySearch) => {
    setHistoryLoading(true)
    const types = [...filter].join(',')
    const params = new URLSearchParams({ page: String(page), ...(types ? { types } : {}), ...(search ? { search } : {}) })
    fetch(`/api/admin/terms/history?${params}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : { items: [], total: 0 })
      .then(d => { setHistory(d.items ?? []); setHistoryTotal(d.total ?? 0) })
      .finally(() => setHistoryLoading(false))
  }

  useEffect(() => { loadTerms(); loadHistory() }, [])

  const goView = (type: typeof TERM_TYPES[0]) => {
    setSelectedType(type)
    setSelectedTerm(terms[type.key] ?? null)
    setView('view')
  }

  const goNewVersion = (type: typeof TERM_TYPES[0]) => {
    const current = terms[type.key]
    setSelectedType(type)
    setSelectedTerm(current ?? null)
    setNewVersion(nextVersion(current?.version))
    setNewSummary('')
    setNewContent(current?.content ?? '')
    setNewDate(todayStr())
    setApplyToAll(false)
    setView('new-version')
  }

  const backToList = () => { setView('list'); setSelectedType(null); setSelectedTerm(null) }

  const handleSave = async () => {
    if (!selectedType || !newContent.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/terms/new-version', {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({
          term_type: selectedType.key,
          title: selectedType.label,
          required: selectedType.required,
          version: newVersion,
          content: newContent,
          change_summary: newSummary,
          applyToAll,
        })
      })
      if (res.ok) {
        const data = await res.json() as { applied?: number }
        backToList()
        loadTerms()
        loadHistory(1, historyFilter, historySearch)
        showToast(applyToAll
          ? `전체 역할(${data.applied ?? 3}개)에 일괄 적용되었습니다.`
          : '새 버전이 등록되었습니다.')
      }
    } finally { setSaving(false) }
  }

  const totalPages = Math.max(1, Math.ceil(historyTotal / 20))
  const badge = (type: typeof TERM_TYPES[0]) =>
    `[${type.required ? '필수' : '선택'}]`

  // ── 내용보기 페이지 ──────────────────────────────────────────────────────
  if (view === 'view' && selectedType && selectedTerm) {
    return (
      <Layout title="약관 및 동의서 관리">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-[22px] font-bold text-black">
            {selectedType.label} {badge(selectedType)} 내용보기
          </h1>
          <button type="button" onClick={backToList} className="text-[14px] text-[#727272] hover:text-[#333] flex items-center gap-1">
            목록으로 돌아가기
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div className="max-w-[860px] mx-auto">
          <div className="border border-[#DEDEDE] rounded-[8px] overflow-hidden mb-8">
            <Row label="적용일">{selectedTerm.created_date ?? '-'}</Row>
            <Row label="버전">{selectedTerm.version}</Row>
            <Row label="변경내용" last>{selectedTerm.change_summary || '-'}</Row>
          </div>

          <p className="text-[16px] font-bold text-black mb-3">약관 내용</p>
          <div className="border border-[#DEDEDE] rounded-[8px] px-6 py-5 min-h-[360px]">
            <p className="text-[14px] text-[#333] leading-[24px] whitespace-pre-wrap">{selectedTerm.content}</p>
          </div>

          <div className="flex justify-center mt-10">
            <button type="button" onClick={backToList}
              className="w-[160px] h-[48px] rounded-[8px] bg-[#005744] text-white text-[15px] font-semibold hover:opacity-90 transition">
              확인
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  // ── 새 버전 등록 페이지 ──────────────────────────────────────────────────
  if (view === 'new-version' && selectedType) {
    return (
      <Layout title="약관 및 동의서 관리">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-[22px] font-bold text-black">
            {selectedType.label} {badge(selectedType)} 새 버전 등록
          </h1>
          <button type="button" onClick={backToList} className="text-[14px] text-[#727272] hover:text-[#333] flex items-center gap-1">
            목록으로 돌아가기
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>

        <div className="max-w-[860px] mx-auto">
          <div className="border border-[#DEDEDE] rounded-[8px] overflow-hidden mb-8">
            <Row label="적용일">
              <div className="flex items-center gap-3">
                <span>{newDate.replace(/-/g, '.')} {newTime}</span>
                <button type="button" onClick={() => setShowDatePicker(true)}
                  className="h-[32px] px-3 border border-[#005744] text-[#005744] text-[13px] rounded-[5px] hover:bg-[#005744] hover:text-white transition">
                  날짜 변경
                </button>
              </div>
            </Row>
            <Row label="버전">
              <input
                type="text"
                value={newVersion}
                onChange={e => setNewVersion(e.target.value)}
                placeholder="예) v1.0"
                className="w-[200px] h-[36px] px-3 border border-[#B1B1B1] rounded-[5px] text-[14px] outline-none focus:border-[#005744]"
              />
            </Row>
            <Row label="변경내용" last>
              <input
                type="text"
                value={newSummary}
                onChange={e => setNewSummary(e.target.value)}
                placeholder="예) 개인정보 보관 기간 수정"
                className="w-full h-[36px] px-3 border border-[#B1B1B1] rounded-[5px] text-[14px] outline-none focus:border-[#005744]"
              />
            </Row>
          </div>

          <p className="text-[16px] font-bold text-black mb-3">약관 내용</p>
          <div className="border border-[#DEDEDE] rounded-[8px] overflow-hidden">
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="약관 내용을 입력하세요."
              rows={16}
              className="w-full px-6 py-5 text-[14px] text-[#333] leading-[24px] resize-none outline-none placeholder:text-[#B5B5B5]"
            />
          </div>

          {/* 전체 일괄 적용 */}
          <label className="flex items-center gap-3 cursor-pointer bg-[#F5FAF7] border border-[#005744] rounded-[8px] px-5 py-4 mt-4">
            <button
              type="button"
              onClick={() => setApplyToAll(p => !p)}
              className={`w-[20px] h-[20px] rounded-[4px] border flex items-center justify-center transition-colors shrink-0 ${applyToAll ? 'bg-[#005744] border-[#005744]' : 'bg-white border-[#C0C0C0]'}`}
            >
              {applyToAll && (
                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                  <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            <div>
              <p className="text-[14px] font-semibold text-[#005744]">전체 역할 일괄 적용</p>
              <p className="text-[12px] text-[#727272] mt-0.5">기관 관리자·의사·치료사 모두에게 동일한 내용으로 등록됩니다. (아동 제외)</p>
            </div>
          </label>

          <div className="flex justify-center gap-4 mt-8">
            <button type="button" onClick={backToList}
              className="w-[160px] h-[48px] rounded-[8px] border border-[#005744] text-[#005744] text-[15px] font-semibold hover:bg-[#005744] hover:text-white transition">
              취소
            </button>
            <button type="button" onClick={handleSave} disabled={!newContent.trim() || saving}
              className="w-[160px] h-[48px] rounded-[8px] bg-[#005744] text-white text-[15px] font-semibold hover:opacity-90 transition disabled:opacity-50">
              {saving ? '저장 중…' : applyToAll ? '전체 일괄 등록' : '등록'}
            </button>
          </div>
        </div>

        {showDatePicker && (
          <DatePickerModal
            date={newDate}
            time={newTime}
            onConfirm={(d: string, t: string) => { setNewDate(d); setNewTime(t); setShowDatePicker(false) }}
            onClose={() => setShowDatePicker(false)}
          />
        )}
      </Layout>
    )
  }

  // ── 목록 페이지 ──────────────────────────────────────────────────────────
  return (
    <Layout title="약관 및 동의서 관리">
      <h1 className="text-[28px] font-bold text-black mb-8">{ROLE_LABELS[role]} 약관 및 동의서 관리</h1>

      {isChildRole ? (
        <div className="bg-[#F5FAF7] border border-[#005744] rounded-[10px] px-8 py-10 text-center">
          <p className="text-[18px] font-bold text-[#005744] mb-2">아동 약관은 앱에서 관리됩니다.</p>
          <p className="text-[14px] text-[#727272]">아동 회원가입은 모바일 앱을 통해 이루어지며, 약관 관리도 앱과 연동됩니다.</p>
        </div>
      ) : loading ? (
        <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
      ) : (
        <div className="space-y-6">
          {TERM_TYPES.map(type => {
            const term = terms[type.key]
            return (
              <div key={type.key} className="bg-white border border-[#DEDEDE] rounded-[10px] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#DEDEDE]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[16px] font-semibold text-[#202020]">{type.label}</span>
                    <span className={`text-[12px] px-2 py-0.5 rounded-[3px] font-medium ${type.required ? 'bg-[#005744] text-white' : 'bg-[#E0E0E0] text-[#555]'}`}>
                      {type.required ? '필수' : '선택'}
                    </span>
                    {term && <>
                      <span className="text-[13px] text-[#727272]">버전 {term.version}</span>
                      <span className="text-[13px] text-[#727272]">작성일 {term.created_date ?? '-'}</span>
                    </>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {term && (
                      <button type="button" onClick={() => goView(type)}
                        className="h-[36px] px-4 border border-[#ADB5BD] text-[#555] text-[13px] rounded-[5px] hover:bg-[#F5F5F5] transition">
                        내용보기
                      </button>
                    )}
                    <button type="button" onClick={() => goNewVersion(type)}
                      className="h-[36px] px-4 bg-[#005744] text-white text-[13px] rounded-[5px] hover:opacity-90 transition">
                      새 버전 등록
                    </button>
                  </div>
                </div>
                <div className="px-6 py-4">
                  <p className="text-[13px] text-[#585858] leading-[22px] line-clamp-3 whitespace-pre-wrap">
                    {term?.content ?? '등록된 약관이 없습니다. 새 버전 등록 버튼을 눌러 내용을 작성해 주세요.'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 약관 개정이력 */}
      <div className="mt-12">
        <h2 className="text-[20px] font-bold text-black mb-4">약관 개정이력</h2>
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {TERM_TYPES.map(type => (
            <label key={type.key} className="flex items-center gap-2 cursor-pointer">
              <button type="button" onClick={() => {
                setHistoryFilter(prev => {
                  const next = new Set(prev)
                  next.has(type.key) ? next.delete(type.key) : next.add(type.key)
                  loadHistory(1, next, historySearch); setHistoryPage(1)
                  return next
                })
              }} className={`w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-colors ${historyFilter.has(type.key) ? 'bg-[#005744] border-[#005744]' : 'bg-white border-[#C0C0C0]'}`}>
                {historyFilter.has(type.key) && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </button>
              <span className="text-[13px] text-[#333]">{type.label}</span>
            </label>
          ))}
          <div className="ml-auto flex items-center h-[36px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 w-[200px]">
            <input type="text" value={historySearchInput} onChange={e => setHistorySearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setHistorySearch(historySearchInput); setHistoryPage(1); loadHistory(1, historyFilter, historySearchInput) } }}
              placeholder="검색" className="flex-1 text-[13px] outline-none placeholder:text-[#B5B5B5]" />
            <button type="button" onClick={() => { setHistorySearch(historySearchInput); setHistoryPage(1); loadHistory(1, historyFilter, historySearchInput) }}>
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="9" cy="9" r="5.5" stroke="#727272" strokeWidth="1.5"/><path d="M13.5 13.5L17 17" stroke="#727272" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>

        <div className="bg-white border border-[#DEDEDE] rounded-[10px] overflow-hidden">
          <div className="grid grid-cols-[60px_1fr_90px_2fr_150px_80px] px-4 h-[48px] items-center bg-[#EAEAEA] border-b border-[#DEDEDE] text-[14px] font-medium text-[#202020] text-center">
            <span>번호</span><span>약관명</span><span>버전</span><span>변경 내용</span><span>작성일</span><span>상태</span>
          </div>
          {historyLoading ? (
            <div className="py-10 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center text-[14px] text-[#B5B5B5]">이력이 없습니다.</div>
          ) : history.map((h, i) => (
            <div key={h.idx} className={`grid grid-cols-[60px_1fr_90px_2fr_150px_80px] px-4 h-[48px] items-center text-[13px] text-center ${i < history.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}>
              <span className="text-[#585858]">{(historyPage - 1) * 20 + i + 1}</span>
              <span className="text-left text-[#333] truncate pr-2">{h.title}</span>
              <span className="text-[#585858]">{h.version}</span>
              <span className="text-left text-[#585858] truncate pr-2">{h.change_summary ?? '-'}</span>
              <span className="text-[#585858]">{h.created_at}</span>
              <span className={`font-medium ${h.is_active ? 'text-[#005744]' : 'text-[#B5B5B5]'}`}>{h.is_active ? '적용중' : '이전'}</span>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-4">
            <button type="button" onClick={() => { const p = Math.max(1, historyPage - 1); setHistoryPage(p); loadHistory(p, historyFilter, historySearch) }}
              disabled={historyPage === 1} className="w-[27px] h-[27px] flex items-center justify-center disabled:opacity-30">
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M6 1L1 6L6 11" stroke="#777" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
              <button key={p} type="button" onClick={() => { setHistoryPage(p); loadHistory(p, historyFilter, historySearch) }}
                className={`w-[29px] h-[27px] rounded-[5px] text-[14px] font-medium transition-colors ${historyPage === p ? 'bg-[#D9D9D9] text-[#5D5D5D]' : 'text-[#5D5D5D] hover:bg-[#F0F0F0]'}`}>
                {p}
              </button>
            ))}
            <button type="button" onClick={() => { const p = Math.min(totalPages, historyPage + 1); setHistoryPage(p); loadHistory(p, historyFilter, historySearch) }}
              disabled={historyPage >= totalPages} className="w-[27px] h-[27px] flex items-center justify-center disabled:opacity-30">
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1L6 6L1 11" stroke="#777" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#333333] text-white text-[15px] px-6 py-3 rounded-[8px] shadow-lg z-50">
          {toast}
        </div>
      )}
    </Layout>
  )
}

function Row({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`grid grid-cols-[160px_1fr] min-h-[52px] ${last ? '' : 'border-b border-[#DEDEDE]'}`}>
      <div className="bg-[#EAEAEA] px-5 flex items-center text-[14px] font-medium text-black">{label}</div>
      <div className="px-5 flex items-center text-[14px] text-[#333]">{children}</div>
    </div>
  )
}

