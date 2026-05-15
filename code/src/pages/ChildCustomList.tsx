import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { api, type CustomListItem } from '../lib/api'

export default function ChildCustomList() {
  const { go } = useRouter()
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<CustomListItem[]>([])

  useEffect(() => {
    api.customList().then(setRows).catch(() => {})
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = useMemo(() => {
    if (!q) return rows
    return rows.filter((r) =>
      [r.identifier, r.therapist_name, r.current_sound, r.upcoming_sound, r.last_diagnosis]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    )
  }, [rows, q])

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
            <table className="w-full min-w-[900px] text-[15px]">
              <thead>
                <tr className="border-b border-line bg-line-soft">
                  <Th>순번</Th>
                  <Th>식별코드</Th>
                  <Th>담당치료사</Th>
                  <Th>학습 중인 조음</Th>
                  <Th>학습 예정 조음</Th>
                  <Th>최근 진단일</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="h-[80px] text-center text-ink-400">검색 결과가 없습니다.</td>
                  </tr>
                )}
                {filtered.map((row, i) => (
                  <tr
                    key={row.id}
                    onClick={() => go({ name: 'custom-detail', id: row.id })}
                    className="cursor-pointer hover:bg-surface-active transition-colors"
                  >
                    <Td className="text-ink-600">{i + 1}</Td>
                    <Td className="text-ink-700">{row.identifier}</Td>
                    <Td className="text-ink-600">{row.therapist_name}</Td>
                    <Td className="text-ink-600">{row.current_sound ?? '-'}</Td>
                    <Td className="text-ink-600">{row.upcoming_sound ?? '-'}</Td>
                    <Td className="text-ink-600">{row.last_diagnosis ?? '-'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination active={1} />
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

function Pagination({ active, pages = [1] }: { active: number; pages?: number[] }) {
  if (pages.length <= 1) {
    return (
      <div className="flex items-center justify-center gap-2 mt-6">
        <button className="w-7 h-7 rounded-full text-[14px] font-bold flex items-center justify-center bg-line-soft text-ink-700">
          {active}
        </button>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button className="w-7 h-7 grid place-items-center text-ink-500" aria-label="prev">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 1 1 6l5 5" strokeLinecap="round" /></svg>
      </button>
      {pages.map((n) => (
        <button
          key={n}
          className={`w-7 h-7 rounded-full text-[14px] font-bold flex items-center justify-center transition ${
            n === active ? 'bg-line-soft text-ink-700' : 'text-ink-600 hover:bg-surface-active'
          }`}
        >
          {n}
        </button>
      ))}
      <button className="w-7 h-7 grid place-items-center text-ink-500" aria-label="next">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="m1 1 5 5-5 5" strokeLinecap="round" /></svg>
      </button>
    </div>
  )
}
