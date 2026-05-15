import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { api, type AssignedChild, type UnassignedChild } from '../lib/api'

const PAGE_SIZE = 10

export default function ChildManagement() {
  const { go } = useRouter()
  const [assigned, setAssigned] = useState<AssignedChild[]>([])
  const [unassigned, setUnassigned] = useState<UnassignedChild[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [filter, setFilter] = useState<'active' | 'dormant' | 'all'>('active')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [assignedPage, setAssignedPage] = useState(1)
  const [unassignedPage, setUnassignedPage] = useState(1)

  useEffect(() => {
    Promise.all([api.assignedChildren(), api.unassignedChildren()])
      .then(([a, u]) => { setAssigned(a); setUnassigned(u) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const q = query.trim().toLowerCase()

  const filteredAssigned = useMemo(() => {
    setAssignedPage(1)
    if (!q) return assigned
    return assigned.filter((r) =>
      [r.identifier, r.therapist_name, r.next_doctor_appointment, r.next_therapy_appointment]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [assigned, q])

  const filteredUnassigned = useMemo(() => {
    setUnassignedPage(1)
    if (!q) return unassigned
    return unassigned.filter((r) =>
      [r.name, r.age_label, r.app_login_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [unassigned, q])

  const pagedAssigned = useMemo(() => {
    const start = (assignedPage - 1) * PAGE_SIZE
    return filteredAssigned.slice(start, start + PAGE_SIZE)
  }, [filteredAssigned, assignedPage])

  const pagedUnassigned = useMemo(() => {
    const start = (unassignedPage - 1) * PAGE_SIZE
    return filteredUnassigned.slice(start, start + PAGE_SIZE)
  }, [filteredUnassigned, unassignedPage])

  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAssignToMe = async () => {
    const ids = [...selected]
    if (!ids.length) return
    await api.assignToMe(ids)
    const [a, u] = await Promise.all([
      api.assignedChildren(),
      api.unassignedChildren()
    ])
    setAssigned(a)
    setUnassigned(u)
    setSelected(new Set())
  }

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-10 py-8 space-y-10">
          {/* Section 1 — 아동 목록 */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <h2 className="text-[18px] font-semibold">
                <span className="text-ink-400">아동 목록 </span>
                <span className="text-brand">{filteredAssigned.length}</span>
              </h2>

              <div className="hidden md:flex items-center gap-5 text-[15px]">
                <FilterRadio label="활성화 유저" checked={filter === 'active'} onChange={() => setFilter('active')} />
                <FilterRadio label="휴면 유저" checked={filter === 'dormant'} onChange={() => setFilter('dormant')} />
                <FilterRadio label="전체 유저" checked={filter === 'all'} onChange={() => setFilter('all')} />
              </div>

              <SearchBox value={query} onChange={setQuery} />
            </div>

            <div className="overflow-x-auto rounded-md border border-line bg-surface-card">
              <table className="w-full min-w-[800px] text-[15px]">
                <thead>
                  <tr className="border-b border-line bg-line-soft">
                    <Th>순번</Th>
                    <Th>식별코드</Th>
                    <Th>다음 진료 예약</Th>
                    <Th>담당 치료사</Th>
                    <Th>다음 치료 예약</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {[28, 80, 96, 64, 96].map((w, j) => (
                        <Td key={j}><div className={`h-4 rounded animate-pulse bg-line mx-auto`} style={{ width: w }} /></Td>
                      ))}
                    </tr>
                  ))}
                  {!loading && filteredAssigned.length === 0 && (
                    <tr>
                      <td colSpan={5} className="h-[80px] text-center text-ink-400">검색 결과가 없습니다.</td>
                    </tr>
                  )}
                  {!loading && pagedAssigned.map((row, i) => (
                    <tr
                      key={row.id}
                      onClick={() => go({ name: 'detail', id: row.id })}
                      className="cursor-pointer hover:bg-surface-active transition-colors"
                    >
                      <Td className="text-ink-600">{(assignedPage - 1) * PAGE_SIZE + i + 1}</Td>
                      <Td className="text-ink-700 underline-offset-2 hover:underline">{row.identifier}</Td>
                      <Td className="text-ink-600">{row.next_doctor_appointment ?? '-'}</Td>
                      <Td className="text-ink-600">{row.therapist_name ?? '-'}</Td>
                      <Td className="text-ink-600">{row.next_therapy_appointment ?? '-'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              total={filteredAssigned.length}
              page={assignedPage}
              pageSize={PAGE_SIZE}
              onChange={setAssignedPage}
            />
          </section>

          {/* Section 2 — 미배정 아동 목록 */}
          <section>
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="text-[18px] font-semibold">
                <span className="text-ink-400">미배정 아동 목록 </span>
                <span className="text-brand">{filteredUnassigned.length}</span>
              </h2>

              <button
                type="button"
                onClick={handleAssignToMe}
                disabled={selected.size === 0}
                className="h-9 px-4 rounded-[5px] bg-brand text-white text-[15px] font-medium disabled:bg-ink-300 disabled:cursor-not-allowed hover:opacity-90 transition"
              >
                나에게 배정 {selected.size > 0 && `(${selected.size})`}
              </button>
            </div>

            <div className="overflow-x-auto rounded-md border border-line bg-surface-card">
              <table className="w-full min-w-[800px] text-[15px]">
                <thead>
                  <tr className="border-b border-line bg-line-soft">
                    <Th className="w-10"><span className="sr-only">선택</span></Th>
                    <Th>순번</Th>
                    <Th>이름</Th>
                    <Th>나이</Th>
                    <Th>아이디</Th>
                  </tr>
                </thead>
                <tbody>
                  {loading && Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      {[20, 28, 64, 40, 80].map((w, j) => (
                        <Td key={j}><div className="h-4 rounded animate-pulse bg-line mx-auto" style={{ width: w }} /></Td>
                      ))}
                    </tr>
                  ))}
                  {!loading && filteredUnassigned.length === 0 && (
                    <tr>
                      <td colSpan={5} className="h-[80px] text-center text-ink-400">검색 결과가 없습니다.</td>
                    </tr>
                  )}
                  {!loading && pagedUnassigned.map((row, i) => (
                    <tr key={row.id} className="hover:bg-surface-active transition-colors">
                      <Td>
                        <input
                          type="checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                          className="w-5 h-5 rounded-[3px] border border-line-dark accent-brand"
                          aria-label={`row-${i + 1}-select`}
                        />
                      </Td>
                      <Td className="text-ink-600">{(unassignedPage - 1) * PAGE_SIZE + i + 1}</Td>
                      <Td className="text-ink-700">{row.name}</Td>
                      <Td className="text-ink-600">{row.age_label ?? '-'}</Td>
                      <Td className="text-ink-600">{row.app_login_id ?? '-'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              total={filteredUnassigned.length}
              page={unassignedPage}
              pageSize={PAGE_SIZE}
              onChange={setUnassignedPage}
            />
          </section>
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

function FilterRadio({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer">
      <input type="radio" name="user-filter" checked={checked} onChange={onChange} className="accent-brand w-[17px] h-[17px]" />
      <span className="text-ink-800">{label}</span>
    </label>
  )
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative w-[220px]">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="검색"
        className="w-full h-10 pl-3 pr-9 rounded-[5px] border border-line-input text-[15px] focus:outline-none focus:border-brand"
      />
      <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-line-input pointer-events-none" width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="9" r="6" />
        <path d="m14 14 4 4" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function Pagination({
  total, page, pageSize, onChange
}: {
  total: number
  page: number
  pageSize: number
  onChange: (p: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // 보여줄 페이지 번호 목록 (최대 5개, 양쪽 ellipsis 포함)
  const pageNumbers: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i)
  } else {
    pageNumbers.push(1)
    if (page > 3) pageNumbers.push('...')
    const start = Math.max(2, page - 1)
    const end   = Math.min(totalPages - 1, page + 1)
    for (let i = start; i <= end; i++) pageNumbers.push(i)
    if (page < totalPages - 2) pageNumbers.push('...')
    pageNumbers.push(totalPages)
  }

  if (totalPages <= 1 && total === 0) return null

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      {/* 이전 */}
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="이전 페이지"
        className="w-8 h-8 flex items-center justify-center rounded-[5px] text-ink-400 hover:bg-surface-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M6 1 1 6l5 5" />
        </svg>
      </button>

      {/* 페이지 번호 */}
      {pageNumbers.map((n, i) =>
        n === '...' ? (
          <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-[14px] text-ink-400 select-none">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-8 h-8 flex items-center justify-center rounded-[5px] text-[14px] font-medium transition-colors ${
              n === page
                ? 'bg-brand text-white'
                : 'text-ink-600 hover:bg-surface-active'
            }`}
          >
            {n}
          </button>
        )
      )}

      {/* 다음 */}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        aria-label="다음 페이지"
        className="w-8 h-8 flex items-center justify-center rounded-[5px] text-ink-400 hover:bg-surface-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="m1 1 5 5-5 5" />
        </svg>
      </button>
    </div>
  )
}
