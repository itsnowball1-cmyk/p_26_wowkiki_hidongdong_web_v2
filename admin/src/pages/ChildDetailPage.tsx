import { useEffect, useMemo, useState } from 'react'
import Layout from '../components/Layout'
import { useRouter } from '../lib/router'

type Props = { id: number }

type ChildInfo = {
  id: number
  identifier: string
  name: string
  birth_date: string | null
  age_label: string | null
  primary_diagnosis: string | null
  service_started_at: string | null
  app_login_id: string | null
  next_doctor_appointment: string | null
  next_therapy_appointment: string | null
  doctor_id: string | null
  doctor_name: string | null
  doctor_department: string | null
  therapist_id: string | null
  therapist_name: string | null
  therapist_department: string | null
  therapist_schedule: string | null
}

type MemoItem = { type: 'admin' | 'doctor' | 'therapist'; content: string; updated_at: string }

type DiagnosisListItem = {
  id: number
  examined_at: string
  duration_label: string | null
  accuracy_pct: number | null
  summary: string | null
  consonant_pct: number | null
  word_pos_pct: number | null
  vowel_pct: number | null
}

type TreatmentListItem = {
  id: number
  treated_at: string
  session_no: number | null
  trained_sound: string | null
  tags_json: string | null
  try_count: number | null
  avg_accuracy_pct: number | null
  duration_minutes: number | null
}

const HEADERS = {
  'content-type': 'application/json',
  get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' }
}

export default function ChildDetailPage({ id }: Props) {
  const { go } = useRouter()
  const [child, setChild] = useState<ChildInfo | null>(null)
  const [memos, setMemos] = useState<MemoItem[]>([])
  const [diagnoses, setDiagnoses] = useState<DiagnosisListItem[]>([])
  const [treatments, setTreatments] = useState<TreatmentListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`/api/admin/children-all/${id}`, { headers: HEADERS }).then(r => r.ok ? r.json() : null),
      fetch(`/api/admin/children-all/${id}/diagnoses`, { headers: HEADERS }).then(r => r.ok ? r.json() : []),
      fetch(`/api/admin/children-all/${id}/treatments`, { headers: HEADERS }).then(r => r.ok ? r.json() : []),
    ]).then(([detail, diags, treats]) => {
      if (detail) {
        setChild(detail.child)
        setMemos(detail.memos ?? [])
      }
      setDiagnoses(diags ?? [])
      setTreatments(treats ?? [])
    }).finally(() => setLoading(false))
  }, [id])

  const memoByType = useMemo(() => {
    const m: Record<'admin' | 'doctor' | 'therapist', { content: string; updated_at: string } | null> = {
      admin: null, doctor: null, therapist: null
    }
    for (const r of memos) m[r.type] = { content: r.content, updated_at: r.updated_at }
    return m
  }, [memos])

  if (loading) {
    return (
      <Layout title="아동 상세">
        <div className="flex items-center justify-center h-[400px] text-[14px] text-[#B5B5B5]">불러오는 중…</div>
      </Layout>
    )
  }

  if (!child) {
    return (
      <Layout title="아동 상세">
        <div className="flex items-center justify-center h-[400px] text-[14px] text-[#B5B5B5]">아동 정보를 찾을 수 없습니다.</div>
      </Layout>
    )
  }

  return (
    <Layout title="아동 상세">
      <div className="space-y-10">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h2 className="text-[18px] font-semibold text-[#343A40]">아동 정보</h2>
          <button
            type="button"
            onClick={() => go({ name: 'children' })}
            className="text-[12px] text-[#343A40] hover:text-[#005744] transition-colors"
          >
            목록으로 돌아가기 &gt;
          </button>
        </div>

        {/* 기본 정보 */}
        <InfoCard child={child} />

        {/* 메모 카드 */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <MemoCard
              role="admin"
              initial={memoByType.admin?.content ?? ''}
              lastEdited={memoByType.admin?.content ? (memoByType.admin.updated_at ?? '-') : '-'}
            />
            <MemoCard
              role="doctor"
              initial={memoByType.doctor?.content ?? ''}
              lastEdited={memoByType.doctor?.content ? (memoByType.doctor.updated_at ?? '-') : '-'}
            />
            <MemoCard
              role="therapist"
              initial={memoByType.therapist?.content ?? ''}
              lastEdited={memoByType.therapist?.content ? (memoByType.therapist.updated_at ?? '-') : '-'}
            />
          </div>
        </section>

        {/* 진단 이력 */}
        <DiagnosisSection diagnoses={diagnoses} />

        {/* 치료 이력 */}
        <TreatmentSection treatments={treatments} />

        <div className="text-[12px] text-[#B0B0B0] pt-4">아동 ID: {id}</div>
      </div>
    </Layout>
  )
}

/* ---------------------------------- */
/* Info Card                          */
/* ---------------------------------- */
function serviceDurationLabel(startDate: string | null): string | null {
  if (!startDate) return null
  const [y, m, d] = startDate.split('.').map(Number)
  if (!y || !m) return null
  const start = new Date(y, m - 1, d || 1)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
  if (months < 1) return '1개월 미만'
  return `${months}개월 째`
}

function TableRow({ label, children, last = false }: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={`flex min-h-[52px] items-stretch ${!last ? 'border-b border-[#DEDEDE]' : ''}`}>
      <div className="w-[140px] shrink-0 flex items-center px-4 border-r border-[#DEDEDE] bg-[#EAEAEA] text-[15px] font-medium text-[#343A40]">
        {label}
      </div>
      <div className="flex-1 px-5 flex items-center text-[15px]">
        {children}
      </div>
    </div>
  )
}

function InfoCard({ child }: { child: ChildInfo }) {
  const durationLabel = serviceDurationLabel(child.service_started_at)

  return (
    <div className="rounded-md border border-[#DEDEDE] bg-white overflow-hidden">
      <TableRow label="아동명">
        <span className="text-[#585858] font-medium">{child.name}</span>
        <span className="text-[#484848] ml-8">{child.identifier}</span>
      </TableRow>

      <TableRow label="생년월일">
        <span className="text-[#585858]">{child.birth_date ?? '-'}</span>
        {child.age_label && (
          <span className="text-[#585858] ml-8">{child.age_label}</span>
        )}
      </TableRow>

      <TableRow label="주진단">
        <span className="text-[#585858]">{child.primary_diagnosis ?? '-'}</span>
      </TableRow>

      <TableRow label="담당 의사">
        {child.doctor_name ? (
          <div className="flex items-center gap-8 flex-wrap">
            <span className="text-[#585858]">{child.doctor_name}</span>
            <span className="text-[#484848]">{child.doctor_id ?? '-'}</span>
            <span className="text-[#484848]">{child.doctor_department ?? '-'}</span>
            {child.next_doctor_appointment && (
              <span className="text-[#484848]">예약&nbsp;&nbsp;&nbsp;{child.next_doctor_appointment}</span>
            )}
          </div>
        ) : (
          <span className="text-[#585858]">미배정</span>
        )}
      </TableRow>

      <TableRow label="담당 치료사">
        {child.therapist_name ? (
          <div className="flex items-center gap-8 flex-wrap">
            <span className="text-[#585858]">{child.therapist_name}</span>
            <span className="text-[#484848]">{child.therapist_id ?? '-'}</span>
            <span className="text-[#484848]">{child.therapist_department ?? '-'}</span>
            {child.therapist_schedule && (
              <span className="text-[#484848]">{child.therapist_schedule}</span>
            )}
          </div>
        ) : (
          <span className="text-[#585858]">미배정</span>
        )}
      </TableRow>

      <TableRow label="하이동동 시작일" last>
        <span className="text-[#585858]">{child.service_started_at ?? '-'}</span>
        {durationLabel && (
          <span className="text-[#585858] ml-8">{durationLabel}</span>
        )}
      </TableRow>
    </div>
  )
}

/* ---------------------------------- */
/* Memo Card — 읽기 전용               */
/* ---------------------------------- */
const MEMO_LABELS: Record<'admin' | 'doctor' | 'therapist', string> = {
  admin: '관리자 메모',
  doctor: '의사 메모',
  therapist: '치료사 메모'
}

function MemoCard({ role, initial, lastEdited }: {
  role: 'admin' | 'doctor' | 'therapist'
  initial: string
  lastEdited: string
}) {
  return (
    <div className="bg-white border border-[#DEDEDE] rounded-[5px] p-5">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[18px] font-semibold text-[#343A40]">{MEMO_LABELS[role]}</h3>
        <span className="text-[11px] text-[#919191] px-2 py-0.5 rounded-full bg-[#EAEAEA]">읽기 전용</span>
      </div>
      <textarea
        value={initial}
        readOnly
        placeholder="아직 작성된 메모가 없습니다."
        className="w-full h-[100px] resize-none border border-[#DEDEDE] rounded-[5px] p-3 text-[14px] text-[#585858] focus:outline-none bg-[#EAEAEA] cursor-default"
      />
      <div className="mt-3 text-[12px] text-[#B0B0B0]">최종 정보 수정일시 : {lastEdited}</div>
    </div>
  )
}

/* ---------------------------------- */
/* 진단 이력                           */
/* ---------------------------------- */
function applyDateFilter<T>(
  items: T[],
  getDate: (item: T) => string | null,
  range: 'today' | '1w' | '1m' | '3m' | '12m' | null,
  fromDate: string,
  toDate: string,
  customActive: boolean
): T[] {
  if (customActive && (fromDate || toDate)) {
    return items.filter(item => {
      const ds = getDate(item)
      if (!ds) return false
      const d = parseTreatedAt(ds)
      if (fromDate) { const f = new Date(fromDate); f.setHours(0,0,0,0); if (d < f) return false }
      if (toDate)   { const t = new Date(toDate);   t.setHours(23,59,59,999); if (d > t) return false }
      return true
    })
  }
  if (range === null) return items
  const cutoff = rangeCutoff(range)
  return items.filter(item => {
    const ds = getDate(item)
    return ds ? parseTreatedAt(ds) >= cutoff : false
  })
}

function DiagnosisSection({ diagnoses }: { diagnoses: DiagnosisListItem[] }) {
  const [range, setRange] = useState<'today' | '1w' | '1m' | '3m' | '12m' | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [customActive, setCustomActive] = useState(false)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const latest = diagnoses[0]

  const filteredDiagnoses = applyDateFilter(diagnoses, d => d.examined_at, range, fromDate, toDate, customActive)
  const isFiltered = range !== null || customActive

  const handleRangeChange = (r: 'today' | '1w' | '1m' | '3m' | '12m') => {
    setRange(r)
    setCustomActive(false)
  }
  const handleReset = () => { setRange(null); setCustomActive(false); setFromDate(''); setToDate('') }

  const toggleCheck = (id: number) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <section>
      <h2 className="text-[18px] font-semibold text-[#343A40] mb-5">진단 이력</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 mb-6">
        <div className="bg-white border border-[#DEDEDE] rounded-[5px] p-5">
          <div className="text-[18px] font-medium text-[#343A40] mb-1">최근진단일</div>
          <div className="text-[14px] text-[#919191]">
            {latest
              ? `검사일 ${latest.examined_at} · 소요시간 ${latest.duration_label ?? '-'}`
              : '진단 기록이 없습니다.'}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MetricBlock label="자음정확도" sub="아동 개인 수치" value={latest?.consonant_pct != null ? `${latest.consonant_pct}%` : '--'} />
          <MetricBlock label="단어 내 위치별 자음 정확도" sub="아동 개인 수치" value={latest?.word_pos_pct != null ? `${latest.word_pos_pct}%` : '--'} />
          <MetricBlock label="모음정확도" sub="아동 개인 수치" value={latest?.vowel_pct != null ? `${latest.vowel_pct}%` : '--'} />
        </div>
      </div>

      <DateRangeFilter
        range={range} onChange={handleRangeChange} onReset={handleReset}
        fromDate={fromDate} toDate={toDate}
        onFromChange={setFromDate} onToChange={setToDate}
        onSearch={() => setCustomActive(true)}
      />

      <div className="flex items-center justify-between my-4">
        <span className="text-[12px] text-[#919191]">
          {isFiltered
            ? `${filteredDiagnoses.length}개 표시 중 (전체 ${diagnoses.length}개)`
            : `전체 ${diagnoses.length}개`}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#343A40]">[데이터 다운로드]</span>
          <OutlineButton color="green">엑셀 다운</OutlineButton>
          <OutlineButton color="orange">PDF 다운</OutlineButton>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#DEDEDE] bg-white">
        <table className="w-full min-w-[900px] text-[15px]">
          <thead>
            <tr className="border-b border-[#DEDEDE] bg-[#EAEAEA]">
              <th className="w-[48px]" />
              <Th>진단일시</Th>
              <Th>사용시간</Th>
              <Th>정확도</Th>
              <Th>진단 결과 요약</Th>
              <Th>상세보기</Th>
            </tr>
          </thead>
          <tbody>
            {filteredDiagnoses.length === 0 && (
              <tr>
                <td colSpan={6} className="h-[80px] text-center text-[#B5B5B5]">
                  {isFiltered ? '해당 기간에 진단 기록이 없습니다.' : '진단 기록이 없습니다.'}
                </td>
              </tr>
            )}
            {filteredDiagnoses.map((row) => (
              <tr key={row.id} className="hover:bg-[#F5F5F5] transition-colors">
                <td className="h-[45px] px-3 text-center border-t border-[#DEDEDE]">
                  <input
                    type="checkbox"
                    checked={checked.has(row.id)}
                    onChange={() => toggleCheck(row.id)}
                    className="w-4 h-4 accent-[#005744] cursor-pointer"
                  />
                </td>
                <Td className="text-[#343A40]">{row.examined_at}</Td>
                <Td className="text-[#343A40]">{row.duration_label ?? '-'}</Td>
                <Td className="text-[#343A40]">{row.accuracy_pct != null ? `${row.accuracy_pct}%` : '-'}</Td>
                <Td className="text-[#343A40]">{row.summary ?? '-'}</Td>
                <td className="h-[45px] px-3 text-center border-t border-[#DEDEDE]">
                  <button className="text-[14px] text-[#343A40] hover:text-[#005744] transition-colors">
                    상세보기&gt;
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SmallPagination />
    </section>
  )
}

/* ---------------------------------- */
/* 치료 이력                           */
/* ---------------------------------- */
function parseTreatedAt(s: string): Date {
  const [y, m, d] = s.split(' ')[0].split('.').map(Number)
  return new Date(y, m - 1, d)
}

function rangeCutoff(range: 'today' | '1w' | '1m' | '3m' | '12m'): Date {
  const days = range === 'today' ? 0 : range === '1w' ? 7 : range === '1m' ? 30 : range === '3m' ? 90 : 365
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  if (range !== 'today') cutoff.setDate(cutoff.getDate() - days)
  return cutoff
}

type ChartGroup = { label: string; accuracy: number; tryCount: number; duration: number }

function buildChartGroups(
  treatments: TreatmentListItem[],
  period: 'week' | 'month' | '3month'
): { groups: ChartGroup[]; avgAcc: number; totalTry: number; totalMin: number } {
  const cutoffDays = period === 'week' ? 7 : period === 'month' ? 30 : 90
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - cutoffDays)
  cutoff.setHours(0, 0, 0, 0)

  const filtered = treatments.filter(t => t.treated_at && parseTreatedAt(t.treated_at) >= cutoff)

  let groups: ChartGroup[]

  if (period === '3month') {
    const byMonth = new Map<string, { accuracy: number[]; tryCount: number[]; duration: number[] }>()
    filtered.forEach(t => {
      const parts = t.treated_at.split(' ')[0].split('.')
      const key = `${Number(parts[1])}월`
      if (!byMonth.has(key)) byMonth.set(key, { accuracy: [], tryCount: [], duration: [] })
      const entry = byMonth.get(key)!
      if (t.avg_accuracy_pct != null) entry.accuracy.push(t.avg_accuracy_pct)
      if (t.try_count != null) entry.tryCount.push(t.try_count)
      if (t.duration_minutes != null) entry.duration.push(t.duration_minutes)
    })
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
    groups = [...byMonth.entries()].map(([label, v]) => ({
      label,
      accuracy: avg(v.accuracy),
      tryCount: sum(v.tryCount),
      duration: sum(v.duration),
    }))
  } else {
    const sliced = filtered.slice(-7)
    groups = [...sliced].reverse().map(t => {
      const parts = t.treated_at.split(' ')[0].split('.')
      const label = parts.length >= 3 ? `${Number(parts[1])}/${Number(parts[2])}` : t.treated_at
      return {
        label,
        accuracy: t.avg_accuracy_pct ?? 0,
        tryCount: t.try_count ?? 0,
        duration: t.duration_minutes ?? 0,
      }
    })
  }

  const avgAcc = groups.length ? Math.round(groups.reduce((a, g) => a + g.accuracy, 0) / groups.length) : 0
  const totalTry = groups.reduce((a, g) => a + g.tryCount, 0)
  const totalMin = groups.reduce((a, g) => a + g.duration, 0)

  return { groups, avgAcc, totalTry, totalMin }
}

function TreatmentSection({ treatments }: { treatments: TreatmentListItem[] }) {
  const [period, setPeriod] = useState<'week' | 'month' | '3month'>('week')
  const [range, setRange] = useState<'today' | '1w' | '1m' | '3m' | '12m' | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [customActive, setCustomActive] = useState(false)

  const { groups, avgAcc, totalTry, totalMin } = useMemo(
    () => buildChartGroups(treatments, period),
    [treatments, period]
  )
  const periodLabel = period === 'week' ? '이번주' : period === 'month' ? '이번달' : '3개월 간'

  const filteredTreatments = applyDateFilter(treatments, t => t.treated_at, range, fromDate, toDate, customActive)
  const isFiltered = range !== null || customActive

  const handleRangeChange = (r: 'today' | '1w' | '1m' | '3m' | '12m') => {
    setRange(r)
    setCustomActive(false)
  }
  const handleReset = () => { setRange(null); setCustomActive(false); setFromDate(''); setToDate('') }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[18px] font-semibold text-[#343A40]">치료 이력</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-5 text-[15px] text-[#B2B2B2]">
            <LegendDot color="bg-[#FF6767]" label="정확도(%)" />
            <LegendDot color="bg-[#FF9873]" label="발음 횟수 (회)" />
            <LegendDot color="bg-[#5EBC93]" label="훈련시간 (분)" />
          </div>
          <div className="flex items-center border border-[#005744] rounded-[5px] overflow-hidden text-[15px]">
            {(['week', 'month', '3month'] as const).map((p) => {
              const label = p === 'week' ? '주간' : p === 'month' ? '월간' : '3개월'
              return (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-4 h-[34px] font-medium transition-colors ${
                    period === p ? 'bg-[#005744] text-white' : 'bg-white text-[#343A40]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <GroupedBarChart groups={groups} />

      <div className="mt-4 mb-6 space-y-2">
        <ChartStatLine color="#5EBC93" text={`${periodLabel} 총 ${totalMin}분을 연습했어요.`} />
        <ChartStatLine color="#FF9873" text={`${periodLabel} 총 ${totalTry}회 발음했어요.`} />
        <ChartStatLine color="#FF6767" text={`${periodLabel} 평균 발음 정확도는 ${avgAcc}%에요.`} />
      </div>

      <DateRangeFilter
        range={range} onChange={handleRangeChange} onReset={handleReset}
        fromDate={fromDate} toDate={toDate}
        onFromChange={setFromDate} onToChange={setToDate}
        onSearch={() => setCustomActive(true)}
      />

      <div className="flex items-center justify-between my-4">
        <span className="text-[12px] text-[#919191]">
          {isFiltered
            ? `${filteredTreatments.length}개 표시 중 (전체 ${treatments.length}개)`
            : `전체 ${treatments.length}개`}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#343A40]">[데이터 다운로드]</span>
          <OutlineButton color="green">엑셀 다운</OutlineButton>
          <OutlineButton color="orange">PDF 다운</OutlineButton>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#DEDEDE] bg-white">
        <table className="w-full min-w-[900px] text-[15px]">
          <thead>
            <tr className="border-b border-[#DEDEDE] bg-[#EAEAEA]">
              <Th>치료일시</Th>
              <Th>회기</Th>
              <Th>훈련조음</Th>
              <Th>치료 분야</Th>
              <Th>발음 시도 횟수</Th>
              <Th>평균정확도</Th>
            </tr>
          </thead>
          <tbody>
            {filteredTreatments.length === 0 && (
              <tr>
                <td colSpan={6} className="h-[80px] text-center text-[#B5B5B5]">
                  {isFiltered ? '해당 기간에 치료 기록이 없습니다.' : '치료 기록이 없습니다.'}
                </td>
              </tr>
            )}
            {filteredTreatments.map((row) => {
              const tags = parseTags(row.tags_json)
              return (
                <tr key={row.id} className="hover:bg-[#F5F5F5] transition-colors">
                  <Td className="text-[#343A40]">{row.treated_at}</Td>
                  <Td className="text-[#343A40]">{row.session_no ?? '-'}회기</Td>
                  <Td className="text-[#343A40]">{row.trained_sound ?? '-'}</Td>
                  <Td>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {tags.map((t) => <Tag key={t} label={t} />)}
                    </div>
                  </Td>
                  <Td className="text-[#343A40]">{row.try_count ?? 0}회</Td>
                  <Td className="text-[#343A40]">{row.avg_accuracy_pct != null ? `${row.avg_accuracy_pct}%` : '-'}</Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <SmallPagination />
    </section>
  )
}

function parseTags(json: string | null): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/* ---------------------------------- */
/* Shared building blocks             */
/* ---------------------------------- */
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`h-[45px] px-3 text-center font-medium text-[15px] text-[#343A40] ${className}`}>
      {children}
    </th>
  )
}

function Td({ children, className = '', onClick }: {
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void
}) {
  return (
    <td onClick={onClick} className={`h-[45px] px-3 text-center border-t border-[#DEDEDE] ${className}`}>
      {children}
    </td>
  )
}

function MetricBlock({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className="bg-white border border-[#DEDEDE] rounded-[5px] p-4 flex flex-col justify-between min-w-[140px]">
      <div>
        <div className="text-[14px] font-medium text-[#343A40] leading-snug">{label}</div>
        <div className="text-[12px] text-[#919191] mt-1">{sub}</div>
      </div>
      <div className="text-[24px] font-semibold text-[#005744] mt-3">{value}</div>
    </div>
  )
}

function DateRangeFilter({
  range, onChange, onReset,
  fromDate, toDate, onFromChange, onToChange, onSearch,
}: {
  range: 'today' | '1w' | '1m' | '3m' | '12m' | null
  onChange: (r: 'today' | '1w' | '1m' | '3m' | '12m') => void
  onReset?: () => void
  fromDate: string
  toDate: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onSearch: () => void
}) {
  const chips: Array<['today' | '1w' | '1m' | '3m' | '12m', string]> = [
    ['today', '오늘'], ['1w', '1주일'], ['1m', '1개월'], ['3m', '3개월'], ['12m', '12개월']
  ]

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border border-[#DEDEDE] rounded-[5px] p-4">
      <span className="text-[15px] font-medium text-[#343A40]">조회기간</span>
      <div className="flex items-center gap-2">
        {onReset && (
          <button
            onClick={onReset}
            className={`h-7 px-3 rounded-[3px] text-[12px] font-medium border transition ${
              range === null
                ? 'border-[#005744] bg-[#005744] text-white'
                : 'border-[#DEDEDE] bg-white text-[#585858] hover:border-[#005744]'
            }`}
          >
            전체
          </button>
        )}
        {chips.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`h-7 px-3 rounded-[3px] text-[12px] font-medium border transition ${
              range === key
                ? 'border-[#005744] bg-[#005744] text-white'
                : 'border-[#DEDEDE] bg-white text-[#585858] hover:border-[#005744]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 ml-2">
        <DateInput value={fromDate} onChange={onFromChange} />
        <span className="text-[#919191]">~</span>
        <DateInput value={toDate} onChange={onToChange} />
      </div>
      <button
        onClick={onSearch}
        className="h-7 px-4 rounded-[3px] bg-[#005744] text-white text-[12px] font-medium ml-auto hover:opacity-90 transition"
      >
        조회
      </button>
    </div>
  )
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-7 w-[130px] px-2 border border-[#DEDEDE] rounded-[3px] text-[12px] text-[#585858] focus:outline-none focus:border-[#005744]"
      />
    </div>
  )
}

function OutlineButton({ children, color }: { children: React.ReactNode; color: 'green' | 'orange' }) {
  const cls = color === 'green'
    ? 'border-[#22824A] text-[#22824A] hover:bg-[#22824A] hover:text-white'
    : 'border-[#CE5702] text-[#CE5702] hover:bg-[#CE5702] hover:text-white'
  return (
    <button className={`h-[40px] px-4 rounded-[5px] border text-[12px] font-medium transition ${cls}`}>
      {children}
    </button>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`w-3 h-3 rounded-[2px] ${color}`} />
      {label}
    </span>
  )
}

function Tag({ label }: { label: string }) {
  const colors: Record<string, string> = {
    '1음절': 'bg-yellow-100 text-[#585858]',
    룰렛: 'bg-green-100 text-[#585858]',
    주사위: 'bg-blue-100 text-[#585858]',
    문장: 'bg-pink-100 text-[#585858]'
  }
  const cls = colors[label] ?? 'bg-yellow-100 text-[#585858]'
  return <span className={`inline-block px-2 py-0.5 rounded-[10px] text-[12px] ${cls}`}>{label}</span>
}

const GROUPED_CHART_H = 200

function GroupedBarChart({ groups }: { groups: ChartGroup[] }) {
  const maxAcc = Math.max(...groups.map(g => g.accuracy), 1)
  const maxTry = Math.max(...groups.map(g => g.tryCount), 1)
  const maxDur = Math.max(...groups.map(g => g.duration), 1)
  const BAR_AREA = GROUPED_CHART_H - 32

  return (
    <div className="bg-white border border-[#DEDEDE] rounded-[5px] px-8 pt-4 pb-0">
      {groups.length === 0 ? (
        <div className="flex items-center justify-center text-[14px] text-[#B5B5B5]" style={{ height: GROUPED_CHART_H }}>
          데이터 없음
        </div>
      ) : (
        <div className="flex items-end justify-around border-b border-[#DEDEDE]" style={{ height: GROUPED_CHART_H }}>
          {groups.map((g, i) => {
            const aH = g.accuracy > 0 ? Math.max(Math.round((g.accuracy / maxAcc) * BAR_AREA), 4) : 0
            const tH = g.tryCount > 0 ? Math.max(Math.round((g.tryCount / maxTry) * BAR_AREA), 4) : 0
            const dH = g.duration > 0 ? Math.max(Math.round((g.duration / maxDur) * BAR_AREA), 4) : 0
            return (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className="flex items-end gap-[6px]">
                  <SingleBar value={g.accuracy} height={aH} color="#FF6767" />
                  <SingleBar value={g.tryCount}  height={tH} color="#FF9873" />
                  <SingleBar value={g.duration}  height={dH} color="#5EBC93" />
                </div>
                <span className="text-[15px] font-semibold text-[#343A40] pb-2">{g.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function SingleBar({ value, height, color }: { value: number; height: number; color: string }) {
  return (
    <div className="flex flex-col items-center gap-[4px]">
      <span className="text-[13px] text-[#343A40]">{value > 0 ? value : 0}</span>
      <div
        style={{
          width: '37px',
          height: height > 0 ? `${height}px` : '0px',
          backgroundColor: color,
          borderRadius: '4px 4px 0 0',
        }}
      />
    </div>
  )
}

function ChartStatLine({ color, text }: { color: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-[15px] font-semibold text-[#343A40]">
      <span className="w-4 h-4 rounded-[2px] flex-shrink-0" style={{ backgroundColor: color }} />
      <span>
        {text.split(/(\d+)/g).map((part, i) =>
          /^\d+$/.test(part) ? (
            <span key={i} style={{ color: '#FD8D65' }}>{part}</span>
          ) : part
        )}
      </span>
    </div>
  )
}

function SmallPagination() {
  return (
    <div className="flex items-center justify-center gap-1 mt-6">
      <button className="w-7 h-7 rounded-[3px] text-[15px] font-medium bg-[#DEDEDE] text-[#585858]">
        1
      </button>
    </div>
  )
}
