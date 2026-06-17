import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [quickAdd, setQuickAdd] = useState<{
    date: Date; hour: number
    editId?: number
    prefill?: { childId: number; scheduleType: '1' | '2'; startTime: string; endTime: string }
  } | null>(null)
  const loadedRangeRef = useRef('')
  const toastTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast(msg)
    toastTimerRef.current = setTimeout(() => setToast(''), 2000)
  }, [])

  // ScheduleNew에서 등록 후 돌아올 때 세션스토리지 토스트 처리
  useEffect(() => {
    const msg = sessionStorage.getItem('schedule_toast')
    if (!msg) return
    sessionStorage.removeItem('schedule_toast')
    showToast(msg)
  }, [showToast])

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
    const isRepeat = detail && detail.repeat_group_id && detail.group_count > 1
    let deleteAll = false
    if (isRepeat) {
      const answer = window.confirm(
        `이 일정은 반복 일정 중 하나입니다 (총 ${detail.group_count}건).\n\n` +
        `확인 → 이번 일정만 삭제\n취소 → 반복 일정 전체 삭제`
      )
      if (answer === false) {
        if (!window.confirm(`반복 일정 전체(${detail.group_count}건)를 삭제하시겠습니까?`)) return
        deleteAll = true
      }
    } else {
      if (!confirm('일정을 삭제하시겠습니까?')) return
    }
    await api.deleteSchedule(id, deleteAll).catch(() => {})
    setDetail(null)
    loadedRangeRef.current = ''
    const from = view === '주' ? weekStart : monthStart
    const to   = view === '주' ? weekEnd   : monthEnd
    api.schedules(toDateStr(from), toDateStr(to)).then(setEvents).catch(() => {})
    showToast(deleteAll ? `반복 일정 ${detail?.group_count ?? ''}건이 삭제되었습니다.` : '일정이 삭제되었습니다.')
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
                onClick={() => setQuickAdd({ date: referenceDate, hour: 9 })}
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

              {/* 아동 섹션 헤더 — 전체 선택 체크박스 내장 */}
              <div>
                {(() => {
                  const allSelected = children.length > 0 && children.every(c => visibleIds.has(c.id))
                  const someSelected = !allSelected && children.some(c => visibleIds.has(c.id))
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (allSelected) setVisibleIds(new Set())
                        else setVisibleIds(new Set(children.map(c => c.id)))
                      }}
                      className="w-full flex items-center gap-3 px-1 py-1.5 rounded-[6px] hover:bg-surface transition-colors"
                    >
                      <span
                        className="w-5 h-5 rounded-[4px] shrink-0 flex items-center justify-center transition-colors"
                        style={{ backgroundColor: allSelected ? '#555' : someSelected ? '#55555566' : '#55555533' }}
                      >
                        {allSelected && (
                          <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                            <path d="M1 4.5l3 3L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        {someSelected && (
                          <svg width="9" height="2" viewBox="0 0 9 2" fill="none">
                            <path d="M1 1h7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        )}
                      </span>
                      <span className="text-[14px] font-medium text-ink-900">아동</span>
                    </button>
                  )
                })()}

                {/* 구분선 */}
                <div className="mt-1.5 mb-1 border-t border-line" />

                <ul className="space-y-0.5">
                  {childrenLoading && Array.from({ length: 4 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3 px-1 py-2 animate-pulse">
                      <div className="w-5 h-5 rounded-[4px] bg-line shrink-0" />
                      <div className="h-3 bg-line rounded w-20" />
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
                          className="w-full flex items-center gap-3 px-1 py-2 rounded-[6px] text-left hover:bg-surface transition-colors"
                        >
                          <span
                            className="w-5 h-5 rounded-[4px] shrink-0 flex items-center justify-center transition-colors"
                            style={{ backgroundColor: selected ? c.hex : `${c.hex}55` }}
                          >
                            {selected && (
                              <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                <path d="M1 4.5l3 3L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                          <span className={`text-[13px] truncate ${selected ? 'text-[#3E3E3E] font-medium' : 'text-ink-400'}`}>
                            {c.child_name ?? c.identifier}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </aside>

            {/* Calendar */}
            {view === '주' ? (
              <WeekView
                weekDays={weekDays}
                hours={hours}
                events={filteredEvents}
                childById={childById}
                onEventClick={openDetail}
                onAddClick={(date, hour) => setQuickAdd({ date, hour })}
              />
            ) : (
              <MonthView
                referenceDate={referenceDate}
                events={filteredEvents}
                childById={childById}
                onEventClick={openDetail}
                onAddClick={date => setQuickAdd({ date, hour: 9 })}
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
          onEdit={() => {
            if (!detail) return
            const dt  = new Date(detail.start_datetime)
            const dtE = new Date(detail.end_datetime)
            const st  = `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`
            const et  = `${dtE.getHours()}:${String(dtE.getMinutes()).padStart(2, '0')}`
            setDetail(null)
            setQuickAdd({
              date: dt,
              hour: dt.getHours(),
              editId: detail.id,
              prefill: {
                childId: detail.child_idx,
                scheduleType: (detail.schedule_type === '1' || detail.schedule_type === '2') ? detail.schedule_type : '2',
                startTime: st,
                endTime: et,
              }
            })
          }}
        />
      )}

      {/* 빠른 일정 등록 팝업 */}
      {quickAdd && (
        <ScheduleQuickAddModal
          date={quickAdd.date}
          hour={quickAdd.hour}
          editId={quickAdd.editId}
          prefill={quickAdd.prefill}
          childList={children}
          onClose={() => setQuickAdd(null)}
          onGoToDetail={(prefill) => {
            sessionStorage.setItem('schedule_prefill', JSON.stringify(prefill))
            setQuickAdd(null)
            go({ name: 'schedule-new' })
          }}
          onCreated={(isEdit) => {
            setQuickAdd(null)
            loadedRangeRef.current = ''
            const from = view === '주' ? weekStart : monthStart
            const to   = view === '주' ? weekEnd   : monthEnd
            api.schedules(toDateStr(from), toDateStr(to)).then(setEvents).catch(() => {})
            showToast(isEdit ? '일정이 수정되었습니다.' : '일정이 등록되었습니다.')
          }}
        />
      )}
    </div>
  )
}

/* ─── 겹치는 이벤트 그룹핑 ───────────────────────────────────────────────── */
function groupOverlapping(events: ScheduleItem[]): ScheduleItem[][] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.start_datetime).getTime() - new Date(b.start_datetime).getTime()
  )
  const groups: { items: ScheduleItem[]; maxEnd: number }[] = []
  for (const ev of sorted) {
    const start = new Date(ev.start_datetime).getTime()
    const end   = new Date(ev.end_datetime).getTime()
    const hit   = groups.find(g => g.maxEnd > start)
    if (hit) {
      hit.items.push(ev)
      hit.maxEnd = Math.max(hit.maxEnd, end)
    } else {
      groups.push({ items: [ev], maxEnd: end })
    }
  }
  return groups.map(g => g.items)
}

/* ─── Week View ──────────────────────────────────────────────────────────── */
function WeekView({
  weekDays, hours, events, childById, onEventClick, onAddClick
}: {
  weekDays: Date[]
  hours: number[]
  events: ScheduleItem[]
  childById: (idx: number) => ChildEntry | undefined
  onEventClick: (id: number) => void
  onAddClick: (date: Date, hour: number) => void
}) {
  const [openPopover, setOpenPopover] = useState<string | null>(null)
  const [hoveredCell, setHoveredCell] = useState<{ dayIdx: number; hour: number } | null>(null)

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
    <div
      className="flex-1 min-w-0 overflow-auto bg-surface-card border border-line rounded-md"
      onClick={() => setOpenPopover(null)}
    >
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

          {weekDays.map((day, dayIdx) => {
            const dayEvents = eventsByDay.get(dayIdx) ?? []
            const groups    = groupOverlapping(dayEvents)
            return (
              <div key={dayIdx} className="relative border-l border-line">
                {hours.map(h => {
                  const isHovered = hoveredCell?.dayIdx === dayIdx && hoveredCell?.hour === h
                  return (
                    <div
                      key={h}
                      className={`h-[46px] border-t border-line first:border-t-0 relative transition-colors ${isHovered ? 'bg-brand/[0.06]' : ''}`}
                      onMouseEnter={() => setHoveredCell({ dayIdx, hour: h })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      {isHovered && (
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onAddClick(day, h) }}
                          className="absolute inset-0 flex items-center justify-center text-brand opacity-70 hover:opacity-100 transition-opacity"
                        >
                          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M9 3v12M3 9h12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                })}
                {groups.map((group, groupIdx) => {
                  const primary  = group[0]
                  const extras   = group.slice(1)
                  const c        = childById(primary.child_idx)
                  if (!c) return null
                  const { hex }  = c
                  const dt       = new Date(primary.start_datetime)
                  const dtEnd    = new Date(primary.end_datetime)
                  const startH   = dt.getHours() + dt.getMinutes() / 60
                  const endH     = dtEnd.getHours() + dtEnd.getMinutes() / 60
                  const top      = (startH - START_HOUR) * ROW_HEIGHT
                  const height   = Math.max((endH - startH) * ROW_HEIGHT - 2, 22)
                  const timeStr  = `${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`
                  const isShort  = height < 30
                  const name     = c.child_name ?? c.identifier
                  const key      = `${dayIdx}-${groupIdx}`

                  return (
                    <Fragment key={primary.id}>
                      {/* 이벤트 카드 */}
                      <div
                        className="absolute left-1 right-1 overflow-hidden rounded-[3px] border-l-4 shadow-sm flex items-stretch"
                        style={{ top, height, borderLeftColor: hex }}
                      >
                        {/* 메인 클릭 영역 — 배경색은 여기에만, 배지 시작 지점에서 끊김 */}
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); onEventClick(primary.id) }}
                          className={`flex-1 min-w-0 text-ink-900 hover:opacity-90 transition text-left ${
                            isShort ? 'text-[11px] px-2 flex items-center' : 'text-[12px] px-2 py-1'
                          }`}
                          style={{ backgroundColor: `${hex}66` }}
                        >
                          <span className="block truncate leading-tight">{name} {timeStr}</span>
                        </button>

                        {/* +N개 배지 */}
                        {extras.length > 0 && (
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation()
                              setOpenPopover(openPopover === key ? null : key)
                            }}
                            className="shrink-0 self-center mr-0 text-[11px] bg-black/30 hover:bg-black/50 text-white px-2 py-1 rounded-[4px] font-semibold leading-none"
                          >
                            +{extras.length}개
                          </button>
                        )}
                      </div>

                      {/* 팝오버 — overflow-hidden 바깥 형제 요소로 배치 */}
                      {extras.length > 0 && openPopover === key && (
                        <div
                          className="absolute right-1 z-30 bg-white border border-line rounded-[8px] shadow-xl min-w-[170px] py-1 overflow-hidden"
                          style={{ top, transform: 'translateY(calc(-100% - 4px))' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {group.map(ev => {
                            const ec   = childById(ev.child_idx)
                            if (!ec) return null
                            const edt  = new Date(ev.start_datetime)
                            const edtE = new Date(ev.end_datetime)
                            const etS  = `${edt.getHours()}:${String(edt.getMinutes()).padStart(2, '0')}`
                            const etE  = `${edtE.getHours()}:${String(edtE.getMinutes()).padStart(2, '0')}`
                            const eName = ec.child_name ?? ec.identifier
                            return (
                              <button
                                key={ev.id}
                                type="button"
                                onClick={() => { setOpenPopover(null); onEventClick(ev.id) }}
                                className="w-full text-left text-[12px] px-3 py-2 hover:bg-surface flex items-center gap-2 transition-colors"
                              >
                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ec.hex }} />
                                <span className="flex-1 truncate font-medium">{eName}</span>
                                <span className="text-ink-400 shrink-0 text-[11px]">{etS}~{etE}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </Fragment>
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
  referenceDate, events, childById, onEventClick, onAddClick
}: {
  referenceDate: Date
  events: ScheduleItem[]
  childById: (idx: number) => ({ hex: string; child_name: string | null; identifier: string }) | undefined
  onEventClick: (id: number) => void
  onAddClick: (date: Date) => void
}) {
  const [hoveredCell, setHoveredCell] = useState<string | null>(null)
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
          const isHovered = hoveredCell === key && cell.inMonth
          return (
            <div
              key={i}
              className={`border-l border-t border-line p-1.5 overflow-hidden relative transition-colors ${i % 7 === 0 ? 'border-l-0' : ''} ${cell.inMonth ? (isHovered ? 'bg-brand/[0.04]' : 'bg-white') : 'bg-surface'}`}
              onMouseEnter={() => cell.inMonth && setHoveredCell(key)}
              onMouseLeave={() => setHoveredCell(null)}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={`text-[12px] ${cell.inMonth ? 'text-ink-900' : 'text-ink-300'} ${isToday ? 'inline-grid place-items-center w-5 h-5 rounded-full bg-brand text-white' : ''}`}>
                  {cell.date.getDate()}
                </span>
                {isHovered && (
                  <button
                    type="button"
                    onClick={() => onAddClick(cell.date)}
                    className="w-5 h-5 flex items-center justify-center rounded-full text-brand hover:bg-brand hover:text-white transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 1v10M1 6h10" />
                    </svg>
                  </button>
                )}
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
  detail, loading, onClose, onDelete, onEdit
}: {
  detail: ScheduleDetail | null
  loading: boolean
  onClose: () => void
  onDelete: (id: number) => void
  onEdit: () => void
}) {
  const days = ['일', '월', '화', '수', '목', '금', '토']

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
  }
  const formatHour = (iso: string) => {
    const d = new Date(iso)
    const m = d.getMinutes()
    return m === 0 ? `${d.getHours()}시` : `${d.getHours()}시 ${String(m).padStart(2, '0')}분`
  }

  const rows = detail ? [
    { label: '날짜',    value: formatDate(detail.start_datetime) },
    { label: '시간',    value: `${formatHour(detail.start_datetime)}~${formatHour(detail.end_datetime)}` },
    { label: '아동',    value: `${detail.child_name ?? '-'}(${detail.child_member_id})` },
    { label: '담당의사',  value: detail.doctor_name ?? '-' },
    { label: '담당치료사', value: detail.therapist_name ?? '-' },
    { label: '주기', value: detail.repeat_group_id && detail.group_count > 1 ? `반복 일정 (총 ${detail.group_count}건)` : '이번만' },
  ] : []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-[10px] shadow-xl w-[550px] relative">
        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-8 right-8 grid place-items-center text-ink-400 hover:text-ink-900 transition-colors"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M1 1l13 13M14 1L1 14" />
          </svg>
        </button>

        {/* 제목 */}
        <h2 className="text-[18px] font-semibold text-black px-[59px] pt-[52px] pb-[20px]">
          일정 세부사항
        </h2>

        {loading && (
          <div className="px-[59px] py-12 text-center text-ink-400 text-[14px]">불러오는 중…</div>
        )}

        {!loading && detail && (
          <>
            {/* 테이블 */}
            <div className="mx-[59px] border border-[#686868] rounded-[2px] overflow-hidden">
              {rows.map((row, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-[143px_1fr] ${i < rows.length - 1 ? 'border-b border-[#686868]' : ''}`}
                  style={{ minHeight: '46px' }}
                >
                  <div className="bg-[#F5F5F5] border-r border-[#686868] flex items-center px-[35px] text-[15px] font-medium text-black shrink-0">
                    {row.label}
                  </div>
                  <div className="flex items-center px-[37px] text-[15px] text-black">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>

            {/* 버튼 */}
            <div className="flex justify-center gap-[16px] py-[32px]">
              <button
                type="button"
                onClick={onEdit}
                className="w-[125px] h-[40px] rounded-[5px] bg-[#005744] text-white text-[15px] font-medium hover:bg-[#004535] transition-colors"
              >
                편집
              </button>
              <button
                type="button"
                onClick={() => onDelete(detail.id)}
                className="w-[125px] h-[40px] rounded-[5px] border border-[#005744] text-black text-[15px] font-medium hover:bg-[#005744]/5 transition-colors"
              >
                삭제
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── 빠른 일정 등록 팝업 ────────────────────────────────────────────────── */
const QUICK_TIME_OPTIONS = (() => {
  const out: string[] = []
  for (let h = 8; h <= 23; h++) { out.push(`${h}:00`); out.push(`${h}:30`) }
  return out
})()

const QUICK_TIME_KEY = 'hbd_quick_times'

function loadSavedTimes(): { startTime: string } | null {
  try {
    const s = localStorage.getItem(QUICK_TIME_KEY)
    return s ? JSON.parse(s) : null
  } catch { return null }
}

function addThirtyMin(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const total = h * 60 + m + 30
  const nh = Math.floor(total / 60)
  const nm = total % 60
  if (nh > 23) return '23:30'
  return `${nh}:${nm === 0 ? '00' : '30'}`
}

type PrefillData = {
  date: string
  childId: number | ''
  scheduleType: '1' | '2'
  startTime: string
  endTime: string
}

function ScheduleQuickAddModal({
  date, hour, editId, prefill, childList, onClose, onCreated, onGoToDetail
}: {
  date: Date
  hour: number
  editId?: number
  prefill?: { childId: number; scheduleType: '1' | '2'; startTime: string; endTime: string }
  childList: ChildEntry[]
  onClose: () => void
  onCreated: (isEdit: boolean) => void
  onGoToDetail: (prefill: PrefillData) => void
}) {
  const isEditMode = editId !== undefined

  const saved = loadSavedTimes()
  const defaultStart = prefill?.startTime ?? saved?.startTime ?? `${hour}:00`
  const defaultEnd   = prefill?.endTime   ?? addThirtyMin(defaultStart)

  const [childIdx,      setChildIdx]      = useState<number | ''>( prefill?.childId ?? childList[0]?.id ?? '')
  const [scheduleType,  setScheduleType]  = useState<'2' | '1'>(prefill?.scheduleType ?? '2')
  const [startTime,     setStartTime]     = useState(defaultStart)
  const [endTime,       setEndTime]       = useState(defaultEnd)
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState('')
  const [childSearch,   setChildSearch]   = useState('')
  const [dropdownOpen,  setDropdownOpen]  = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selectedChild = childList.find(c => c.id === childIdx)
  const filteredChildren = childSearch.trim()
    ? childList.filter(c =>
        (c.child_name ?? '').includes(childSearch) ||
        c.identifier.includes(childSearch)
      )
    : childList

  const saveAndSetStart = (t: string) => {
    setStartTime(t)
    setEndTime(addThirtyMin(t))
    try { localStorage.setItem(QUICK_TIME_KEY, JSON.stringify({ startTime: t })) } catch {}
  }
  const saveAndSetEnd = (t: string) => {
    setEndTime(t)
  }

  const [selectedDate, setSelectedDate] = useState(date)

  const DAYS = ['일', '월', '화', '수', '목', '금', '토']
  const dateLabel = `${selectedDate.getFullYear()}년 ${selectedDate.getMonth() + 1}월 ${selectedDate.getDate()}일 ${DAYS[selectedDate.getDay()]}요일`
  const dateInputVal = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`

  const toDatetime = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    const d = new Date(selectedDate)
    d.setHours(h, m, 0, 0)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
  }

  const { user } = useAuth()

  const handleSubmit = async () => {
    if (childIdx === '') { setError('아동을 선택해주세요.'); return }
    const child = childList.find(c => c.id === childIdx)
    if (!child) return
    setError('')
    setSubmitting(true)
    try {
      if (isEditMode) await api.deleteSchedule(editId!)
      await api.createSchedule({
        child_idx:      childIdx as number,
        start_datetime: toDatetime(startTime),
        end_datetime:   toDatetime(endTime),
        schedule_type:  scheduleType,
        doctor_code:  user?.role === 'doctor'    ? (user.code ?? user.id) : (child.doctor_code  ?? undefined),
        teacher_code: user?.role === 'therapist' ? (user.code ?? user.id) : (child.teacher_code ?? undefined),
      })
      onCreated(isEditMode)
    } catch (err) {
      setError(err instanceof Error ? err.message : (isEditMode ? '일정 수정에 실패했습니다.' : '일정 등록에 실패했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-[10px] shadow-xl w-[440px]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-8 pt-8 pb-5">
          <h2 className="text-[17px] font-semibold text-black">{isEditMode ? '일정 수정' : '일정 등록'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid place-items-center text-ink-400 hover:text-ink-900 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l13 13M14 1L1 14" />
            </svg>
          </button>
        </div>

        {/* 날짜 선택 */}
        <div className="px-8 pb-5">
          <div className="relative flex items-center bg-surface rounded-[6px] px-4 py-2.5 cursor-pointer group">
            <span className="flex-1 text-[14px] text-ink-900">{dateLabel}</span>
            <svg className="shrink-0 text-ink-400 group-hover:text-ink-900 transition-colors" width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <rect x="1" y="2" width="13" height="12" rx="1.5" />
              <path d="M1 6h13M5 1v2M10 1v2" />
            </svg>
            <input
              type="date"
              value={dateInputVal}
              onChange={e => { if (e.target.value) setSelectedDate(new Date(e.target.value + 'T12:00:00')) }}
              className="absolute inset-0 opacity-0 w-full cursor-pointer"
            />
          </div>
        </div>

        {/* 폼 */}
        <div className="px-8 space-y-4 pb-6">
          {/* 아동 선택 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink-900">아동</label>
            <div ref={dropdownRef} className="relative">
              <button
                type="button"
                onClick={() => { setDropdownOpen(o => !o); setChildSearch('') }}
                className={`w-full h-[40px] rounded-[6px] border px-3 text-[14px] text-left flex items-center justify-between transition-colors ${dropdownOpen ? 'border-brand' : 'border-line'} ${selectedChild ? 'text-ink-900' : 'text-ink-400'}`}
              >
                <span className="truncate">{selectedChild ? (selectedChild.child_name ?? selectedChild.identifier) : '아동 선택'}</span>
                <svg className={`shrink-0 ml-2 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M2 4l4 4 4-4" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute z-10 top-[calc(100%+4px)] left-0 right-0 bg-white border border-line rounded-[6px] shadow-lg overflow-hidden">
                  <div className="p-2 border-b border-line">
                    <input
                      autoFocus
                      type="text"
                      value={childSearch}
                      onChange={e => setChildSearch(e.target.value)}
                      placeholder="이름 또는 코드 검색"
                      className="w-full h-[32px] px-2.5 rounded-[4px] border border-line text-[13px] focus:outline-none focus:border-brand"
                    />
                  </div>
                  <ul className="max-h-[180px] overflow-y-auto">
                    {filteredChildren.length === 0 && (
                      <li className="text-[13px] text-ink-400 text-center py-4">검색 결과가 없습니다.</li>
                    )}
                    {filteredChildren.map(c => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => { setChildIdx(c.id); setDropdownOpen(false) }}
                          className={`w-full text-left px-3 py-2 text-[13px] hover:bg-surface transition-colors flex items-center gap-2 ${c.id === childIdx ? 'text-brand font-medium bg-brand/5' : 'text-ink-900'}`}
                        >
                          <span className="truncate">{c.child_name ?? c.identifier}</span>
                          {c.child_name && <span className="text-ink-400 text-[11px] shrink-0">{c.identifier}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* 일정 유형 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink-900">유형</label>
            <div className="flex gap-3">
              {([['2', '치료'], ['1', '진료']] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setScheduleType(val)}
                  className={`flex-1 h-[40px] rounded-[6px] border text-[14px] font-medium transition-colors ${
                    scheduleType === val
                      ? 'border-brand bg-brand text-white'
                      : 'border-line text-ink-900 hover:border-brand hover:text-brand'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 시간 */}
          <div className="flex gap-3">
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-ink-900">시작</label>
              <select
                value={startTime}
                onChange={e => saveAndSetStart(e.target.value)}
                className="h-[40px] rounded-[6px] border border-line px-3 text-[14px] text-ink-900 focus:outline-none focus:border-brand"
              >
                {QUICK_TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex-1 flex flex-col gap-1.5">
              <label className="text-[13px] font-medium text-ink-900">종료</label>
              <select
                value={endTime}
                onChange={e => saveAndSetEnd(e.target.value)}
                className="h-[40px] rounded-[6px] border border-line px-3 text-[14px] text-ink-900 focus:outline-none focus:border-brand"
              >
                {QUICK_TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {error && <p className="text-[13px] text-red-500">{error}</p>}
        </div>

        {/* 상세 설정 링크 */}
        <div className="px-8 pb-3 text-center">
          <button
            type="button"
            onClick={() => onGoToDetail({
              date: `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`,
              childId: childIdx,
              scheduleType,
              startTime,
              endTime,
            })}
            className="text-[13px] text-ink-400 hover:text-brand transition-colors underline underline-offset-2"
          >
            반복 일정 등 상세 설정하기 →
          </button>
        </div>

        {/* 버튼 */}
        <div className="flex justify-center gap-3 px-8 pb-8">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-[42px] rounded-[6px] border border-line text-ink-900 text-[15px] font-medium hover:bg-surface transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 h-[42px] rounded-[6px] bg-brand text-white text-[15px] font-medium hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting ? (isEditMode ? '수정 중…' : '등록 중…') : (isEditMode ? '수정' : '등록')}
          </button>
        </div>
      </div>
    </div>
  )
}
