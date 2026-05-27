import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

type StatusFilter = 'active' | 'inactive' | 'all'

type ChildRow = {
  idx: number
  code: string | null
  name: string
  age_label: string
  birth_date: string
  gender: string
  instt_name: string
  doctor_name: string
  therapist_name: string
  next_doctor_appt: string
  next_therapy_appt: string
}

const HEADERS = { 'content-type': 'application/json', 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }
const PAGE_SIZE = 20

export default function ChildrenDataPage() {
  const [rows, setRows] = useState<ChildRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  const fetchData = async (s: StatusFilter, q: string, p: number) => {
    setLoading(true)
    setSelected(new Set())
    try {
      const params = new URLSearchParams({ status: s, page: String(p) })
      if (q) params.set('search', q)
      const res = await fetch(`/api/admin/children-all?${params}`, { headers: HEADERS })
      if (res.ok) {
        const data = await res.json() as { rows: ChildRow[]; total: number }
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

  const allChecked = rows.length > 0 && rows.every(r => selected.has(r.idx))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map(r => r.idx)))
  const toggleOne = (idx: number) => setSelected(prev => {
    const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next
  })
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Layout title="아동 전체 데이터">
      {/* 상단 컨트롤 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-8">
          <p className="text-[18px]">
            <span className="text-[#919191] font-semibold">아동 목록</span>
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
                  {s === 'active' ? '활성화 유저' : s === 'inactive' ? '휴면 유저' : '전체 유저'}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#000000]">[데이터 다운로드]</span>
          <button
            type="button"
            className="h-[40px] px-4 border border-[#22824A] text-[#22824A] rounded-[5px] text-[12px] font-medium hover:bg-[#22824A] hover:text-white transition"
          >
            엑셀 다운
          </button>
          <button
            type="button"
            className="h-[40px] px-4 border border-[#CE5702] text-[#CE5702] rounded-[5px] text-[12px] font-medium hover:bg-[#CE5702] hover:text-white transition"
          >
            PDF 다운
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

      {/* 테이블 — 가로 스크롤 */}
      <div className="bg-white rounded-[10px] border border-[#DEDEDE] overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: '1300px' }}>
            {/* 헤더 */}
            <div className="grid grid-cols-[30px_50px_130px_130px_180px_100px_80px_120px_120px_120px_120px] px-4 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[14px] font-medium text-[#202020] text-center">
              <span className="flex items-center justify-center">
                <Checkbox checked={allChecked} onChange={toggleAll} />
              </span>
              <span>순번</span>
              <span>식별코드</span>
              <span>이름(나이)</span>
              <span>등록 기관명</span>
              <span>생년월일</span>
              <span>성별</span>
              <span>담당의사</span>
              <span>다음 진료 예약</span>
              <span>담당치료사</span>
              <span>다음 치료 예약</span>
            </div>

            {loading ? (
              <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-[14px] text-[#B5B5B5]">데이터가 없습니다.</div>
            ) : rows.map((r, i) => (
              <div
                key={r.idx}
                className={`grid grid-cols-[30px_50px_130px_130px_180px_100px_80px_120px_120px_120px_120px] px-4 py-3 items-center text-[14px] text-center ${i < rows.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}
              >
                <span className="flex items-center justify-center">
                  <Checkbox checked={selected.has(r.idx)} onChange={() => toggleOne(r.idx)} />
                </span>
                <span className="text-[#585858]">{(page - 1) * PAGE_SIZE + i + 1}</span>
                <span className="text-[#484848]">{r.code ?? '-'}</span>
                <span className="text-[#585858]">{r.name}({r.age_label})</span>
                <span className="text-[#585858] truncate px-1">{r.instt_name}</span>
                <span className="text-[#585858]">{r.birth_date}</span>
                <span className="text-[#585858]">{r.gender}</span>
                <span className="text-[#585858]">{r.doctor_name}</span>
                <span className="text-[#585858]">{r.next_doctor_appt}</span>
                <span className="text-[#585858]">{r.therapist_name}</span>
                <span className="text-[#585858]">{r.next_therapy_appt}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-[29px] h-[27px] rounded-[5px] bg-[#D9D9D9] text-[#5D5D5D] hover:bg-[#B5B5B5] disabled:opacity-40 transition flex items-center justify-center"
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
            className="w-[29px] h-[27px] rounded-[5px] bg-[#D9D9D9] text-[#5D5D5D] hover:bg-[#B5B5B5] disabled:opacity-40 transition flex items-center justify-center"
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1L6 6L1 11" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
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
