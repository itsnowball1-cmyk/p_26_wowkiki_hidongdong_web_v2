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
function DiagnosisSection({ diagnoses }: { diagnoses: DiagnosisListItem[] }) {
  const [range, setRange] = useState<'today' | '1w' | '1m' | '3m' | '12m'>('1m')
  const latest = diagnoses[0]

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

      <DateRangeFilter range={range} onChange={setRange} />

      <div className="flex items-center justify-end gap-3 my-4">
        <span className="text-[12px] text-[#343A40]">[데이터 다운로드]</span>
        <OutlineButton color="green">엑셀 다운</OutlineButton>
        <OutlineButton color="orange">PDF 다운</OutlineButton>
      </div>

      <div className="overflow-x-auto rounded-md border border-[#DEDEDE] bg-white">
        <table className="w-full min-w-[800px] text-[15px]">
          <thead>
            <tr className="border-b border-[#DEDEDE] bg-[#EAEAEA]">
              <Th>진단일시</Th>
              <Th>사용시간</Th>
              <Th>정확도</Th>
              <Th>진단 결과 요약</Th>
            </tr>
          </thead>
          <tbody>
            {diagnoses.length === 0 && (
              <tr>
                <td colSpan={4} className="h-[80px] text-center text-[#B5B5B5]">진단 기록이 없습니다.</td>
              </tr>
            )}
            {diagnoses.map((row) => (
              <tr key={row.id} className="hover:bg-[#F5F5F5] transition-colors">
                <Td className="text-[#343A40]">{row.examined_at}</Td>
                <Td className="text-[#343A40]">{row.duration_label ?? '-'}</Td>
                <Td className="text-[#343A40]">{row.accuracy_pct != null ? `${row.accuracy_pct}%` : '-'}</Td>
                <Td className="text-[#343A40]">{row.summary ?? '-'}</Td>
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

function buildChartData(
  treatments: TreatmentListItem[],
  period: 'week' | 'month' | '3month'
) {
  const cutoffDays = period === 'week' ? 7 : period === 'month' ? 30 : 90
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - cutoffDays)
  cutoff.setHours(0, 0, 0, 0)

  const filtered = treatments
    .filter(t => t.treated_at && parseTreatedAt(t.treated_at) >= cutoff)
    .slice(-7)

  const labels = [...filtered].reverse().map(t => {
    const parts = t.treated_at.split(' ')[0].split('.')
    return parts.length >= 3 ? `${Number(parts[1])}/${Number(parts[2])}` : t.treated_at
  })
  const rev = [...filtered].reverse()

  const accuracyVals = rev.map(t => t.avg_accuracy_pct ?? 0)
  const tryVals      = rev.map(t => t.try_count      ?? 0)
  const durationVals = rev.map(t => t.duration_minutes ?? 0)

  const periodLabel = period === 'week' ? '이번주' : period === 'month' ? '이번달' : '최근 3개월'
  const avgAcc   = accuracyVals.length ? Math.round(accuracyVals.reduce((a, b) => a + b, 0) / accuracyVals.length) : 0
  const totalTry = tryVals.reduce((a, b) => a + b, 0)
  const totalMin = durationVals.reduce((a, b) => a + b, 0)

  return {
    accuracy:  { labels, values: accuracyVals, maxValue: 100,                           stat: `${periodLabel} 평균 발음 정확도는 ${avgAcc}%에요.` },
    tryCount:  { labels, values: tryVals,       maxValue: Math.max(...tryVals,      1), stat: `${periodLabel} 총 ${totalTry}회 발음했어요.` },
    duration:  { labels, values: durationVals,  maxValue: Math.max(...durationVals, 1), stat: `${periodLabel} 총 ${totalMin}분을 연습했어요.` }
  }
}

function TreatmentSection({ treatments }: { treatments: TreatmentListItem[] }) {
  const [period, setPeriod] = useState<'week' | 'month' | '3month'>('week')
  const [range, setRange] = useState<'today' | '1w' | '1m' | '3m' | '12m'>('1m')

  const chartData = useMemo(() => buildChartData(treatments, period), [treatments, period])

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[18px] font-semibold text-[#343A40]">치료 이력</h2>
        <div className="flex items-center gap-4 text-[15px]">
          {(['week', 'month', '3month'] as const).map((p) => {
            const label = p === 'week' ? '주간' : p === 'month' ? '월간' : '3개월'
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`pb-1 border-b-2 ${
                  period === p ? 'border-[#005744] text-[#005744] font-semibold' : 'border-transparent text-[#919191]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-6 mb-4 text-[14px] text-[#343A40]">
        <LegendDot color="bg-[#4CAF50]" label="P (성공)" />
        <LegendDot color="bg-[#FF9800]" label="F (실패)" />
        <LegendDot color="bg-[#F44336]" label="T (시도)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard title="정확도 (%)"    data={chartData.accuracy} />
        <ChartCard title="발음 횟수 (회)" data={chartData.tryCount} />
        <ChartCard title="훈련시간 (분)"  data={chartData.duration} />
      </div>

      <DateRangeFilter range={range} onChange={setRange} />

      <div className="flex items-center justify-end gap-3 my-4">
        <span className="text-[12px] text-[#343A40]">[데이터 다운로드]</span>
        <OutlineButton color="green">엑셀 다운</OutlineButton>
        <OutlineButton color="orange">PDF 다운</OutlineButton>
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
            {treatments.length === 0 && (
              <tr>
                <td colSpan={6} className="h-[80px] text-center text-[#B5B5B5]">치료 기록이 없습니다.</td>
              </tr>
            )}
            {treatments.map((row) => {
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
  range,
  onChange
}: {
  range: 'today' | '1w' | '1m' | '3m' | '12m'
  onChange: (r: 'today' | '1w' | '1m' | '3m' | '12m') => void
}) {
  const chips: Array<['today' | '1w' | '1m' | '3m' | '12m', string]> = [
    ['today', '오늘'], ['1w', '1주일'], ['1m', '1개월'], ['3m', '3개월'], ['12m', '12개월']
  ]

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border border-[#DEDEDE] rounded-[5px] p-4">
      <span className="text-[15px] font-medium text-[#343A40]">조회기간</span>
      <div className="flex items-center gap-2">
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
        <DateInput />
        <span className="text-[#919191]">~</span>
        <DateInput />
      </div>
      <button className="h-7 px-4 rounded-[3px] bg-[#005744] text-white text-[12px] font-medium ml-auto hover:opacity-90 transition">
        조회
      </button>
    </div>
  )
}

function DateInput() {
  return (
    <div className="relative">
      <input
        type="text"
        className="h-7 w-[110px] px-2 pr-7 border border-[#DEDEDE] rounded-[3px] text-[12px] text-[#585858] focus:outline-none focus:border-[#005744]"
        readOnly
      />
      <svg className="absolute right-2 top-1/2 -translate-y-1/2 text-[#919191] pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
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
      <span className={`w-3 h-3 rounded-full ${color}`} />
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

type ChartCardData = { labels: string[]; values: number[]; maxValue: number; stat: string }

function ChartCard({ title, data }: { title: string; data: ChartCardData }) {
  const { labels, values, maxValue, stat } = data
  return (
    <div className="bg-white border border-[#DEDEDE] rounded-[5px] p-4">
      <div className="text-[14px] font-medium text-[#343A40] mb-3">{title}</div>
      <div className="h-[140px] flex items-end gap-3 border-b border-dashed border-[#DEDEDE] relative">
        <span className="absolute top-0 right-0 text-[10px] text-[#B0B0B0]">목표</span>
        {labels.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[12px] text-[#B5B5B5] pb-4">데이터 없음</div>
        ) : labels.map((label, i) => {
          const pct = maxValue > 0 ? Math.round((values[i] / maxValue) * 100) : 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '120px' }}>
                <span className="w-2 bg-[#4CAF50] rounded-sm" style={{ height: `${pct}%` }} />
                <span className="w-2 bg-[#FF9800] rounded-sm" style={{ height: `${pct > 0 ? Math.max(8, pct - 20) : 0}%` }} />
                <span className="w-2 bg-[#F44336] rounded-sm" style={{ height: `${pct > 0 ? Math.max(15, pct - 10) : 0}%` }} />
              </div>
              <span className="text-[11px] text-[#919191] truncate max-w-full">{label}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 text-[13px] text-[#585858]">
        {stat.split(/(\d+%?|\d+회|\d+분)/g).map((part, i) =>
          /\d/.test(part) ? (
            <span key={i} className="text-[#005744] font-semibold">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>
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
