import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api, type NoticeListItem } from '../lib/api'

const PAGE_SIZE = 10

const NOTICE_TYPE_MAP: Record<string, string> = {
  '1': '전체 공지',
  '2': '회원가입 반려',
  '3': '서비스 안내',
  '4': '시스템 점검',
  '5': '업데이트',
}
const toNoticeLabel = (g: string) => NOTICE_TYPE_MAP[g] ?? g

const CATEGORIES = ['전체공지', '서비스공지', '기능업데이트', '이용안내', '이벤트/소식']

export default function NoticeList() {
  const { go } = useRouter()
  const { user } = useAuth()
  const [total, setTotal] = useState(0)
  const [items, setItems] = useState<NoticeListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [gubun, setGubun] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  useEffect(() => {
    setLoading(true)
    api.notices(page, gubun, search)
      .then(data => {
        setTotal(data.total)
        setItems(data.items)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [page, gubun, search])

  const handleSearch = () => {
    setPage(1)
    setSearch(searchInput)
  }

  const handleGubunChange = (value: string) => {
    setGubun(value)
    setPage(1)
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {user?.role === 'admin' ? <AdminSidebar /> : <Sidebar />}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8">
          <h1 className="text-[22px] font-bold text-center mb-8">공지사항</h1>

          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <select
                value={gubun}
                onChange={e => handleGubunChange(e.target.value)}
                className="h-10 pl-4 pr-8 rounded-[5px] border border-line-input text-[15px] appearance-none focus:outline-none focus:border-brand bg-white cursor-pointer"
              >
                <option value="">전체</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ink-400" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <div className="flex-1 relative">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="검색어를 입력하세요."
                className="w-full h-10 pl-4 pr-12 rounded-[5px] border border-line-input text-[15px] focus:outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={handleSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-brand transition-colors"
                aria-label="검색"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="9" r="6" />
                  <path d="m14 14 4 4" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-line bg-surface-card">
            <table className="w-full text-[15px]">
              <thead>
                <tr className="border-b border-line bg-line-soft">
                  <Th className="w-24">번호</Th>
                  <Th className="w-36">유형</Th>
                  <Th>제목</Th>
                  <Th className="w-32">등록일</Th>
                  <Th className="w-24">조회수</Th>
                </tr>
              </thead>
              <tbody>
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {[40, 60, 200, 80, 40].map((w, j) => (
                      <Td key={j}><div className="h-4 rounded animate-pulse bg-line mx-auto" style={{ width: w }} /></Td>
                    ))}
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={5} className="h-[80px] text-center text-ink-400">등록된 공지사항이 없습니다.</td>
                  </tr>
                )}
                {!loading && items.map((item, index) => (
                  <tr
                    key={item.BOARD_KEY}
                    onClick={() => go({ name: 'notice-detail', id: item.BOARD_KEY })}
                    className="cursor-pointer hover:bg-surface-active transition-colors"
                  >
                    <Td>
                      {item.BOARD_FIXED === 'Y' ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[13px] font-semibold bg-brand text-white">고정</span>
                      ) : (
                        <span className="text-ink-600">{total - (page - 1) * PAGE_SIZE - index}</span>
                      )}
                    </Td>
                    <Td className="text-ink-600">{item.GUBUN ? toNoticeLabel(item.GUBUN) : '-'}</Td>
                    <Td className="text-left px-4 text-ink-700">{item.BOARD_TITLE}</Td>
                    <Td className="text-ink-600">{item.reg_date}</Td>
                    <Td className="text-ink-600">{item.BOARD_READ_COUNT}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination total={total} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
        </main>
      </div>
    </div>
  )
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`h-[52px] px-3 text-center font-medium text-[15px] text-ink-900 ${className}`}>
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`h-[52px] px-3 text-center border-t border-line ${className}`}>{children}</td>
  )
}

function Pagination({ total, page, pageSize, onChange }: {
  total: number; page: number; pageSize: number; onChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageNumbers: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i)
  } else {
    pageNumbers.push(1)
    if (page > 3) pageNumbers.push('...')
    const start = Math.max(2, page - 1)
    const end = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) pageNumbers.push(i)
    if (page < totalPages - 2) pageNumbers.push('...')
    pageNumbers.push(totalPages)
  }
  if (totalPages <= 1 && total === 0) return null
  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button type="button" onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
        aria-label="이전 페이지"
        className="w-8 h-8 flex items-center justify-center rounded-[5px] text-ink-400 hover:bg-surface-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 1 1 6l5 5" /></svg>
      </button>
      {pageNumbers.map((n, i) =>
        n === '...' ? (
          <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-[14px] text-ink-400 select-none">…</span>
        ) : (
          <button key={n} type="button" onClick={() => onChange(n)}
            className={`w-8 h-8 flex items-center justify-center rounded-[5px] text-[14px] font-medium transition-colors ${n === page ? 'bg-brand text-white' : 'text-ink-600 hover:bg-surface-active'}`}>
            {n}
          </button>
        )
      )}
      <button type="button" onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages}
        aria-label="다음 페이지"
        className="w-8 h-8 flex items-center justify-center rounded-[5px] text-ink-400 hover:bg-surface-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m1 1 5 5-5 5" /></svg>
      </button>
    </div>
  )
}
