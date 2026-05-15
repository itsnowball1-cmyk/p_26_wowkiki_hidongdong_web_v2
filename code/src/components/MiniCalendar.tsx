import { useState } from 'react'

const DOW = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const THIS_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = Array.from({ length: 12 }, (_, i) => THIS_YEAR - 1 + i)

type Props = {
  selectedDate?: Date
  onSelect?: (d: Date) => void
}

export default function MiniCalendar({ selectedDate, onSelect }: Props) {
  const [view, setView] = useState<{ year: number; month: number }>(() => {
    const d = selectedDate ?? new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })

  const firstDay = new Date(view.year, view.month, 1)
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const startDow = firstDay.getDay()

  const cells: Array<{ date: Date | null }> = []
  for (let i = 0; i < startDow; i++) cells.push({ date: null })
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(view.year, view.month, d) })
  }
  while (cells.length < 42) cells.push({ date: null })

  const today = new Date()
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()

  const prev = () =>
    setView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })
  const next = () =>
    setView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })

  return (
    <div className="bg-surface-card border border-line rounded-[5px] p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          <div className="relative">
            <select
              value={view.year}
              onChange={e => setView(v => ({ ...v, year: Number(e.target.value) }))}
              className="appearance-none h-7 pl-2 pr-6 text-[13px] font-medium text-ink-800 bg-surface-chip border border-line rounded-[4px] focus:outline-none focus:border-brand cursor-pointer"
            >
              {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="7" height="5" viewBox="0 0 8 5" fill="#999"><polygon points="0,0 8,0 4,5" /></svg>
            </span>
          </div>
          <div className="relative">
            <select
              value={view.month}
              onChange={e => setView(v => ({ ...v, month: Number(e.target.value) }))}
              className="appearance-none h-7 pl-2 pr-6 text-[13px] font-medium text-ink-800 bg-surface-chip border border-line rounded-[4px] focus:outline-none focus:border-brand cursor-pointer"
            >
              {MONTH_NAMES.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg width="7" height="5" viewBox="0 0 8 5" fill="#999"><polygon points="0,0 8,0 4,5" /></svg>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={prev}
            className="w-6 h-6 grid place-items-center text-[#909090] hover:text-ink-900"
            aria-label="이전 달"
          >
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 1L1 5l4 4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={next}
            className="w-6 h-6 grid place-items-center text-[#909090] hover:text-ink-900"
            aria-label="다음 달"
          >
            <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M1 1l4 4-4 4" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-[11px] text-[#8F8F8F] mb-1">
        {DOW.map(d => (
          <div key={d} className="text-center py-1">{d}</div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((c, i) => {
          if (!c.date) return <div key={i} className="h-6" />
          const isToday = isSameDay(c.date, today)
          const isSelected = selectedDate && isSameDay(c.date, selectedDate)
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect?.(c.date!)}
              className={`h-6 grid place-items-center text-[12px] rounded-[3px] transition-colors ${
                isSelected
                  ? 'bg-[#57988A] text-white'
                  : isToday
                  ? 'text-brand font-semibold'
                  : 'text-ink-900 hover:bg-surface-active'
              }`}
            >
              {c.date.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
