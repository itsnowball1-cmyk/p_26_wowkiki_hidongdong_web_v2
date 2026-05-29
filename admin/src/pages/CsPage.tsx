import { useEffect, useRef, useState } from 'react'
import Layout from '../components/Layout'
import { useRouter } from '../lib/router'
import CsDetailPage from './CsDetailPage'

const S_TYPE: Record<string, string> = {
  '01': '아동관리', '02': '전체 내진 일정', '03': '아동별 커스텀',
  '04': '마이페이지', '05': '기타',
}

type CsItem = {
  cs_idx: number
  s_type: string
  name: string
  user_id: string
  reply_yn: string
  s_title: string
  regist_date: string
  reply_date: string | null
}

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }
const PAGE_SIZE = 20

export default function CsPage({ initialIdx }: { initialIdx?: number } = {}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(initialIdx ?? null)
  const [items, setItems] = useState<CsItem[]>([])
  const [total, setTotal] = useState(0)
  const [unanswered, setUnanswered] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const { navKey } = useRouter()
  const didMount = useRef(false)

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return }
    setSelectedIdx(null)
  }, [navKey])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const loadPage = (p: number) => {
    setLoading(true)
    setPage(p)
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) })
    if (search) params.set('search', search)
    fetch(`/api/admin/cs?${params}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : { items: [], total: 0, unanswered: 0 })
      .then(d => {
        setItems(d.items ?? [])
        setTotal(d.total ?? 0)
        setUnanswered(d.unanswered ?? 0)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPage(1) }, [search])

  if (selectedIdx !== null) {
    return (
      <CsDetailPage
        idx={selectedIdx}
        onBack={(saved) => {
          setSelectedIdx(null)
          loadPage(page)
          if (saved) showToast('답변이 완료되었습니다.')
        }}
      />
    )
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <Layout title="1:1 문의사항">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[30px] font-semibold text-[#000000]">1:1 문의사항</h1>
        </div>

        {/* 미답변 카운트 + 검색 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-[25px] font-semibold text-[#000000]">
            미답변 문의사항 <span className="text-[#FF4E4E]">{unanswered}</span>
          </p>
          <div className="flex items-center h-[40px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 w-[220px]">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
              placeholder="검색"
              className="flex-1 min-w-0 text-[14px] outline-none placeholder:text-[#B5B5B5]"
            />
            <button type="button" onClick={() => setSearch(searchInput)} className="flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="5.5" stroke="#727272" strokeWidth="1.5"/>
                <path d="M13.5 13.5L17 17" stroke="#727272" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white border border-[#DEDEDE] rounded-[10px] overflow-hidden">
          <div className="grid grid-cols-[140px_120px_160px_110px_2fr_130px_130px] px-4 h-[52px] items-center bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#202020] text-center">
            <span>문의유형</span>
            <span>문의자 이름</span>
            <span>문의자 아이디</span>
            <span>답변 상태</span>
            <span>제목</span>
            <span>문의 날짜</span>
            <span>답변 날짜</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center text-[14px] text-[#B5B5B5]">문의사항이 없습니다.</div>
          ) : (
            items.map((item, i) => (
              <div
                key={item.cs_idx}
                onClick={() => setSelectedIdx(item.cs_idx)}
                className={`grid grid-cols-[140px_120px_160px_110px_2fr_130px_130px] px-4 h-[52px] items-center text-[15px] text-center cursor-pointer hover:bg-[#F8F8F8] transition-colors ${i < items.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}
              >
                <span className="text-[#585858]">{S_TYPE[item.s_type] ?? item.s_type}</span>
                <span className="text-[#585858]">{item.name || '-'}</span>
                <span className="text-[#585858]">{item.user_id || '-'}</span>
                <span className={item.reply_yn === 'Y' ? 'text-[#484848]' : 'text-[#FF4646]'}>
                  {item.reply_yn === 'Y' ? '답변완료' : '답변대기'}
                </span>
                <span className="text-[#585858] text-left px-2 truncate">{item.s_title}</span>
                <span className="text-[#585858]">{item.regist_date}</span>
                <span className="text-[#585858]">{item.reply_date || '-'}</span>
              </div>
            ))
          )}
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-1 mt-4">
            <button type="button" onClick={() => loadPage(page - 1)} disabled={page === 1}
              className="w-[27px] h-[27px] flex items-center justify-center disabled:opacity-30">
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
                <path d="M6 1L1 6L6 11" stroke="#777777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
              const p = i + 1
              return (
                <button key={p} type="button" onClick={() => loadPage(p)}
                  className={`w-[29px] h-[27px] rounded-[5px] text-[15px] font-medium transition-colors ${
                    page === p ? 'bg-[#D9D9D9] text-[#5D5D5D]' : 'text-[#5D5D5D] hover:bg-[#F0F0F0]'
                  }`}>
                  {p}
                </button>
              )
            })}
            <button type="button" onClick={() => loadPage(page + 1)} disabled={page >= totalPages}
              className="w-[27px] h-[27px] flex items-center justify-center disabled:opacity-30">
              <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
                <path d="M1 1L6 6L1 11" stroke="#777777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}
      </Layout>

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#333333] text-white text-[15px] px-6 py-3 rounded-[8px] shadow-lg z-50">
          {toast}
        </div>
      )}
    </>
  )
}
