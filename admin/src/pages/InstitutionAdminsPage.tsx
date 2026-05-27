import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

type AdminRow = {
  idx: number
  name: string
  id: string
  instt_code: string
  inst_name: string
  inst_type: string
  regist_date: string
  status: string
}

const HEADERS = { 'content-type': 'application/json', 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }
const PAGE_SIZE = 20

export default function InstitutionAdminsPage() {
  const [rows, setRows] = useState<AdminRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const fetchData = async (q: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) })
      if (q) params.set('search', q)
      const res = await fetch(`/api/admin/institution-admins?${params}`, { headers: HEADERS })
      if (res.ok) {
        const data = await res.json() as { items: AdminRow[]; total: number }
        setRows(data.items)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(search, page) }, [])

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
    fetchData(searchInput, 1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Layout title="기관 관리자">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[30px] font-semibold text-[#000000]">기관 관리자</h1>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-[25px] font-semibold text-[#000000]">
          전체 <span className="text-[#005744]">{total}</span>
        </p>
        <div className="flex items-center h-[40px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 w-[220px]">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="이름 / 아이디 / 기관명 검색"
            className="flex-1 min-w-0 text-[14px] outline-none placeholder:text-[#B5B5B5]"
          />
          <button type="button" onClick={handleSearch} className="flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="5.5" stroke="#727272" strokeWidth="1.5"/>
              <path d="M13.5 13.5L17 17" stroke="#727272" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#DEDEDE] rounded-[10px] overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_140px_120px_160px_130px_100px] px-4 h-[52px] items-center bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#202020] text-center">
          <span>순번</span>
          <span>기관명</span>
          <span>기관코드</span>
          <span>기관 유형</span>
          <span>관리자 이름</span>
          <span>등록일</span>
          <span>상태</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">기관 관리자가 없습니다.</div>
        ) : rows.map((r, i) => (
          <div
            key={r.idx}
            className={`grid grid-cols-[60px_1fr_140px_120px_160px_130px_100px] px-4 h-[52px] items-center text-[15px] text-center ${i < rows.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}
          >
            <span className="text-[#585858]">{(page - 1) * PAGE_SIZE + i + 1}</span>
            <span className="text-[#202020] font-medium text-left truncate pr-2">{r.inst_name || '-'}</span>
            <span className="text-[#585858] font-mono text-[13px]">{r.instt_code}</span>
            <span className="text-[#585858] text-[13px]">{r.inst_type || '-'}</span>
            <span className="text-[#585858]">{r.name}</span>
            <span className="text-[#585858]">{r.regist_date}</span>
            <span className={r.status === '활성' ? 'text-[#005744] font-medium' : 'text-[#B5B5B5]'}>{r.status}</span>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-4">
          <button type="button" onClick={() => { setPage(p => Math.max(1, p - 1)); fetchData(search, Math.max(1, page - 1)) }}
            disabled={page === 1} className="w-[27px] h-[27px] flex items-center justify-center disabled:opacity-30">
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M6 1L1 6L6 11" stroke="#777777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
            <button key={p} type="button" onClick={() => { setPage(p); fetchData(search, p) }}
              className={`w-[29px] h-[27px] rounded-[5px] text-[15px] font-medium transition-colors ${page === p ? 'bg-[#D9D9D9] text-[#5D5D5D]' : 'text-[#5D5D5D] hover:bg-[#F0F0F0]'}`}>
              {p}
            </button>
          ))}
          <button type="button" onClick={() => { setPage(p => Math.min(totalPages, p + 1)); fetchData(search, Math.min(totalPages, page + 1)) }}
            disabled={page >= totalPages} className="w-[27px] h-[27px] flex items-center justify-center disabled:opacity-30">
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1L6 6L1 11" stroke="#777777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}
    </Layout>
  )
}
