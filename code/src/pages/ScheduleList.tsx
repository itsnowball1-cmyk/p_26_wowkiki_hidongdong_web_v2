import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import MiniCalendar from '../components/MiniCalendar'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api, type AssignedChild, type ScheduleDetail, type ScheduleItem } from '../lib/api'

// ── 색상 팔레트 (아동별 순환 배정) ────────────────────────────────────────────
const PALETTE = [
  '#FFE672', '#00E8FD', '#FF9E9E', '#A3B0FE', '#B2DB7B',
  '#FFC197', '#C8BAFF', '#7DDFB8', '#FFB4C8', '#92D4FF'
]

// ── 타입 ─────────────────────────────────────────────────────────────────────
type ChildEntry = AssignedChild & { hex: string }

const START_HOUR = 8
const END_HOUR   = 24
const ROW_HEIGHT = 46

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ScheduleList() {
  const { go } = useRouter()
  const { user } = useAuth()
  const [view, setView] = useState<'주' | '월'>('주')
  const [referenceDate, setReferenceDate] = useState(new Date())
  const [children, setChildren]           = useState<ChildEntry[]>([])
  const [events, setEvents]               = useState<ScheduleItem[]>([])
  const [visibleIds, setVisibleIds]       = useState<Set<number>>(new Set())
  const [query, setQuery]                 = useState('')
  const [detail, setDetail]               = useState<ScheduleDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [childrenLoading, setChildrenLoading] = useState(true)
  const [toast, setToast] = useState('')
  const loadedRangeRef = useRef('')

  // 일정 등록 완료 토스트
  useEffect(() => {
    const msg = sessionStorage.getItem('schedule_toast')
    if (!msg) return
    sessionStorage.removeItem('schedule_toast')
    setToast(msg)
    const t = setTimeout(() => setToast(''), 3000)
    return () => clearTimeout(t)
  }, [])

  // 아동 목록 로드
  useEffect(() => {
    api.assignedChildren()
      .then(list => {
        const entries: ChildEntry[] = list.map((c, i) => ({ ...c, hex: PALETTE[i % PALETTE.length] }))
        setChildren(entries)
        setVisibleIds(new Set(entries.map(c => c.id)))
      })
      .catch(() => {})
      .finally(() => setChildrenLoading(false))
  }, [])

  // 주간 범위 계산
  const weekStart = useMemo(() => {
    const d = new Date(referenceDate)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    return d
  }, [referenceDate])

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    return d
  }, [weekStart])

  // 월 범위 계산
  const monthStart = useMemo(() => {
    const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
    return d
  }, [referenceDate])

  const monthEnd = useMemo(() => {
    return new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1)
  }, [referenceDate])

  // 스케줄 로드 (주/월 전환 시 범위 변경)
  const loadSchedules = useCallback((from: Date, to: Date) => {
    const key = `${toDateStr(from)}-${toDateStr(to)}`
    if (loadedRangeRef.current === key) return
    loadedRangeRef.current = key
    api.schedules(toDateStr(from), toDateStr(to))
      .then(setEvents)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (view === '주') loadSchedules(weekStart, weekEnd)
    else              loadSchedules(monthStart, monthEnd)
  }, [view, weekStart, weekEnd, monthStart, monthEnd, loadSchedules])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    })
  }, [weekStart])

  const monthLabel = `${referenceDate.getFullYear()}년 ${referenceDate.getMonth() + 1}월`
  const hours      = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

  const toggleChild = (id: number) => {
    setVisibleIds(p => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const childById = useCallback((idx: number) => children.find(c => c.id === idx), [children])

  const filteredChildren = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return children
    return children.filter(c =>
      (c.child_name ?? '').toLowerCase().includes(q) ||
      c.identifier.toLowerCase().includes(q)
    )
  }, [children, query])

  const filteredEvents = useMemo(() =>
    events.filter(e => visibleIds.has(e.child_idx)),
    [events, visibleIds]
  )

  const prev = () => {
    const d = new Date(referenceDate)
    if (view === '주') d.setDate(d.getDate() - 7)
    else d.setMonth(d.getMonth() - 1)
    setReferenceDate(d)
  }
  const next = () => {
    const d = new Date(referenceDate)
    if (view === '주') d.setDate(d.getDate() + 7)
    else d.setMonth(d.getMonth() + 1)
    setReferenceDate(d)
  }

  const openDetail = (eventId: number) => {
    setDetailLoading(true)
    setDetail(null)
    api.scheduleDetail(eventId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }

  const handleDelete = async (id: number) => {
    if (!confirm('일정을 삭제하시겠습니까?')) return
    await api.deleteSchedule(id).catch(() => {})
    setDetail(null)
    loadedRangeRef.current = ''
    const from = view === '주' ? weekStart : monthStart
    const to   = view === '주' ? weekEnd   : monthEnd
    api.schedules(toDateStr(from), toDateStr(to)).then(setEvents).catch(() => {})
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {user?.role === 'admin' ? <AdminSidebar /> : <Sidebar />}

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-8 py-6 flex flex-col gap-6 overflow-hidden">
          {/* Header bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <button onClick={prev} className="w-7 h-7 grid place-items-center text-[#909090] hover:text-ink-900">
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M7 1L1 7l6 6" strokeLinecap="round" />
                  </svg>
                </button>
                <h1 className="text-[24px] text-[#3E3E3E]">{monthLabel}</h1>
                <button onClick={next} className="w-7 h-7 grid place-items-center text-[#909090] hover:text-ink-900">
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M1 1l6 6-6 6" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setView(v => v === '주' ? '월' : '주')}
              className="h-[34px] px-5 rounded-[5px] border border-brand text-brand bg-white text-[15px] font-medium hover:bg-brand hover:text-white transition-colors"
            >
              {view === '주' ? '월' : '주'}
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 flex gap-6 overflow-hidden">
            {/* Left rail */}
            <aside className="w-[240px] shrink-0 flex flex-col gap-4 overflow-y-auto">
              <button
                type="button"
                onClick={() => go({ name: 'schedule-new' })}
                className="w-full h-[42px] rounded-[5px] bg-brand text-white text-[15px] font-medium hover:opacity-90 transition"
              >
                일정 만들기
              </button>

              <MiniCalendar selectedDate={referenceDate} onSelect={setReferenceDate} />

              <div className="relative">
                <input
                  type="search"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="아동 이름이나 아동식별코드 검색"
                  className="w-full h-[42px] pl-3 pr-10 rounded-[5px] border border-brand text-[12px] placeholder:text-[#606060] focus:outline-none"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-brand pointer-events-none" width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" />
                </svg>
              </div>

              <ul className="space-y-2">
                {childrenLoading && Array.from({ length: 4 }).map((_, i) => (
                  <li key={i}>
                    <div className="flex items-center gap-3 px-3 py-2.5 rounded-[8px] animate-pulse">
                      <div className="w-3 h-3 rounded-full bg-line shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-line rounded w-20" />
                        <div className="h-2 bg-line rounded w-14" />
                      </div>
                    </div>
                  </li>
                ))}
                {!childrenLoading && filteredChildren.length === 0 && (
                  <li className="text-[12px] text-ink-400 text-center py-4">
                    {children.length === 0 ? '배정된 아동이 없습니다.' : '검색 결과가 없습니다.'}
                  </li>
                )}
                {!childrenLoading && filteredChildren.map(c => {
                  const selected = visibleIds.has(c.id)
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => toggleChild(c.id)}
                        aria-pressed={selected}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[8px] border-2 transition-all text-left ${
                          selected ? 'shadow-sm font-semibold' : 'border-transparent bg-surface opacity-55 hover:opacity-90'
                        }`}
                        style={selected ? { backgroundColor: `${c.hex}33`, borderColor: c.hex } : undefined}
                      >
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.hex }} />
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] text-[#3E3E3E] truncate">{c.child_name ?? c.identifier}</span>
                          <span className="block text-[10px] text-ink-500 truncate">{c.identifier}</span>
                        </span>
                        {selected && (
                          <svg className="w-4 h-4 shrink-0 text-ink-900" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 8l3.5 3.5L13 5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </aside>

            {/* Calendar */}
            {view === '주' ? (
              <WeekView
                weekDays={weekDays}
                hours={hours}
                events={filteredEvents}
                childById={childById}
                onEventClick={openDetail}
              />
            ) : (
              <MonthView
                referenceDate={referenceDate}
                events={filteredEvents}
                childById={childById}
                onEventClick={openDetail}
              />
            )}
          </div>
        </main>
      </div>

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#333] text-white px-6 py-3.5 rounded-[10px] text-[15px] shadow-xl z-50 whitespace-nowrap">
          {toast}
        </div>
      )}

      {/* 상세 모달 */}
      {(detail || detailLoading) && (
        <ScheduleDetailModal
          detail={detail}
          loading={detailLoading}
          onClose={() => setDetail(null)}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

/* ─── Week View ──────────────────────────────────────────────────────────── */
function WeekView({
  weekDays, hours, events, childById, onEventClick
}: {
  weekDays: Date[]
  hours: number[]
  events: ScheduleItem[]
  childById: (idx: number) => (ReturnType<typeof Array.prototype.find> & { hex: string; child_name: string | null; identifier: string }) | undefined
  onEventClick: (id: number) => void
}) {
  const eventsByDay = useMemo(() => {
    const map = new Map<number, ScheduleItem[]>()
    for (const e of events) {
      const dt = new Date(e.start_datetime)
      const dow = dt.getDay()
      if (!map.has(dow)) map.set(dow, [])
      map.get(dow)!.push(e)
    }
    return map
  }, [events])

  return (
    <div className="flex-1 min-w-0 overflow-auto bg-surface-card border border-line rounded-md">
      <div className="min-w-[700px]">
        {/* Day headers */}
        <div className="grid grid-cols-[60px_repeat(7,1fr)] sticky top-0 z-10 bg-surface-card border-b border-line">
          <div className="text-[12px] text-ink-900 text-center py-3">시간</div>
          {weekDays.map((d, i) => (
            <div key={i} className="text-center py-3 text-[15px] text-ink-900 border-l border-line">
              {['일', '월', '화', '수', '목', '금', '토'][i]} {d.getDate()}
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="relative grid grid-cols-[60px_repeat(7,1fr)]">
          <div>
            {hours.map(h => (
              <div key={h} className="h-[46px] text-[12px] text-ink-900 text-center pt-1 border-t border-line first:border-t-0">
                {h}시
              </div>
            ))}
          </div>

          {weekDays.map((_, dayIdx) => {
            const dayEvents = eventsByDay.get(dayIdx) ?? []
            return (
              <div key={dayIdx} className="relative border-l border-line">
                {hours.map(h => (
                  <div key={h} className="h-[46px] border-t border-line first:border-t-0" />
                ))}
                {dayEvents.map(e => {
                  const c = childById(e.child_idx)
                  if (!c) return null
                  const hex = (c as { hex: string }).hex
                  const dt = new Date(e.start_datetime)
                  const dtEnd = new Date(e.end_datetime)
                  const startH = dt.getHours() + dt.getMinutes() / 60
                  const endH   = dtEnd.getHours() + dtEnd.getMinutes() / 60
                  const top    = (startH - START_HOUR) * ROW_HEIGHT
                  const height = (endH - startH) * ROW_HEIGHT
                  const timeStr = `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`
                  const isShort = height < 30
                  const name = (c as { child_name: string | null; identifier: string }).child_name ?? (c as { identifier: string }).identifier
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => onEventClick(e.id)}
                      className={`absolute left-1 right-1 rounded-[3px] text-ink-900 hover:opacity-90 transition border-l-4 shadow-sm overflow-hidden text-left ${
                        isShort ? 'text-[11px] px-2 py-0.5 flex items-center' : 'text-[12px] px-2 py-1'
                      }`}
                      style={{
                        top,
                        height: Math.max(height - 2, 18),
                        backgroundColor: `${hex}66`,
                        borderLeftColor: hex
                      }}
                    >
                      <span className="block truncate leading-tight">
                        {name} {timeStr}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── Month View ─────────────────────────────────────────────────────────── */
function MonthView({
  referenceDate, events, childById, onEventClick
}: {
  referenceDate: Date
  events: ScheduleItem[]
  childById: (idx: number) => ({ hex: string; child_name: string | null; identifier: string }) | undefined
  onEventClick: (id: number) => void
}) {
  const year  = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startDow    = new Date(year, month, 1).getDay()
  const prevDays    = new Date(year, month, 0).getDate()

  type Cell = { date: Date; inMonth: boolean }
  const cells: Cell[] = []
  for (let i = startDow - 1; i >= 0; i--)
    cells.push({ date: new Date(year, month - 1, prevDays - i), inMonth: false })
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ date: new Date(year, month, d), inMonth: true })
  let nd = 1
  while (cells.length < 42)
    cells.push({ date: new Date(year, month + 1, nd++), inMonth: false })

  const today = new Date()
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

  const eventsByDate = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>()
    for (const e of events) {
      const key = e.start_datetime.slice(0, 10)
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(e)
    }
    return map
  }, [events])

  return (
    <div className="flex-1 min-w-0 overflow-auto bg-surface-card border border-line rounded-md">
      <div className="grid grid-cols-7 border-b border-line">
        {['일', '월', '화', '수', '목', '금', '토'].map(d => (
          <div key={d} className="text-center py-3 text-[14px] font-medium text-ink-900 border-l border-line first:border-l-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 h-[calc(100%-44px)] min-h-[640px]">
        {cells.map((cell, i) => {
          const key = toDateStr(cell.date)
          const dayEvents = eventsByDate.get(key) ?? []
          const isToday = isSameDay(cell.date, today)
          return (
            <div
              key={i}
              className={`border-l border-t border-line p-1.5 overflow-hidden ${i % 7 === 0 ? 'border-l-0' : ''} ${cell.inMonth ? 'bg-white' : 'bg-surface'}`}
            >
              <div className="mb-1">
                <span className={`text-[12px] ${cell.inMonth ? 'text-ink-900' : 'text-ink-300'} ${isToday ? 'inline-grid place-items-center w-5 h-5 rounded-full bg-brand text-white' : ''}`}>
                  {cell.date.getDate()}
                </span>
              </div>
              {cell.inMonth && (
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map(e => {
                    const c = childById(e.child_idx)
                    if (!c) return null
                    const dt = new Date(e.start_datetime)
                    const timeStr = `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`
                    const name = c.child_name ?? c.identifier
                    return (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => onEventClick(e.id)}
                        className="w-full text-left text-[10px] text-ink-900 px-1.5 py-0.5 rounded-[2px] truncate hover:opacity-90 border-l-2"
                        style={{ backgroundColor: `${c.hex}55`, borderLeftColor: c.hex }}
                      >
                        {timeStr} {name}
                      </button>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-ink-500 px-1">+{dayEvents.length - 3}건</div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── Schedule Detail Modal ──────────────────────────────────────────────── */
function ScheduleDetailModal({
  detail, loading, onClose, onDelete
}: {
  detail: ScheduleDetail | null
  loading: boolean
  onClose: () => void
  onDelete: (id: number) => void
}) {
  const formatDt = (iso: string) => {
    const d = new Date(iso)
    const days = ['일', '월', '화', '수', '목', '금', '토']
    const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${days[d.getDay()]})`
    const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
    return { date, time }
  }

  const startInfo = detail ? formatDt(detail.start_datetime) : null
  const endTime   = detail ? new Date(detail.end_datetime) : null
  const endTimeStr = endTime ? `${endTime.getHours()}:${String(endTime.getMinutes()).padStart(2, '0')}` : ''
  const typeLabel  = detail?.schedule_type === '1' ? '진료' : '치료'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-[10px] shadow-xl w-[420px] p-7 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 grid place-items-center text-ink-400 hover:text-ink-900 transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 1l12 12M13 1L1 13" strokeLinecap="round" />
          </svg>
        </button>

        <h2 className="text-[20px] font-bold text-ink-900 mb-6">일정 정보</h2>

        {loading && (
          <div className="py-10 text-center text-ink-400 text-[14px]">불러오는 중…</div>
        )}

        {!loading && detail && (
          <div className="space-y-4">
            <InfoRow label="아동">{detail.child_name ?? detail.child_member_id}</InfoRow>
            <InfoRow label="식별코드">{detail.child_member_id}</InfoRow>
            <InfoRow label="구분">{typeLabel}</InfoRow>
            <InfoRow label="날짜">{startInfo!.date}</InfoRow>
            <InfoRow label="시간">{startInfo!.time} ~ {endTimeStr}</InfoRow>
            {detail.doctor_name && <InfoRow label="담당의사">{detail.doctor_name}</InfoRow>}
            {detail.therapist_name && <InfoRow label="담당치료사">{detail.therapist_name}</InfoRow>}

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 h-11 rounded-[5px] border border-line text-ink-700 text-[15px] font-medium hover:border-ink-500 transition-colors"
              >
                닫기
              </button>
              <button
                type="button"
                onClick={() => onDelete(detail.id)}
                className="flex-1 h-11 rounded-[5px] bg-brand-danger text-white text-[15px] font-medium hover:opacity-90 transition"
              >
                삭제
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="w-[80px] shrink-0 text-[13px] text-ink-400 pt-0.5">{label}</span>
      <span className="text-[15px] text-ink-900 font-medium">{children}</span>
    </div>
  )
}
