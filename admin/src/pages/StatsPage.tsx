import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import StatsInstitutionDetail from './StatsInstitutionDetail'

type StatGroup = { mau: number; wau: number; dau: number }
type InstRow = { idx: number; instt_code: string; instt_name: string; instt_type: string; regist_date: string }
type StatsData = { web: StatGroup; app: StatGroup; institutions: InstRow[] }
type HistoryRow = { period: string; count: number; change: number }
type MetricType = 'mau' | 'wau' | 'dau'
type DataType = 'web' | 'app'

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }

const PERIOD_OPTIONS = [
  { label: '오늘',   days: 1 },
  { label: '1주일',  days: 7 },
  { label: '1개월',  days: 30 },
  { label: '3개월',  days: 90 },
  { label: '6개월',  days: 180 },
  { label: '12개월', days: 365 },
]

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }
function addDays(d: Date, n: number) { const r = new Date(d); r.setDate(r.getDate() + n); return r }
function fmtDate(s: string) { return s.replace(/-/g, '.') }

export default function StatsPage() {
  // 목록 뷰 상태
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // 기관 상세 뷰 상태
  const [instDetail, setInstDetail] = useState<{ instt_code: string; instt_name: string } | null>(null)

  // DAU/MAU/WAU 상세 뷰 상태
  const [detail, setDetail] = useState<{ type: DataType; metric: MetricType } | null>(null)
  const [metric, setMetric] = useState<MetricType>('dau')
  const [periodIdx, setPeriodIdx] = useState(3) // 3개월 기본 선택
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    fetch('/api/admin/stats-detail', { headers: HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d as StatsData) })
      .finally(() => setLoading(false))
  }, [])

  // 상세 뷰 데이터 조회
  const fetchHistory = (type: DataType, m: MetricType, fromDate: string, toDate: string) => {
    setHistoryLoading(true)
    fetch(`/api/admin/stats-history?type=${type}&metric=${m}&from=${fromDate}&to=${toDate}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then(d => setHistory(d as HistoryRow[]))
      .finally(() => setHistoryLoading(false))
  }

  const openDetail = (type: DataType, m: MetricType) => {
    const to = toDateStr(new Date())
    const from = toDateStr(addDays(new Date(), -PERIOD_OPTIONS[3].days))
    setDetail({ type, metric: m })
    setMetric(m)
    setPeriodIdx(3)
    setCustomFrom(from)
    setCustomTo(to)
    fetchHistory(type, m, from, to)
  }

  const handlePeriodSelect = (idx: number) => {
    if (!detail) return
    const to = toDateStr(new Date())
    const from = toDateStr(addDays(new Date(), -PERIOD_OPTIONS[idx].days))
    setPeriodIdx(idx)
    setCustomFrom(from)
    setCustomTo(to)
    fetchHistory(detail.type, metric, from, to)
  }

  const handleSearch = () => {
    if (!detail || !customFrom || !customTo) return
    fetchHistory(detail.type, metric, customFrom, customTo)
  }

  const handleMetricChange = (m: MetricType) => {
    if (!detail) return
    setMetric(m)
    fetchHistory(detail.type, m, customFrom, customTo)
  }

  // 기관리스트
  const institutions = data?.institutions ?? []
  const filtered = institutions.filter(r =>
    !search || r.instt_name.includes(search) || r.instt_code.includes(search)
  )
  const allChecked = filtered.length > 0 && filtered.every(r => selected.has(r.idx))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(filtered.map(r => r.idx)))
  const toggleOne = (idx: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n })
  }

  const metricLabel = (m: MetricType) => m === 'dau' ? 'DAU' : m === 'wau' ? 'WAU' : 'MAU'

  // ── 상세 뷰 ──
  if (detail) {
    return (
      <Layout title="통계/로그">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[18px] font-medium text-[#000000]">
            {detail.type === 'web' ? '웹' : '앱'} DAU/MAU/WAU
          </h2>
          <button
            type="button"
            onClick={() => setDetail(null)}
            className="text-[12px] text-[#000000] hover:text-[#005744] transition"
          >
            이전으로 돌아가기&gt;
          </button>
        </div>

        {/* 조회 조건 */}
        <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-6">
          {/* 조회 조건 행 */}
          <div className="flex items-center border-b border-[#DEDEDE]">
            <div className="w-[302px] h-[40px] bg-[#EAEAEA] flex items-center px-6 flex-shrink-0">
              <span className="text-[15px] font-medium text-[#000000]">조회 조건</span>
            </div>
            <div className="flex-1 h-[40px] bg-white flex items-center px-6 gap-8">
              {(['mau', 'wau', 'dau'] as MetricType[]).map(m => (
                <label key={m} className="flex items-center gap-2 cursor-pointer" onClick={() => handleMetricChange(m)}>
                  <span className={`w-[14px] h-[14px] rounded-full border-2 flex-shrink-0 ${metric === m ? 'border-[#005744] bg-[#005744]' : 'border-[#A7A7A7] bg-white'}`} />
                  <span className="text-[12px] font-medium text-[#000000]">{metricLabel(m)}</span>
                </label>
              ))}
            </div>
          </div>
          {/* 조회기간 행 */}
          <div className="flex items-start">
            <div className="w-[302px] min-h-[95px] bg-[#EAEAEA] flex items-center px-6 flex-shrink-0">
              <span className="text-[15px] font-medium text-[#000000]">조회기간</span>
            </div>
            <div className="flex-1 bg-white px-6 py-4 flex flex-col gap-3">
              {/* 빠른 선택 버튼 */}
              <div className="flex gap-2 flex-wrap">
                {PERIOD_OPTIONS.map((opt, i) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => handlePeriodSelect(i)}
                    className={`w-[100px] h-[32px] rounded-[5px] text-[14px] font-medium transition ${
                      periodIdx === i
                        ? 'bg-[#005744] text-white border-none'
                        : 'bg-white border border-[#A7A7A7] text-[#000000] hover:border-[#005744]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {/* 날짜 직접 입력 */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="w-[140px] h-[32px] px-3 border border-[#A7A7A7] rounded-[5px] text-[12px] outline-none focus:border-[#005744]"
                />
                <span className="text-[14px] text-[#000000]">~</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="w-[140px] h-[32px] px-3 border border-[#A7A7A7] rounded-[5px] text-[12px] outline-none focus:border-[#005744]"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  className="w-[100px] h-[32px] rounded-[5px] border border-[#005744] text-[#005744] text-[14px] font-medium hover:bg-[#005744] hover:text-white transition"
                >
                  조회
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-[10px] border border-[#DEDEDE] overflow-hidden">
          <div className="grid grid-cols-[60px_1fr_160px_200px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#484848]">
            <span>행</span>
            <span>날짜</span>
            <span>{metricLabel(metric)}</span>
            <span>증감 수치 / 증감률</span>
          </div>
          {historyLoading ? (
            <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-[14px] text-[#B5B5B5]">데이터가 없습니다.</div>
          ) : history.map((r, i) => (
            <div
              key={i}
              className={`grid grid-cols-[60px_1fr_160px_200px] px-6 h-[36px] items-center text-[15px] ${
                i < history.length - 1 ? 'border-b border-[#DEDEDE]' : ''
              }`}
            >
              <span className="text-[#585858]">{i + 1}</span>
              <span className="text-[#585858]">{fmtDate(r.period)}</span>
              <span className="text-[#585858]">{r.count.toLocaleString()}</span>
              <span className={r.change > 0 ? 'text-[#FF5151]' : r.change < 0 ? 'text-[#4656AA]' : 'text-[#585858]'}>
                {r.change > 0 ? `+${r.change}` : r.change === 0 ? '0' : `${r.change}`}
              </span>
            </div>
          ))}
        </div>
      </Layout>
    )
  }

  // ── 기관 상세 뷰 ──
  if (instDetail) {
    return (
      <Layout title="통계/로그">
        <StatsInstitutionDetail
          instt_code={instDetail.instt_code}
          instt_name={instDetail.instt_name}
          onBack={() => setInstDetail(null)}
        />
      </Layout>
    )
  }

  // ── 기본 통계 뷰 ──
  return (
    <Layout title="통계/로그">
      {/* KPI 카드 2세트 */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {(['web', 'app'] as DataType[]).map(type => (
          <div key={type}>
            <h2 className="text-[18px] font-medium text-[#000000] mb-3">
              {type === 'web' ? '웹' : '앱'} DAU/MAU/WAU
            </h2>
            <div className="bg-[#EAEAEA] rounded-[5px] p-4 flex gap-4">
              {(['mau', 'wau', 'dau'] as MetricType[]).map(m => {
                const val = data?.[type]?.[m] ?? 0
                const badgeColor = m === 'dau' ? '#D5DCFF' : '#FFE2E2'
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => openDetail(type, m)}
                    className="flex-1 bg-white rounded-[5px] px-4 py-3 flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-shadow text-left"
                    style={{ height: 80 }}
                  >
                    <div className="absolute inset-0 opacity-10" style={{
                      background: type === 'web'
                        ? 'linear-gradient(135deg, #005744 0%, transparent 60%)'
                        : 'linear-gradient(135deg, #4656AA 0%, transparent 60%)'
                    }} />
                    <div className="relative flex items-start justify-between">
                      <span className="text-[10px] font-medium text-[#000000]">
                        {m === 'mau' ? 'MAU(월간)' : m === 'wau' ? 'WAU(주간)' : 'DAU(일간)'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-[4px]" style={{ backgroundColor: badgeColor }}>
                        {type === 'web' ? '웹' : '앱'}
                      </span>
                    </div>
                    <div className="relative flex items-baseline gap-1">
                      <span className="text-[20px] font-semibold text-[#000000]">
                        {loading ? '—' : val.toLocaleString()}
                      </span>
                      <span className="text-[12px] text-[#000000]">명</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 기관리스트 */}
      <div className="bg-white rounded-[10px] border border-[#DEDEDE] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#DEDEDE]">
          <p className="text-[18px]">
            <span className="font-semibold text-[#919191]">기관리스트</span>
            <span className="font-semibold text-[#005744] ml-2">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center h-[40px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 text-[14px] text-[#727272] cursor-pointer select-none w-[100px]">
              <span className="flex-1">전체</span>
              <svg width="12" height="7" viewBox="0 0 12 7" fill="none">
                <path d="M1 1L6 6L11 1" stroke="#727272" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="flex items-center h-[40px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 w-[220px] overflow-hidden">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="검색"
                className="flex-1 min-w-0 text-[14px] outline-none placeholder:text-[#B5B5B5]"
              />
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="4" width="14" height="13" rx="1.5" stroke="#ADB5BD" strokeWidth="1.5"/>
                <path d="M7 2v4M13 2v4M3 8h14" stroke="#ADB5BD" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-[40px_60px_1fr_120px_180px_140px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#484848] text-center">
          <span className="flex items-center justify-center">
            <CheckboxBtn checked={allChecked} onChange={toggleAll} />
          </span>
          <span>순번</span>
          <span>기관명</span>
          <span>기관종류</span>
          <span>기관 식별코드</span>
          <span>가입일시</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">기관이 없습니다.</div>
        ) : filtered.map((r, i) => (
          <div
            key={r.idx}
            className={`grid grid-cols-[40px_60px_1fr_120px_180px_140px] px-6 py-3 items-center text-[15px] text-center ${
              i < filtered.length - 1 ? 'border-b border-[#DEDEDE]' : ''
            }`}
          >
            <span className="flex items-center justify-center">
              <CheckboxBtn checked={selected.has(r.idx)} onChange={() => toggleOne(r.idx)} />
            </span>
            <span className="text-[#585858]">{i + 1}</span>
            <button
              type="button"
              onClick={() => setInstDetail({ instt_code: r.instt_code, instt_name: r.instt_name })}
              className="text-[#484848] hover:text-[#005744] transition-colors text-center"
            >
              {r.instt_name}
            </button>
            <span className="text-[#484848]">{r.instt_type}</span>
            <span className="text-[#484848]">{r.instt_code}</span>
            <span className="text-[#585858]">{r.regist_date}</span>
          </div>
        ))}
      </div>
    </Layout>
  )
}

function CheckboxBtn({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-colors ${
        checked ? 'bg-[#005744] border-[#005744]' : 'bg-white border-[#575757]'
      }`}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}

