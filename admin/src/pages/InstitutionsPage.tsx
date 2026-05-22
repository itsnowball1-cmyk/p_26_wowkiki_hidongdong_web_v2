import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useRouter } from '../lib/router'

type TabName = 'pending' | 'rejected' | 'active' | 'inactive'

type InstitutionRow = {
  idx: number
  id: string
  name: string
  role: string
  instt_code: string
  instt_type: string
  regist_date: string
  rejected_date: string
  rejected_reason: string
}

type TabCounts = { pending: number; rejected: number; active: number; inactive: number }

const HEADERS = { 'content-type': 'application/json', 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }

const TABS: { key: TabName; label: string }[] = [
  { key: 'pending',  label: '신규신청' },
  { key: 'rejected', label: '반려' },
  { key: 'active',   label: '승인완료' },
  { key: 'inactive', label: '가입승인취소' },
]

export default function InstitutionsPage() {
  const { go } = useRouter()
  const [tab, setTab] = useState<TabName>('pending')
  const [rows, setRows] = useState<InstitutionRow[]>([])
  const [counts, setCounts] = useState<TabCounts>({ pending: 0, rejected: 0, active: 0, inactive: 0 })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deactivateModal, setDeactivateModal] = useState(false)
  const [deactivateLoading, setDeactivateLoading] = useState(false)

  const fetchData = async (t: TabName) => {
    setLoading(true)
    setSelected(new Set())
    try {
      const res = await fetch(`/api/admin/institutions?status=${t}`, { headers: HEADERS })
      if (res.ok) {
        const data = await res.json() as { rows: InstitutionRow[]; counts: TabCounts }
        setRows(data.rows)
        setCounts(data.counts)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(tab) }, [tab])

  const handleApprove = async (idx: number, action: 'approve' | 'reject') => {
    setActionLoading(idx)
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ idx, action })
      })
      if (res.ok) {
        setRows(prev => prev.filter(r => r.idx !== idx))
        setCounts(prev => {
          const next = { ...prev }
          if (tab === 'pending')  next.pending  -= 1
          if (tab === 'rejected') next.rejected -= 1
          if (action === 'approve') next.active  += 1
          if (action === 'reject')  next.rejected += 1
          return next
        })
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeactivate = async () => {
    setDeactivateLoading(true)
    try {
      const res = await fetch('/api/admin/institutions/deactivate', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ idxs: [...selected] })
      })
      if (res.ok) {
        setRows(prev => prev.filter(r => !selected.has(r.idx)))
        setCounts(prev => ({ ...prev, active: prev.active - selected.size, inactive: prev.inactive + selected.size }))
        setSelected(new Set())
        setDeactivateModal(false)
      }
    } finally {
      setDeactivateLoading(false)
    }
  }

  const filtered = rows.filter(r =>
    !search || r.name.includes(search) || r.instt_code.includes(search) || r.id.includes(search)
  )

  const allChecked = filtered.length > 0 && filtered.every(r => selected.has(r.idx))
  const toggleAll = () => {
    if (allChecked) setSelected(new Set())
    else setSelected(new Set(filtered.map(r => r.idx)))
  }
  const toggleOne = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const isActive   = tab === 'active' || tab === 'inactive'
  const isRejected = tab === 'rejected'

  return (
    <Layout title="기관/계정">
      {/* 탭 */}
      <div className="flex items-baseline gap-10 mb-6">
        {TABS.map(t => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => { setTab(t.key); setSearch('') }}
              className={`text-[28px] font-semibold transition-colors leading-none ${
                active ? 'text-[#005744]' : 'text-[#D2D2D2]'
              }`}
            >
              {t.label}{' '}
              <span className="text-[22px]">({counts[t.key]})</span>
            </button>
          )
        })}
      </div>

      {/* 테이블 영역 */}
      <div className="bg-white rounded-[10px] border border-[#DEDEDE] overflow-hidden">
        {/* 서브헤더 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#DEDEDE]">
          <p className="text-[15px]">
            <span className="text-[#919191] font-semibold">기관리스트</span>
            <span className="text-[#005744] font-semibold ml-2">{filtered.length}</span>
          </p>
          <div className="flex items-center gap-3">
            {/* 승인완료/가입승인취소 탭 전용 버튼 */}
            {isActive && (
              <>
                <button
                  type="button"
                  className="h-[40px] px-4 border border-[#005744] text-[#005744] rounded-[5px] text-[14px] font-medium hover:bg-[#005744] hover:text-white transition"
                >
                  사용자 목록 다운로드
                </button>
                <button
                  type="button"
                  disabled={selected.size === 0}
                  onClick={() => setDeactivateModal(true)}
                  className="h-[40px] px-4 border border-[#005744] text-[#005744] rounded-[5px] text-[14px] font-medium hover:bg-[#005744] hover:text-white transition disabled:opacity-40"
                >
                  비활성화
                </button>
              </>
            )}
            <div className="flex items-center h-[40px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 text-[14px] text-[#727272] cursor-pointer select-none">
              <span>전체</span>
              <svg width="12" height="7" viewBox="0 0 12 7" fill="none">
                <path d="M1 1L6 6L11 1" stroke="#727272" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="flex items-center h-[40px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 w-[220px]">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="검색"
                className="flex-1 text-[14px] outline-none placeholder:text-[#B5B5B5]"
              />
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="#ADB5BD" strokeWidth="1.5"/>
                <path d="M11 11L15 15" stroke="#ADB5BD" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </div>
        </div>

        {/* ── 승인완료 / 가입승인취소 탭 ── */}
        {isActive && (
          <>
            <div className="grid grid-cols-[40px_60px_1fr_120px_160px_140px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#343A40]">
              <span className="flex items-center">
                <Checkbox checked={allChecked} onChange={toggleAll} />
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
              <div className="py-12 text-center text-[14px] text-[#B5B5B5]">데이터가 없습니다.</div>
            ) : filtered.map((r, i) => (
              <div
                key={r.idx}
                className={`grid grid-cols-[40px_60px_1fr_120px_160px_140px] px-6 py-3 items-center text-[14px] ${
                  i < filtered.length - 1 ? 'border-b border-[#DEDEDE]' : ''
                }`}
              >
                <span><Checkbox checked={selected.has(r.idx)} onChange={() => toggleOne(r.idx)} /></span>
                <span className="text-[#585858]">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => go({ name: 'institution-detail', id: String(r.idx) })}
                  className="text-left text-[#484848] font-medium hover:text-[#005744] transition-colors"
                >
                  {r.name}
                </button>
                <span className="text-[#585858]">{r.instt_type || '-'}</span>
                <span className="text-[#585858]">{r.instt_code}</span>
                <span className="text-[#585858]">{r.regist_date}</span>
              </div>
            ))}
          </>
        )}

        {/* ── 신규신청 탭 ── */}
        {tab === 'pending' && (
          <>
            <div className="grid grid-cols-[60px_130px_1fr_130px_160px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#343A40]">
              <span>순번</span>
              <span>가입일시</span>
              <span>기관명</span>
              <span>상세보기</span>
              <span className="text-center">승인/반려</span>
            </div>
            {loading ? (
              <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-[14px] text-[#B5B5B5]">데이터가 없습니다.</div>
            ) : filtered.map((r, i) => (
              <div
                key={r.idx}
                className={`grid grid-cols-[60px_130px_1fr_130px_160px] px-6 py-3 items-center text-[14px] ${
                  i < filtered.length - 1 ? 'border-b border-[#DEDEDE]' : ''
                }`}
              >
                <span className="text-[#585858]">{i + 1}</span>
                <span className="text-[#585858]">{r.regist_date}</span>
                <div>
                  <p className="text-[#484848] font-medium">{r.name}</p>
                  <p className="text-[12px] text-[#B5B5B5]">{r.instt_code}</p>
                </div>
                <button
                  type="button"
                  onClick={() => go({ name: 'institution-detail', id: String(r.idx) })}
                  className="flex items-center gap-1 text-[#585858] hover:text-[#005744] transition-colors w-fit"
                >
                  상세보기
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="flex justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(r.idx, 'approve')}
                    disabled={actionLoading === r.idx}
                    className="w-[60px] h-[28px] rounded-[5px] bg-[#6EBE88] text-white text-[13px] font-medium hover:opacity-80 transition disabled:opacity-50"
                  >승인</button>
                  <button
                    type="button"
                    onClick={() => handleApprove(r.idx, 'reject')}
                    disabled={actionLoading === r.idx}
                    className="w-[60px] h-[28px] rounded-[5px] bg-[#FF7979] text-white text-[13px] font-medium hover:opacity-80 transition disabled:opacity-50"
                  >반려</button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── 반려 탭 ── */}
        {isRejected && (
          <>
            <div className="grid grid-cols-[60px_130px_1fr_1fr_130px_80px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#343A40]">
              <span>순번</span>
              <span>가입일시</span>
              <span>기관명</span>
              <span>반려일시 / 반려사유</span>
              <span>상세보기</span>
              <span className="text-center">승인</span>
            </div>
            {loading ? (
              <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
            ) : filtered.length === 0 ? (
              <div className="py-12 text-center text-[14px] text-[#B5B5B5]">데이터가 없습니다.</div>
            ) : filtered.map((r, i) => (
              <div
                key={r.idx}
                className={`grid grid-cols-[60px_130px_1fr_1fr_130px_80px] px-6 py-3 items-center text-[14px] ${
                  i < filtered.length - 1 ? 'border-b border-[#DEDEDE]' : ''
                }`}
              >
                <span className="text-[#585858]">{i + 1}</span>
                <span className="text-[#585858]">{r.regist_date}</span>
                <div>
                  <p className="text-[#484848] font-medium">{r.name}</p>
                  <p className="text-[12px] text-[#B5B5B5]">{r.instt_code}</p>
                </div>
                <div>
                  <p className="text-[#585858]">{r.rejected_date}</p>
                  <p className="text-[12px] text-[#B5B5B5] truncate">{r.rejected_reason}</p>
                </div>
                <button
                  type="button"
                  onClick={() => go({ name: 'institution-detail', id: String(r.idx) })}
                  className="flex items-center gap-1 text-[#585858] hover:text-[#005744] transition-colors w-fit"
                >
                  상세보기
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleApprove(r.idx, 'approve')}
                    disabled={actionLoading === r.idx}
                    className="w-[60px] h-[28px] rounded-[5px] bg-[#6EBE88] text-white text-[13px] font-medium hover:opacity-80 transition disabled:opacity-50"
                  >승인</button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      {/* 비활성화 확인 모달 */}
      {deactivateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] w-[400px] h-[220px] relative flex flex-col items-center justify-center px-8 gap-4">
            <button
              type="button"
              onClick={() => setDeactivateModal(false)}
              className="absolute top-5 right-5 text-[#707070] hover:text-[#333]"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M1 1L14 14M14 1L1 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <p className="text-[20px] font-bold text-[#2F2E2E]">기관 비활성화</p>
            <p className="text-[12px] text-[#2F2E2E] text-center leading-[18px]">
              <span className="font-semibold">
                {selected.size === 1
                  ? (filtered.find(r => selected.has(r.idx))?.name ?? '')
                  : `선택한 ${selected.size}개 기관`}
              </span>
              {' '}을 비활성화 하시겠습니까?<br/>
              비활성화 시 해당 기관 및 소속 사용자 계정이 즉시 비활성 상태로 전환됩니다.
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleDeactivate}
                disabled={deactivateLoading}
                className="w-[125px] h-[40px] rounded-[5px] bg-[#005744] text-white text-[15px] font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                비활성화
              </button>
              <button
                type="button"
                onClick={() => setDeactivateModal(false)}
                className="w-[125px] h-[40px] rounded-[5px] border border-[#005744] text-[#005744] text-[15px] font-medium hover:bg-[#005744] hover:text-white transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
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
