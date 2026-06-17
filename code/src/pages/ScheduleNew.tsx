import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import MiniCalendar from '../components/MiniCalendar'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api, type AssignedChild } from '../lib/api'

// ── Types ─────────────────────────────────────────────────────────────────────

type RepeatFreq = '매일' | '매주 월-금' | '매주' | '매월' | '매년'

type RepeatConfig = {
  freq: RepeatFreq
  interval: number
  dows: number[]
  monthlyType: 'day' | 'weekday'
  endType: '없음' | '날짜' | '횟수'
  endDate: Date | null
  endCount: number
  startTime: string
  endTime: string
  allDay: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DOW_FULL = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
const DOW_SHORT = ['일', '월', '화', '수', '목', '금', '토']
const FREQ_OPTIONS: RepeatFreq[] = ['매일', '매주 월-금', '매주', '매월', '매년']
const FREQ_UNIT: Record<RepeatFreq, string> = {
  '매일': '일', '매주 월-금': '주', '매주': '주', '매월': '개월', '매년': '년'
}
const TIME_OPTIONS = (() => {
  const out: string[] = []
  for (let h = 8; h <= 23; h++) { out.push(`${h}:00`); out.push(`${h}:30`) }
  return out
})()

// ── Utilities ─────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW_FULL[d.getDay()]}`
}

function fmtYMD(d: Date): string {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function fmt12(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? '오전' : '오후'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function addThirtyMin(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const total = h * 60 + m + 30
  const nh = Math.floor(total / 60)
  const nm = total % 60
  if (nh > 23) return '23:30'
  return `${nh}:${nm === 0 ? '00' : '30'}`
}

function toDatetime(date: Date, timeStr: string): string {
  const [h, m] = timeStr.split(':').map(Number)
  const d = new Date(date)
  d.setHours(h, m, 0, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

function getNthWeekday(date: Date): { n: number; weekday: number } {
  const weekday = date.getDay()
  const target = date.getDate()
  let count = 0
  for (let d = 1; d <= target; d++) {
    if (new Date(date.getFullYear(), date.getMonth(), d).getDay() === weekday) count++
  }
  return { n: count, weekday }
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date | null {
  let count = 0
  const last = new Date(year, month + 1, 0).getDate()
  for (let d = 1; d <= last; d++) {
    if (new Date(year, month, d).getDay() === weekday) {
      count++
      if (count === n) return new Date(year, month, d)
    }
  }
  return null
}

function buildRepeatDates(startDate: Date, config: RepeatConfig): Date[] {
  const startDay = new Date(startDate)
  startDay.setHours(0, 0, 0, 0)
  const maxEnd = (() => {
    if (config.endType === '날짜' && config.endDate) {
      const d = new Date(config.endDate)
      d.setHours(23, 59, 59, 999)
      return d
    }
    const d = new Date(startDate)
    d.setFullYear(d.getFullYear() + 3)
    return d
  })()

  let dates: Date[] = []

  if (config.freq === '매일') {
    const cur = new Date(startDay)
    while (cur <= maxEnd) { dates.push(new Date(cur)); cur.setDate(cur.getDate() + config.interval) }
  } else if (config.freq === '매주 월-금') {
    for (const dow of [1, 2, 3, 4, 5]) {
      const cur = new Date(startDay)
      cur.setDate(cur.getDate() + ((dow - cur.getDay() + 7) % 7))
      while (cur <= maxEnd) { dates.push(new Date(cur)); cur.setDate(cur.getDate() + 7 * config.interval) }
    }
    dates.sort((a, b) => a.getTime() - b.getTime())
  } else if (config.freq === '매주') {
    for (const dow of config.dows) {
      const cur = new Date(startDay)
      cur.setDate(cur.getDate() + ((dow - cur.getDay() + 7) % 7))
      while (cur <= maxEnd) { dates.push(new Date(cur)); cur.setDate(cur.getDate() + 7 * config.interval) }
    }
    dates.sort((a, b) => a.getTime() - b.getTime())
  } else if (config.freq === '매월') {
    if (config.monthlyType === 'day') {
      const cur = new Date(startDay)
      while (cur <= maxEnd) { dates.push(new Date(cur)); cur.setMonth(cur.getMonth() + config.interval) }
    } else {
      const { n, weekday } = getNthWeekday(startDate)
      let y = startDate.getFullYear(), m = startDate.getMonth()
      for (let i = 0; i < 500; i++) {
        const d = getNthWeekdayOfMonth(y, m, weekday, n)
        if (d && d > maxEnd) break
        if (d && d >= startDay) dates.push(d)
        m += config.interval
        if (m > 11) { y += Math.floor(m / 12); m = m % 12 }
      }
    }
  } else {
    const cur = new Date(startDay)
    while (cur <= maxEnd) { dates.push(new Date(cur)); cur.setFullYear(cur.getFullYear() + config.interval) }
  }

  if (config.endType === '횟수') dates = dates.slice(0, config.endCount)
  return dates
}

function buildSummary(date: Date, config: RepeatConfig): string {
  const { n, weekday } = getNthWeekday(date)
  let freqStr = ''
  if (config.freq === '매일') {
    freqStr = config.interval === 1 ? '매일' : `${config.interval}일마다`
  } else if (config.freq === '매주 월-금') {
    freqStr = '매주 월-금'
  } else if (config.freq === '매주') {
    const dowStr = [...config.dows].sort((a, b) => a - b).map(d => DOW_SHORT[d] + '요일').join(', ')
    freqStr = config.interval === 1 ? `매주 ${dowStr}` : `${config.interval}주마다 ${dowStr}`
  } else if (config.freq === '매월') {
    freqStr = config.monthlyType === 'day'
      ? `매월 ${date.getDate()}일`
      : `매월 ${n}번째 ${DOW_SHORT[weekday]}요일`
  } else {
    freqStr = `매년 ${date.getMonth() + 1}월 ${date.getDate()}일`
  }

  let timeStr = ''
  if (config.allDay) {
    timeStr = ' | 종일'
  } else {
    const [sh, sm] = config.startTime.split(':').map(Number)
    const [eh, em] = config.endTime.split(':').map(Number)
    const dur = (eh * 60 + em) - (sh * 60 + sm)
    const durStr = dur > 0 && dur < 1440
      ? (dur >= 60 ? `${Math.floor(dur / 60)}시간${dur % 60 ? ` ${dur % 60}분` : ''}` : `${dur}분`)
      : ''
    timeStr = ` | ${fmt12(config.startTime)} - ${fmt12(config.endTime)}${durStr ? ` (${durStr})` : ''}`
  }

  const endStr = config.endType === '날짜' && config.endDate
    ? fmtYMD(config.endDate)
    : config.endType === '횟수' ? `${config.endCount}회` : '무한반복'

  return `${freqStr}${timeStr}\n${fmtYMD(date)} - ${endStr}`
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScheduleNew() {
  const { go } = useRouter()
  const { user } = useAuth()
  const [date, setDate]                   = useState(new Date())
  const [startTime, setStartTime]         = useState('9:00')
  const [endTime, setEndTime]             = useState('9:30')
  const [scheduleType, setScheduleType]   = useState<'1' | '2'>('2')
  const [children, setChildren]           = useState<AssignedChild[]>([])
  const [selectedChild, setSelectedChild] = useState<AssignedChild | null>(null)
  const [childQuery, setChildQuery]       = useState('')
  const [childPickerOpen, setChildPickerOpen] = useState(false)
  const [saving, setSaving]               = useState(false)
  const [recurrence, setRecurrence]       = useState<'once' | 'repeat'>('once')
  const [repeatConfig, setRepeatConfig]   = useState<RepeatConfig | null>(null)
  const [popupOpen, setPopupOpen]         = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.assignedChildren().then(list => {
      setChildren(list)
      const raw = sessionStorage.getItem('schedule_prefill')
      if (!raw) return
      sessionStorage.removeItem('schedule_prefill')
      try {
        const p = JSON.parse(raw)
        if (p.date)         setDate(new Date(p.date + 'T12:00:00'))
        if (p.scheduleType) setScheduleType(p.scheduleType)
        if (p.startTime)    setStartTime(p.startTime)
        if (p.endTime)      setEndTime(p.endTime)
        if (p.childId)      setSelectedChild(list.find(c => c.id === p.childId) ?? null)
      } catch {}
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setChildPickerOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredChildren = useMemo(() => {
    const q = childQuery.trim().toLowerCase()
    if (!q) return children
    return children.filter(c =>
      (c.child_name ?? '').toLowerCase().includes(q) ||
      c.identifier.toLowerCase().includes(q)
    )
  }, [children, childQuery])

  const selectChild = (c: AssignedChild) => {
    setSelectedChild(c); setChildPickerOpen(false); setChildQuery('')
  }

  const handleSave = async () => {
    if (!selectedChild) { alert('아동을 선택해 주세요.'); return }
    if (recurrence === 'repeat' && !repeatConfig) { alert('반복 설정을 완료해 주세요.'); return }
    setSaving(true)
    try {
      const base = {
        child_idx:     selectedChild.id,
        schedule_type: scheduleType,
        doctor_code:   user?.role === 'doctor'    ? (user.code ?? user.id) : (selectedChild.doctor_code  ?? undefined),
        teacher_code:  user?.role === 'therapist' ? (user.code ?? user.id) : (selectedChild.teacher_code ?? undefined)
      }
      if (recurrence === 'once') {
        await api.createSchedule({
          ...base,
          start_datetime: toDatetime(date, startTime),
          end_datetime:   toDatetime(date, endTime)
        })
      } else {
        const cfg = repeatConfig!
        const dates = buildRepeatDates(date, cfg)
        if (dates.length === 0) { alert('생성된 일정이 없습니다.'); setSaving(false); return }
        if (dates.length > 200 && !confirm(`총 ${dates.length}건의 일정이 등록됩니다. 계속하시겠습니까?`)) {
          setSaving(false); return
        }
        const st = cfg.allDay ? '0:00' : cfg.startTime
        const et = cfg.allDay ? '23:30' : cfg.endTime
        const repeat_group_id = crypto.randomUUID()
        await Promise.all(dates.map(d => api.createSchedule({
          ...base,
          start_datetime: toDatetime(d, st),
          end_datetime:   toDatetime(d, et),
          repeat_group_id,
        })))
      }
      sessionStorage.setItem('schedule_toast', '일정 등록이 완료되었습니다.')
      go({ name: 'schedule-list' })
    } catch {
      alert('일정 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {user?.role === 'admin' ? <AdminSidebar /> : <Sidebar />}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-10 overflow-y-auto">
          <div className="max-w-[700px] mx-auto pb-16">
            <h1 className="text-[22px] font-semibold text-ink-900 mb-8 text-center">일정등록</h1>

            <div className="space-y-6">
              {/* 날짜 */}
              <FormRow label="날짜">
                <div className="space-y-3">
                  <div className="h-[45px] bg-line-soft rounded-[5px] flex items-center px-4 text-[18px] font-semibold text-ink-900">
                    {formatDate(date)}
                  </div>
                  <MiniCalendar selectedDate={date} onSelect={setDate} />
                </div>
              </FormRow>

              {/* 시간 — 이번만일 때만 표시 */}
              {recurrence === 'once' && (
                <FormRow label="시간">
                  <div className="flex items-center gap-3">
                    <TimeSelect value={startTime} onChange={t => { setStartTime(t); setEndTime(addThirtyMin(t)) }} />
                    <span className="text-ink-900">~</span>
                    <TimeSelect value={endTime} onChange={setEndTime} />
                  </div>
                </FormRow>
              )}

              {/* 일정 유형 */}
              <FormRow label="유형">
                <div className="flex gap-2">
                  {([['2', '치료'], ['1', '진료']] as const).map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setScheduleType(val)}
                      className={`flex-1 h-10 rounded-[5px] border text-[15px] transition-colors ${
                        scheduleType === val
                          ? 'border-brand bg-brand text-white'
                          : 'border-[#D9D9D9] bg-white text-ink-900 hover:border-brand'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </FormRow>

              {/* 아동 선택 */}
              <FormRow label="아동">
                <div ref={pickerRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setChildPickerOpen(o => !o)}
                    className="w-full h-10 px-3 border border-line rounded-[5px] text-[15px] text-left bg-white hover:border-brand transition-colors flex items-center justify-between"
                  >
                    {selectedChild ? (
                      <span className="text-ink-900">
                        {selectedChild.child_name ?? selectedChild.identifier}
                        <span className="text-ink-400 text-[13px] ml-2">({selectedChild.identifier})</span>
                      </span>
                    ) : (
                      <span className="text-[#626262]">아동 검색 및 선택</span>
                    )}
                    <svg width="10" height="6" viewBox="0 0 10 6" className="shrink-0">
                      <path d="M1 1l4 4 4-4" stroke="#999" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                    </svg>
                  </button>
                  {childPickerOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-line rounded-[5px] shadow-lg z-20">
                      <div className="p-2 border-b border-line">
                        <input
                          type="text"
                          value={childQuery}
                          onChange={e => setChildQuery(e.target.value)}
                          placeholder="이름 또는 식별코드"
                          className="w-full h-8 px-3 text-[13px] border border-line rounded-[4px] focus:outline-none focus:border-brand"
                          autoFocus
                        />
                      </div>
                      <ul className="max-h-[200px] overflow-y-auto">
                        {filteredChildren.length === 0 ? (
                          <li className="text-[13px] text-ink-400 text-center py-3">결과 없음</li>
                        ) : filteredChildren.map(c => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => selectChild(c)}
                              className="w-full text-left px-3 py-2 text-[14px] text-ink-900 hover:bg-surface-chip transition-colors"
                            >
                              {c.child_name ?? c.identifier}
                              <span className="text-ink-400 text-[12px] ml-2">({c.identifier})</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </FormRow>

              {/* 담당의사 */}
              <FormRow label="담당의사">
                <StaticField value={user?.role === 'doctor' ? user.name : (selectedChild?.doctor_name ?? null)} />
              </FormRow>

              {/* 담당치료사 */}
              <FormRow label="담당치료사">
                <StaticField value={user?.role === 'therapist' ? user.name : (selectedChild?.therapist_name ?? null)} />
              </FormRow>

              {/* 주기 */}
              <FormRow label="주기">
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setRecurrence('once'); setRepeatConfig(null) }}
                      className={`h-10 px-6 rounded-[5px] border text-[15px] transition-colors ${
                        recurrence === 'once'
                          ? 'border-brand text-brand bg-brand/10'
                          : 'border-[#D9D9D9] bg-white text-ink-900 hover:border-brand'
                      }`}
                    >
                      이번만
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRecurrence('repeat'); setPopupOpen(true) }}
                      className={`h-10 px-6 rounded-[5px] border text-[15px] transition-colors ${
                        recurrence === 'repeat'
                          ? 'border-brand text-brand bg-brand/10'
                          : 'border-[#D9D9D9] bg-white text-ink-900 hover:border-brand'
                      }`}
                    >
                      반복
                    </button>
                  </div>
                  {recurrence === 'repeat' && repeatConfig && (
                    <button
                      type="button"
                      onClick={() => setPopupOpen(true)}
                      className="w-full text-left bg-surface-chip rounded-[5px] px-3 py-2.5 text-[13px] text-ink-700 whitespace-pre-line leading-relaxed hover:bg-surface-active transition-colors"
                    >
                      {buildSummary(date, repeatConfig)}
                    </button>
                  )}
                  {recurrence === 'repeat' && !repeatConfig && (
                    <p className="text-[13px] text-ink-400">반복 설정을 완료해 주세요.</p>
                  )}
                </div>
              </FormRow>
            </div>

            <div className="flex justify-center gap-3 mt-10">
              <button
                type="button"
                onClick={() => go({ name: 'schedule-list' })}
                className="w-[120px] h-12 rounded-[5px] border border-line text-ink-700 text-[15px] font-medium hover:border-ink-500 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="w-[150px] h-12 rounded-[5px] bg-brand text-white text-[15px] font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </main>
      </div>

      {popupOpen && (
        <RepeatPopup
          startDate={date}
          initStartTime={startTime}
          initEndTime={endTime}
          initialConfig={repeatConfig}
          onConfirm={cfg => { setRepeatConfig(cfg); setPopupOpen(false) }}
          onCancel={() => {
            setPopupOpen(false)
            if (!repeatConfig) setRecurrence('once')
          }}
        />
      )}

    </div>
  )
}

// ── RepeatPopup ───────────────────────────────────────────────────────────────

function RepeatPopup({
  startDate, initStartTime, initEndTime, initialConfig, onConfirm, onCancel
}: {
  startDate: Date
  initStartTime: string
  initEndTime: string
  initialConfig: RepeatConfig | null
  onConfirm: (cfg: RepeatConfig) => void
  onCancel: () => void
}) {
  const def = initialConfig ?? {
    freq: '매주' as RepeatFreq,
    interval: 1,
    dows: [startDate.getDay()],
    monthlyType: 'day' as const,
    endType: '없음' as const,
    endDate: null,
    endCount: 10,
    startTime: initStartTime,
    endTime: initEndTime,
    allDay: false
  }

  const [freq, setFreq]               = useState<RepeatFreq>(def.freq)
  const [interval, setIntervalVal]    = useState(def.interval)
  const [dows, setDows]               = useState<number[]>(def.dows)
  const [monthlyType, setMonthlyType] = useState<'day' | 'weekday'>(def.monthlyType)
  const [endType, setEndType]         = useState<'없음' | '날짜' | '횟수'>(def.endType)
  const [endDate, setEndDate]         = useState<Date | null>(def.endDate)
  const [endCount, setEndCount]       = useState(def.endCount)
  const [pStart, setPStart]           = useState(def.startTime)
  const [pEnd, setPEnd]               = useState(def.endTime)
  const [allDay, setAllDay]           = useState(def.allDay)

  const { n: nthN, weekday: nthWD } = getNthWeekday(startDate)

  const currentConfig: RepeatConfig = {
    freq, interval, dows, monthlyType, endType, endDate, endCount,
    startTime: pStart, endTime: pEnd, allDay
  }
  const summary = buildSummary(startDate, currentConfig)

  const toggleDow = (dow: number) =>
    setDows(prev => prev.includes(dow)
      ? prev.length > 1 ? prev.filter(d => d !== dow) : prev
      : [...prev, dow])

  const handleConfirm = () => {
    if (freq === '매주' && dows.length === 0) { alert('요일을 선택해주세요.'); return }
    if (endType === '날짜' && !endDate) { alert('종료 날짜를 입력해주세요.'); return }
    if (endType === '횟수' && endCount < 1) { alert('횟수를 1 이상 입력해주세요.'); return }
    onConfirm(currentConfig)
  }

  const endDateStr = endDate
    ? `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
    : ''
  const minDateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
      <div className="bg-white rounded-[10px] shadow-xl w-[480px] max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-line">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-semibold text-ink-900">반복</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 9h18M8 2v4M16 2v4" />
            </svg>
          </div>
          <button type="button" onClick={onCancel} className="text-[#999] hover:text-ink-900 p-1">
            <svg width="13" height="13" viewBox="0 0 13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 1l11 11M12 1L1 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-4">

          {/* 반복 주기 */}
          <PopupRow label="반복 주기">
            <SelectBox
              value={freq}
              onChange={v => {
                const f = v as RepeatFreq
                setFreq(f)
                if (f === '매주') setDows([startDate.getDay()])
              }}
              options={FREQ_OPTIONS.map(f => ({ value: f, label: f }))}
              className="min-w-[140px]"
            />
          </PopupRow>

          {/* 주기 */}
          <PopupRow label="주기">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="number" min={1} max={99} value={interval}
                  onChange={e => setIntervalVal(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 h-9 px-2 text-center text-[14px] border border-line rounded-[4px] focus:outline-none focus:border-brand"
                />
                <span className="text-[14px] text-ink-700">{FREQ_UNIT[freq]}</span>
              </div>
              {freq === '매주' && (
                <div className="flex items-center gap-3 flex-wrap">
                  {DOW_SHORT.map((label, dow) => (
                    <label key={dow} className="flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={dows.includes(dow)}
                        onChange={() => toggleDow(dow)}
                        className="w-3.5 h-3.5 accent-brand"
                      />
                      <span className="text-[13px] text-ink-800">{label}</span>
                    </label>
                  ))}
                </div>
              )}
              {freq === '매월' && (
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-[13px]">
                    <input type="radio" checked={monthlyType === 'day'} onChange={() => setMonthlyType('day')} className="w-3.5 h-3.5 accent-brand" />
                    {startDate.getDate()}일
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none text-[13px]">
                    <input type="radio" checked={monthlyType === 'weekday'} onChange={() => setMonthlyType('weekday')} className="w-3.5 h-3.5 accent-brand" />
                    {nthN}번째 {DOW_SHORT[nthWD]}요일
                  </label>
                </div>
              )}
            </div>
          </PopupRow>

          {/* 시간 */}
          <PopupRow label="시간">
            <div className="flex items-center gap-2 flex-wrap">
              {!allDay && (
                <>
                  <TimeSelect12 value={pStart} onChange={t => { setPStart(t); setPEnd(addThirtyMin(t)) }} />
                  <span className="text-[13px] text-ink-500">~</span>
                  <span className="text-[12px] text-ink-400 border border-line rounded-[4px] px-2 h-9 flex items-center">당일</span>
                  <TimeSelect12 value={pEnd} onChange={setPEnd} />
                </>
              )}
              <label className="flex items-center gap-1.5 cursor-pointer select-none ml-1">
                <input type="checkbox" checked={allDay} onChange={e => setAllDay(e.target.checked)} className="w-3.5 h-3.5 accent-brand" />
                <span className="text-[13px] text-ink-700">종일</span>
              </label>
            </div>
          </PopupRow>

          {/* 종료 */}
          <PopupRow label="종료">
            <div className="space-y-2.5">
              <div className="flex items-center gap-5">
                {(['없음', '날짜', '횟수'] as const).map(type => (
                  <label key={type} className="flex items-center gap-1.5 cursor-pointer select-none text-[13px]">
                    <input type="radio" checked={endType === type} onChange={() => setEndType(type)} className="w-3.5 h-3.5 accent-brand" />
                    {type}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2 text-[13px]">
                <span className="text-ink-400 border border-line rounded-[4px] px-2 h-8 flex items-center text-[12px]">양력</span>
                <span className="text-ink-700 font-medium">{fmtYMD(startDate)}</span>
                <span className="text-ink-500">부터</span>
                {endType === '날짜' && (
                  <input
                    type="date"
                    value={endDateStr}
                    min={minDateStr}
                    onChange={e => setEndDate(e.target.value ? new Date(e.target.value + 'T00:00:00') : null)}
                    className="h-8 px-2 text-[13px] border border-line rounded-[4px] focus:outline-none focus:border-brand"
                  />
                )}
                {endType === '횟수' && (
                  <div className="flex items-center gap-1">
                    <input
                      type="number" min={1} max={999} value={endCount}
                      onChange={e => setEndCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 h-8 px-2 text-center text-[13px] border border-line rounded-[4px] focus:outline-none focus:border-brand"
                    />
                    <span className="text-ink-700">회</span>
                  </div>
                )}
              </div>
            </div>
          </PopupRow>
        </div>

        {/* Summary */}
        <div className="mx-5 mb-5 bg-surface-chip rounded-[5px] px-4 py-3 text-[13px] text-ink-700 whitespace-pre-line leading-[1.8]">
          {summary}
        </div>

        {/* Buttons */}
        <div className="flex justify-center gap-3 px-5 py-4 border-t border-line">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-[100px] h-10 rounded-[5px] bg-brand text-white text-[14px] font-medium hover:opacity-90 transition"
          >
            설정
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-[100px] h-10 rounded-[5px] border border-line text-ink-700 text-[14px] hover:border-ink-500 transition"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-6 items-start">
      <span className="text-[18px] font-semibold text-ink-900 text-right pt-2">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function PopupRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-x-4 items-start">
      <span className="text-[13px] font-medium text-ink-600 pt-2.5 text-right">{label}</span>
      <div>{children}</div>
    </div>
  )
}

function StaticField({ value }: { value: string | null }) {
  return (
    <div className="h-10 flex items-center text-[15px]">
      {value ? <span className="text-ink-900">{value}</span> : <span className="text-ink-400">-</span>}
    </div>
  )
}

function SelectBox({ value, onChange, options, className = '' }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  className?: string
}) {
  return (
    <div className={`relative inline-block ${className}`}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none w-full h-9 pl-3 pr-8 border border-line rounded-[4px] bg-white text-[14px] focus:outline-none focus:border-brand"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg width="8" height="5" viewBox="0 0 8 5" fill="#999"><polygon points="0,0 8,0 4,5" /></svg>
      </span>
    </div>
  )
}

function TimeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none w-[147px] h-10 px-3 pr-9 border border-line rounded-[5px] bg-white text-[15px] font-semibold focus:outline-none focus:border-brand"
      >
        {TIME_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
      <span className="absolute right-2 top-1/2 -translate-y-1/2 w-[18px] h-[18px] rounded-[3px] bg-[#D9D9D9] grid place-items-center pointer-events-none">
        <svg width="8" height="5" viewBox="0 0 8 5" fill="white"><polygon points="0,0 8,0 4,5" /></svg>
      </span>
    </div>
  )
}

function TimeSelect12({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none h-9 pl-2 pr-7 border border-line rounded-[4px] bg-white text-[13px] focus:outline-none focus:border-brand"
      >
        {TIME_OPTIONS.map(t => <option key={t} value={t}>{fmt12(t)}</option>)}
      </select>
      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg width="7" height="5" viewBox="0 0 8 5" fill="#999"><polygon points="0,0 8,0 4,5" /></svg>
      </span>
    </div>
  )
}
