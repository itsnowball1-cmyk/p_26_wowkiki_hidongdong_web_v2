import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { api, type CustomListItem } from '../lib/api'

const PAGE_SIZE = 15

export default function ChildCustomList() {
  const { go } = useRouter()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<CustomListItem[]>([])
  const [page, setPage] = useState(1)

  useEffect(() => {
    api.customList().then(setRows).catch(() => {})
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    setPage(1)
    if (!q) return rows
    return rows.filter((r) =>
      [r.name, r.identifier, r.birth_date, r.gender, r.therapist_name, r.current_sound, r.upcoming_sound, r.last_diagnosis]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [rows, q])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-10 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-[18px] font-semibold">
              <span className="text-ink-400">아동 목록 </span>
              <span className="text-brand">{filtered.length}</span>
            </h2>

            <SearchBox value={query} onChange={setQuery} />
          </div>

          <div className="overflow-x-auto rounded-md border border-line bg-surface-card">
            <table className="w-full min-w-[1000px] text-[15px]">
              <thead>
                <tr className="border-b border-line bg-line-soft">
                  <Th>순번</Th>
                  <Th>이름(나이)</Th>
                  <Th>식별코드</Th>
                  <Th>생년월일</Th>
                  <Th>성별</Th>
                  <Th>담당치료사</Th>
                  <Th>학습 중인 조음</Th>
                  <Th>학습 예정 조음</Th>
                  <Th>최근 진단일</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="h-[80px] text-center text-ink-400">검색 결과가 없습니다.</td>
                  </tr>
                )}
                {paged.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => go({ name: 'custom-detail', id: row.id })}
                    className="cursor-pointer hover:bg-surface-active transition-colors"
                  >
                    <Td className="text-ink-600">{(page - 1) * PAGE_SIZE + i + 1}</Td>
                    <Td className="text-ink-700">
                      {row.name ?? '-'}{row.age_label ? `(${row.age_label})` : ''}
                    </Td>
                    <Td className="text-ink-600">{row.identifier}</Td>
                    <Td className="text-ink-600">{row.birth_date ?? '-'}</Td>
                    <Td className="text-ink-600">{row.gender ?? '-'}</Td>
                    <Td className="text-ink-600">{row.therapist_name ?? '-'}</Td>
                    <Td className="text-ink-600">{row.current_sound ?? '-'}</Td>
                    <Td className="text-ink-600">{row.upcoming_sound ?? '-'}</Td>
                    <Td className="text-ink-600">{row.last_diagnosis ?? '-'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </main>
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="h-[52px] px-3 text-center font-medium text-[15px] text-ink-900">{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`h-[52px] px-3 text-center border-t border-line ${className}`}>{children}</td>
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

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
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

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="w-8 h-8 flex items-center justify-center rounded-[5px] text-ink-400 hover:bg-surface-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M6 1 1 6l5 5" /></svg>
      </button>
      {pageNumbers.map((n, i) =>
        n === '...' ? (
          <span key={`e-${i}`} className="w-8 h-8 flex items-center justify-center text-[14px] text-ink-400">…</span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-8 h-8 flex items-center justify-center rounded-[5px] text-[14px] font-medium transition-colors ${
              n === page ? 'bg-brand text-white' : 'text-ink-600 hover:bg-surface-active'
            }`}
          >
            {n}
          </button>
        )
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="w-8 h-8 flex items-center justify-center rounded-[5px] text-ink-400 hover:bg-surface-active disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m1 1 5 5-5 5" /></svg>
      </button>
    </div>
  )
}
