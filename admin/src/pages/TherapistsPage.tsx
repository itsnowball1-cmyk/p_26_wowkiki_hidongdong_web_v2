import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

type StatusFilter = 'active' | 'inactive' | 'all'

type TherapistRow = {
  idx: number
  name: string
  code: string | null
  instt_code: string
  instt_name: string
  child_count: number | null
  regist_date: string
  approval_status: string | null
}

const HEADERS = { 'content-type': 'application/json', 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }
const PAGE_SIZE = 20

export default function TherapistsPage() {
  const [rows, setRows] = useState<TherapistRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [approveLoading, setApproveLoading] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState<number[] | null>(null)

  const fetchData = async (s: StatusFilter, q: string, p: number) => {
    setLoading(true)
    setSelected(new Set())
    try {
      const params = new URLSearchParams({ status: s, page: String(p) })
      if (q) params.set('search', q)
      const res = await fetch(`/api/admin/therapists?${params}`, { headers: HEADERS })
      if (res.ok) {
        const data = await res.json() as { rows: TherapistRow[]; total: number }
        setRows(data.rows)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(statusFilter, search, page) }, [statusFilter, page])

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
    fetchData(statusFilter, searchInput, 1)
  }

  const doApprove = async (idxs: number[]) => {
    setApproveLoading(true)
    try {
      const res = await fetch('/api/admin/therapists/approve', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ idxs })
      })
      if (res.ok) {
        setConfirmApprove(null)
        fetchData(statusFilter, search, page)
      }
    } finally {
      setApproveLoading(false)
    }
  }

  const pendingSelectedIdxs = [...selected].filter(idx => rows.find(r => r.idx === idx)?.approval_status === '승인대기')
  const allChecked = rows.length > 0 && rows.every(r => selected.has(r.idx))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map(r => r.idx)))
  const toggleOne = (idx: number) => setSelected(prev => {
    const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next
  })
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Layout title="치료사 관리">
      {/* 상단 컨트롤 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-8">
          <p className="text-[18px]">
            <span className="text-[#919191] font-semibold">치료사 목록</span>
            <span className="text-[#005744] font-semibold ml-2">{total}</span>
          </p>
          <div className="flex items-center gap-5">
            {(['active', 'inactive', 'all'] as StatusFilter[]).map(s => (
              <label
                key={s}
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => { setStatusFilter(s); setPage(1) }}
              >
                <span className={`w-[17px] h-[17px] rounded-[3px] border flex items-center justify-center ${statusFilter === s ? 'bg-[#005744] border-[#005744]' : 'bg-white border-[#000000]'}`}>
                  {statusFilter === s && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className="text-[15px] text-[#2F2E2E]">
                  {s === 'active' ? '재직 유저' : s === 'inactive' ? '휴직 유저' : '전체 유저'}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pendingSelectedIdxs.length === 0}
            onClick={() => setConfirmApprove(pendingSelectedIdxs)}
            className="h-[40px] px-4 border border-[#005744] text-[#005744] rounded-[5px] text-[14px] font-medium hover:bg-[#005744] hover:text-white transition disabled:opacity-40"
          >
            일괄 승인
          </button>
          <div className="flex items-center h-[40px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 w-[220px]">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="검색"
              className="flex-1 text-[14px] outline-none placeholder:text-[#B5B5B5]"
            />
            <button type="button" onClick={handleSearch}>
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="#ADB5BD" strokeWidth="1.5"/>
                <path d="M11 11L15 15" stroke="#ADB5BD" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-[10px] border border-[#DEDEDE] overflow-hidden">
        <div className="grid grid-cols-[40px_60px_1fr_160px_160px_120px_140px_110px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#202020]">
          <span className="flex items-center">
            <Checkbox checked={allChecked} onChange={toggleAll} />
          </span>
          <span>순번</span>
          <span>등록 기관명</span>
          <span>이름</span>
          <span>식별코드</span>
          <span>담당 아동 수</span>
          <span>가입일시</span>
          <span></span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">데이터가 없습니다.</div>
        ) : rows.map((r, i) => (
          <div
            key={r.idx}
            className={`grid grid-cols-[40px_60px_1fr_160px_160px_120px_140px_110px] px-6 py-3 items-center text-[15px] ${i < rows.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}
          >
            <span><Checkbox checked={selected.has(r.idx)} onChange={() => toggleOne(r.idx)} /></span>
            <span className="text-[#585858]">{(page - 1) * PAGE_SIZE + i + 1}</span>
            <span className="text-[#585858] truncate pr-2">{r.instt_name}</span>
            <span className="text-[#585858]">{r.name}</span>
            <span className="text-[#484848]">{r.code ?? '-'}</span>
            <span className="text-[#484848]">{r.child_count !== null ? r.child_count : '-'}</span>
            <span className="text-[#585858]">{r.regist_date}</span>
            <span className="flex justify-center">
              {r.approval_status === '승인대기' && (
                <button
                  type="button"
                  onClick={() => setConfirmApprove([r.idx])}
                  className="w-[78px] h-[28px] rounded-[5px] border border-[#FF3B3B] text-[#FF3B3B] text-[13px] font-medium hover:bg-[#FF3B3B] hover:text-white transition"
                >
                  승인 대기
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-[29px] h-[27px] rounded-[5px] bg-[#D9D9D9] text-[#5D5D5D] text-[13px] hover:bg-[#B5B5B5] disabled:opacity-40 transition flex items-center justify-center"
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M6 1L1 6L6 11" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`w-[29px] h-[27px] rounded-[5px] text-[13px] transition ${page === p ? 'bg-[#005744] text-white' : 'bg-[#D9D9D9] text-[#5D5D5D] hover:bg-[#B5B5B5]'}`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-[29px] h-[27px] rounded-[5px] bg-[#D9D9D9] text-[#5D5D5D] text-[13px] hover:bg-[#B5B5B5] disabled:opacity-40 transition flex items-center justify-center"
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1L6 6L1 11" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* 승인 확인 모달 */}
      {confirmApprove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] w-[400px] px-8 py-8 flex flex-col items-center gap-5">
            <p className="text-[20px] font-bold text-[#2F2E2E]">치료사 승인</p>
            <p className="text-[14px] text-[#585858] text-center leading-[22px]">
              {confirmApprove.length === 1
                ? '선택한 치료사를 승인하시겠습니까?'
                : `선택한 ${confirmApprove.length}명의 치료사를 일괄 승인하시겠습니까?`}
            </p>
            <div className="flex gap-4 mt-2">
              <button
                type="button"
                onClick={() => doApprove(confirmApprove)}
                disabled={approveLoading}
                className="w-[125px] h-[40px] rounded-[5px] bg-[#005744] text-white text-[15px] font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {approveLoading ? '처리 중…' : '승인'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmApprove(null)}
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
      className={`w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-colors ${checked ? 'bg-[#005744] border-[#005744]' : 'bg-white border-[#575757]'}`}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}
