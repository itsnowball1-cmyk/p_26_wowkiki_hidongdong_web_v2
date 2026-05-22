import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import NoticesWriteForm from './NoticesWriteForm'

type Notice = {
  idx: number
  is_pinned: boolean
  status: string
  target_roles: string
  notice_type: string
  title: string
  views: number
  created_at: string
  author_name: string
}

const HEADERS = { 'content-type': 'application/json', 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }
const PAGE_SIZE = 20

export default function NoticesPage() {
  const [view, setView] = useState<'list' | 'write'>('list')
  const [notices, setNotices] = useState<Notice[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [checked, setChecked] = useState<Set<number>>(new Set())

  const loadPage = (p: number) => {
    setLoading(true)
    setPage(p)
    setChecked(new Set())
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) })
    if (search) params.set('search', search)
    fetch(`/api/admin/notices?${params}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : { items: [], total: 0 })
      .then(d => { setNotices(d.items ?? []); setTotal(d.total ?? 0) })
      .finally(() => setLoading(false))
  }

  const handleDelete = async () => {
    if (checked.size === 0) return
    if (!confirm(`선택한 ${checked.size}건을 삭제하시겠습니까?`)) return
    await fetch('/api/admin/notices', {
      method: 'DELETE',
      headers: HEADERS,
      body: JSON.stringify({ idxs: [...checked] }),
    })
    loadPage(1)
  }

  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setChecked(new Set(notices.map(n => n.idx)))
    else setChecked(new Set())
  }

  useEffect(() => { loadPage(1) }, [search])

  if (view === 'write') {
    return <NoticesWriteForm onBack={() => { setView('list'); loadPage(1) }} />
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <Layout title="공지/FAQ">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[30px] font-semibold text-[#000000]">공지사항</h1>
        <button
          type="button"
          onClick={() => setView('write')}
          className="h-[40px] px-4 bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#004535] transition-colors"
        >
          공지사항 추가
        </button>
      </div>

      {/* 카운트 + 검색/삭제 */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[25px] font-semibold text-[#000000]">
          전체 게시물 <span className="text-[#005744]">{total}</span>
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center h-[34px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 w-[220px]">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSearch(searchInput) }}
              placeholder="검색"
              className="flex-1 text-[14px] outline-none placeholder:text-[#B5B5B5]"
            />
            <button type="button" onClick={() => setSearch(searchInput)}>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
                <circle cx="9" cy="9" r="5.5" stroke="#727272" strokeWidth="1.5"/>
                <path d="M13.5 13.5L17 17" stroke="#727272" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
          <button
            type="button"
            onClick={handleDelete}
            disabled={checked.size === 0}
            className="h-[40px] px-4 border border-[#005744] text-[#005744] text-[15px] font-medium rounded-[5px] hover:bg-[#005744] hover:text-white transition-colors disabled:opacity-30"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white border border-[#DEDEDE] rounded-[10px] overflow-hidden">
        <div className="grid grid-cols-[52px_90px_90px_1fr_140px_2fr_80px_130px_110px] px-4 h-[52px] items-center bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#202020] text-center">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="w-[18px] h-[18px] accent-[#005744] cursor-pointer"
              checked={checked.size === notices.length && notices.length > 0}
              onChange={toggleAll}
            />
          </div>
          <span>고정여부</span>
          <span>상태</span>
          <span>노출대상</span>
          <span>유형</span>
          <span>제목</span>
          <span>조회수</span>
          <span>작성일</span>
          <span>작성자</span>
        </div>

        {loading ? (
          <Empty text="불러오는 중…" />
        ) : notices.length === 0 ? (
          <Empty text="공지사항이 없습니다." />
        ) : (
          notices.map((n, i) => (
            <div
              key={n.idx}
              className={`grid grid-cols-[52px_90px_90px_1fr_140px_2fr_80px_130px_110px] px-4 h-[52px] items-center text-[15px] text-center ${i < notices.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}
            >
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  className="w-[18px] h-[18px] accent-[#005744] cursor-pointer"
                  checked={checked.has(n.idx)}
                  onChange={() => {
                    const next = new Set(checked)
                    if (next.has(n.idx)) next.delete(n.idx)
                    else next.add(n.idx)
                    setChecked(next)
                  }}
                />
              </div>
              <div className="flex items-center justify-center">
                {n.is_pinned
                  ? <span className="px-2 py-0.5 rounded-[3px] text-[13px] font-medium text-white bg-[#57987E]">고정</span>
                  : <span className="text-[#585858]">일반</span>
                }
              </div>
              <span className={n.status === '비공개' ? 'text-[#B5B5B5]' : 'text-[#585858]'}>{n.status || '공개'}</span>
              <span className="text-[#585858] text-left px-2 truncate">{n.target_roles || '-'}</span>
              <span className="text-[#585858]">{n.notice_type || '-'}</span>
              <span className="text-[#585858] text-left px-2 truncate">{n.title}</span>
              <span className="text-[#585858]">{n.views.toLocaleString()}</span>
              <span className="text-[#585858]">{n.created_at}</span>
              <span className="text-[#585858]">{n.author_name || '-'}</span>
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
  )
}

function Empty({ text }: { text: string }) {
  return <div className="py-12 text-center text-[14px] text-[#B5B5B5]">{text}</div>
}
