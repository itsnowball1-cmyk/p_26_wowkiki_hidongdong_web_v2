import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

type InstitutionEntity = {
  instt_code: string
  inst_name: string
  inst_type: string
  address: string
  admin_count: number
  doctor_count: number
  therapist_count: number
  child_count: number
  regist_date: string
}

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }
const PAGE_SIZE = 20

export default function InstitutionEntitiesPage() {
  const [rows, setRows] = useState<InstitutionEntity[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchData = async (q: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p) })
      if (q) params.set('search', q)
      const res = await fetch(`/api/admin/institution-entities?${params}`, { headers: HEADERS })
      if (res.ok) {
        const data = await res.json() as { items: InstitutionEntity[]; total: number }
        setRows(data.items)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(search, page) }, [page])

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
    fetchData(searchInput, 1)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Layout title="기관 목록">
      {/* 상단 컨트롤 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[18px]">
          <span className="text-[#919191] font-semibold">기관 목록</span>
          <span className="text-[#005744] font-semibold ml-2">{total}</span>
        </p>
        <div className="flex items-center h-[40px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 w-[220px]">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="기관명 / 기관코드 검색"
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

      {/* 테이블 */}
      <div className="bg-white rounded-[10px] border border-[#DEDEDE] overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_140px_100px_60px_60px_60px_60px_120px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#202020]">
          <span>순번</span>
          <span>기관명</span>
          <span>기관코드</span>
          <span>기관 유형</span>
          <span className="text-center">관리자</span>
          <span className="text-center">의사</span>
          <span className="text-center">치료사</span>
          <span className="text-center">아동</span>
          <span>등록일</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">데이터가 없습니다.</div>
        ) : rows.map((r, i) => (
          <div
            key={r.instt_code}
            className={`grid grid-cols-[60px_1fr_140px_100px_60px_60px_60px_60px_120px] px-6 py-3 items-center text-[15px] ${i < rows.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}
          >
            <span className="text-[#585858]">{(page - 1) * PAGE_SIZE + i + 1}</span>
            <span className="text-[#202020] font-medium truncate pr-2">{r.inst_name}</span>
            <span className="text-[#484848] font-mono text-[13px]">{r.instt_code}</span>
            <span className="text-[#585858] text-[13px]">{r.inst_type}</span>
            <span className="text-center text-[#484848]">{r.admin_count}</span>
            <span className="text-center text-[#484848]">{r.doctor_count}</span>
            <span className="text-center text-[#484848]">{r.therapist_count}</span>
            <span className="text-center text-[#484848]">{r.child_count}</span>
            <span className="text-[#585858] text-[13px]">{r.regist_date}</span>
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
