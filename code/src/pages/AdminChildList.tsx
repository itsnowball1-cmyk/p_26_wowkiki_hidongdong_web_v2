import { useEffect, useMemo, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import AdminChildTabs from '../components/AdminChildTabs'
import TopBar from '../components/TopBar'
import { api, type AdminChild } from '../lib/api'
import { useRouter } from '../lib/router'

const PAGE_SIZE = 10

export default function AdminChildList() {
  const { go } = useRouter()
  const [children, setChildren] = useState<AdminChild[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // 삭제 모달
  const [deleteTarget, setDeleteTarget] = useState<AdminChild[] | null>(null)
  const [deleting, setDeleting] = useState(false)


  const load = () => {
    setLoading(true)
    api.adminChildren(query)
      .then(data => { setChildren(data); setPage(1) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!query.trim()) return children
    const q = query.trim().toLowerCase()
    return children.filter(c =>
      [c.name, c.identifier, c.birth_date, c.gender].some(v => v?.toLowerCase().includes(q))
    )
  }, [children, query])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const toggleRow = (id: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const toggleAll = () => {
    if (selected.size === paged.length && paged.every(c => selected.has(c.id))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(paged.map(c => c.id)))
    }
  }

  const handleDeleteClick = () => {
    if (!selected.size) return
    const targets = children.filter(c => selected.has(c.id))
    setDeleteTarget(targets)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.adminDeleteChildren(deleteTarget.map(c => c.id))
      setChildren(prev => prev.filter(c => !selected.has(c.id)))
      setSelected(new Set())
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  const allPageSelected = paged.length > 0 && paged.every(c => selected.has(c.id))

  return (
    <div className="min-h-screen flex bg-surface">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
            <h1 className="text-[18px] font-semibold">
              <span className="text-ink-400">아동 목록</span>{' '}
              <span className="text-brand">{filtered.length}</span>
            </h1>
            <div className="flex items-center gap-3">
              <div className="relative w-[220px]">
                <input
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setPage(1) }}
                  onKeyDown={e => e.key === 'Enter' && load()}
                  placeholder="검색"
                  className="w-full h-[34px] pl-3 pr-9 border border-[#ADB5BD] rounded-[5px] text-[15px] focus:outline-none focus:border-brand bg-white"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" />
                </svg>
              </div>
              <button
                type="button"
                onClick={handleDeleteClick}
                disabled={selected.size === 0}
                className="h-[34px] w-[100px] rounded-[5px] bg-[#005744] text-white text-[15px] font-medium disabled:bg-ink-300 disabled:cursor-not-allowed hover:bg-[#005744]/90 transition-colors"
              >
                삭제{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            </div>
          </div>

          <AdminChildTabs />

          {/* 테이블 */}
          <div className="border border-line rounded-[5px] overflow-hidden bg-white">
            <table className="w-full table-fixed text-[15px] font-medium text-ink-600">
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
                      className="w-[18px] h-[18px] accent-brand"
                    />
                  </th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">순번</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">이름(나이)</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">식별코드</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">생년월일</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">성별</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">가입일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#575757]">
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="py-4 px-4">
                      <div className="h-4 rounded animate-pulse bg-line w-full" />
                    </td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-16 text-center text-ink-400">
                      등록된 아동이 없습니다.
                    </td>
                  </tr>
                )}
                {!loading && paged.map((child, i) => (
                  <tr key={child.id} className="h-[52px] hover:bg-surface-active/50 transition-colors cursor-pointer" onClick={() => go({ name: 'admin-child-detail', id: child.id })}>
                    <td className="text-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(child.id)}
                        onChange={() => toggleRow(child.id)}
                        className="w-[18px] h-[18px] accent-brand"
                      />
                    </td>
                    <td className="text-center text-[#585858]">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 text-center">
                      <span className="text-[#585858]">{child.name}</span>
                      {child.age_label && <span className="text-[#585858] ml-1">({child.age_label})</span>}
                      {child.is_new && (
                        <span className="ml-2 inline-block w-[40px] h-[20px] leading-[20px] text-[13px] font-medium bg-[#8CC7FF] text-white rounded-[5px] align-middle text-center">NEW</span>
                      )}
                    </td>
                    <td className="px-4 text-center text-[#484848] font-normal tracking-[-0.03em]">{child.identifier}</td>
                    <td className="text-center text-[#484848] font-normal tracking-[-0.03em]">{child.birth_date ?? '-'}</td>
                    <td className="text-center text-[#585858]">{child.gender}</td>
                    <td className="text-center text-[#585858]">{child.regist_date ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination total={filtered.length} page={page} pageSize={PAGE_SIZE} onChange={setPage} />
        </main>
      </div>

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <DeleteModal
          targets={deleteTarget}
          loading={deleting}
          onConfirm={handleDeleteConfirm}
          onClose={() => setDeleteTarget(null)}
        />
      )}

    </div>
  )
}

// ── 삭제 확인 모달 ──────────────────────────────────────────────────────────

function DeleteModal({ targets, loading, onConfirm, onClose }: {
  targets: AdminChild[]
  loading: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const names = targets.map(c => c.name).join(', ')
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-[12px] w-full max-w-[440px] p-8 relative shadow-xl text-center" onClick={e => e.stopPropagation()}>
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-ink-400 hover:text-ink-700 transition-colors">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 4l12 12M16 4 4 16" />
          </svg>
        </button>

        <h2 className="text-[20px] font-bold text-ink-900 mb-4">등록 아동 삭제</h2>
        <p className="text-[15px] text-ink-800 leading-relaxed mb-2">
          <strong>{names}</strong> 아동을 담당아동 목록에서 삭제하시겠습니까?<br />
          담당 의료진은 더이상 해당 아동의 정보를 확인할 수 없습니다.
        </p>
        <p className="text-[13px] text-ink-400 mb-8">
          (삭제 목록에서 1개월간 보관되며, 이후 모든 정보가 영구삭제됩니다.)
        </p>

        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="w-40 h-12 bg-[#2D5A3F] text-white text-[16px] font-medium rounded-[8px] hover:bg-[#234830] transition-colors disabled:opacity-60"
          >
            {loading ? '처리 중...' : '삭제'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-40 h-12 border border-line text-[16px] text-ink-700 rounded-[8px] hover:bg-surface-active transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Pagination ──────────────────────────────────────────────────────────────

function Pagination({ total, page, pageSize, onChange }: {
  total: number; page: number; pageSize: number; onChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }
  if (totalPages <= 1 && total === 0) return null
  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <PagBtn disabled={page === 1} onClick={() => onChange(Math.max(1, page - 1))}>
        <svg width="6" height="11" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 1 1 6l5 5" /></svg>
      </PagBtn>
      {pages.map((n, i) =>
        n === '...' ? <span key={`e${i}`} className="w-8 h-8 flex items-center justify-center text-[13px] text-ink-400">…</span>
        : <button key={n} type="button" onClick={() => onChange(n)}
            className={`w-8 h-8 flex items-center justify-center rounded-[5px] text-[13px] font-medium transition-colors ${n === page ? 'bg-brand text-white' : 'text-ink-600 hover:bg-surface-active'}`}
          >{n}</button>
      )}
      <PagBtn disabled={page === totalPages} onClick={() => onChange(Math.min(totalPages, page + 1))}>
        <svg width="6" height="11" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m1 1 5 5-5 5" /></svg>
      </PagBtn>
    </div>
  )
}

function PagBtn({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="w-8 h-8 flex items-center justify-center rounded-[5px] text-ink-400 hover:bg-surface-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      {children}
    </button>
  )
}
