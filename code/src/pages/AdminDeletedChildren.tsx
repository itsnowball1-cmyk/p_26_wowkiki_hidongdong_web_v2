import { useEffect, useMemo, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { api, type AdminChild } from '../lib/api'

const PAGE_SIZE = 10

// deleted_at: "YYYY.MM.DD" 형식 → 영구삭제까지 남은 일수 (30일 기준)
function daysUntilExpiry(deletedAt: string | null | undefined): number {
  if (!deletedAt) return 30
  const deleted = new Date(deletedAt.replace(/\./g, '-'))
  if (isNaN(deleted.getTime())) return 30
  const expiry = new Date(deleted)
  expiry.setDate(expiry.getDate() + 30)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000)
}

function ExpiryLabel({ days }: { days: number }) {
  if (days <= 1) return <span className="text-[#FF2A2A] font-medium">오늘 삭제</span>
  if (days <= 3) return <span className="text-[#FFA270] font-medium">{days}일 남음</span>
  return <span className="text-[#585858] font-medium">{days}일 남음</span>
}

export default function AdminDeletedChildren() {
  const [all, setAll] = useState<AdminChild[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [restoring, setRestoring] = useState(false)

  const load = () => {
    setLoading(true)
    api.adminDeletedChildren()
      .then(data => {
        // 30일 지난 항목은 프론트에서 필터링
        setAll(data.filter(c => daysUntilExpiry(c.deleted_at) > 0))
        setPage(1)
        setSelected(new Set())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return all
    const q = query.trim().toLowerCase()
    return all.filter(c =>
      [c.name, c.identifier, c.birth_date].some(v => v?.toLowerCase().includes(q))
    )
  }, [all, query])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const toggleRow = (id: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const allPageSelected = paged.length > 0 && paged.every(c => selected.has(c.id))
  const toggleAll = () => {
    if (allPageSelected) setSelected(new Set())
    else setSelected(new Set(paged.map(c => c.id)))
  }

  const handleRestore = async () => {
    if (!selected.size || restoring) return
    setRestoring(true)
    try {
      await api.adminRestoreChildren([...selected])
      load()
    } finally {
      setRestoring(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8">

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-[18px] font-semibold">
                <span className="text-[#919191]">아동 삭제 목록</span>{' '}
                <span className="text-[#005744]">{filtered.length}</span>
              </h1>
              <span className="text-[14px] text-[#B1B1B1]">
                삭제된 정보는 삭제 목록에서 30일간 보관되며, 이후 완전히 삭제됩니다.
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* 검색 */}
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setPage(1) }}
                  placeholder="검색"
                  className="w-[220px] h-[34px] pl-3 pr-9 border border-[#ADB5BD] rounded-[5px] text-[15px] focus:outline-none focus:border-[#005744] bg-white"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#919191] pointer-events-none" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" />
                </svg>
              </div>

              {/* 복구 버튼 */}
              <button
                type="button"
                onClick={handleRestore}
                disabled={selected.size === 0 || restoring}
                className="w-[100px] h-[40px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 transition-colors disabled:bg-[#B5B5B5] disabled:cursor-not-allowed"
              >
                {restoring ? '복구 중…' : `복구${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </button>
            </div>
          </div>

          {/* 테이블 */}
          <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
            <table className="w-full table-fixed text-[15px]">
              <colgroup>
                <col className="w-[54px]" />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr className="bg-[#EAEAEA] border-b border-[#575757]">
                  <th className="h-[52px] text-center">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleAll}
                      className="w-[18px] h-[18px] accent-[#005744]"
                    />
                  </th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">순번</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">이름(나이)</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">식별코드</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">생년월일</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">성별</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">삭제 예정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEDEDE]">
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="py-4 px-4">
                      <div className="h-4 rounded animate-pulse bg-[#EAEAEA] w-full" />
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-[#919191]">삭제된 아동이 없습니다.</td>
                  </tr>
                )}
                {!loading && paged.map((child, i) => {
                  const days = daysUntilExpiry(child.deleted_at)
                  return (
                    <tr key={child.id} className="h-[52px] hover:bg-[#FAFAFA] transition-colors">
                      <td className="text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(child.id)}
                          onChange={() => toggleRow(child.id)}
                          className="w-[18px] h-[18px] accent-[#005744]"
                        />
                      </td>
                      <td className="text-center text-[#585858] font-medium">
                        {(page - 1) * PAGE_SIZE + i + 1}
                      </td>
                      <td className="px-2 text-center text-[#585858] font-medium">
                        {child.name}{child.age_label ? `(${child.age_label})` : ''}
                      </td>
                      <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">
                        {child.identifier}
                      </td>
                      <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">
                        {child.birth_date ?? '-'}
                      </td>
                      <td className="text-center text-[#585858] font-medium">{child.gender}</td>
                      <td className="text-center">
                        <ExpiryLabel days={days} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-6">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-[27px] flex items-center justify-center text-[#777777] disabled:opacity-30"
              >
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 1 1 6l5 5" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-[29px] h-[27px] flex items-center justify-center rounded-[5px] text-[15px] font-medium transition-colors ${
                    p === page ? 'bg-[#D9D9D9] text-[#5D5D5D]' : 'text-[#5D5D5D] hover:bg-[#EAEAEA]'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-[27px] flex items-center justify-center text-[#777777] disabled:opacity-30"
              >
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m1 1 5 5-5 5" /></svg>
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
