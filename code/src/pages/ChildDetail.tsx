import { useEffect, useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { useAuth, roleLabel, type Role } from '../lib/auth'
import { api, type ChildDetailDto, type DiagnosisListItem, type TreatmentListItem, type StaffItem } from '../lib/api'

type Props = { id: number }

const FALLBACK_DETAIL: ChildDetailDto = {
  child: {
    id: 1,
    identifier: 'HBD_P_001',
    name: '김동동',
    birth_date: '2019.05.12',
    age_label: '만 6세',
    primary_diagnosis: '조음장애',
    service_started_at: '2025.12.01',
    app_login_id: 'kimdongdong',
    next_doctor_appointment: '2025.11.25',
    next_therapy_appointment: null,
    doctor_id: 'HBD_D_001',
    doctor_name: '김OO',
    doctor_department: '재활의학과',
    therapist_id: 'HBD_T_001',
    therapist_name: '김민지',
    therapist_department: '언어치료학과',
    therapist_schedule: '매주 월 16:00'
  },
  memos: []
}

const FALLBACK_DIAGNOSES: DiagnosisListItem[] = []

const FALLBACK_TREATMENTS: TreatmentListItem[] = [
  { id: 1, treated_at: '2025.11.24', session_no: 13, trained_sound: '어두초성 ㅅ', tags_json: '["1음절","룰렛"]',  try_count: 30, avg_accuracy_pct: 45, duration_minutes: 15 },
  { id: 2, treated_at: '2025.11.20', session_no: 12, trained_sound: '어두초성 ㅅ', tags_json: '["1음절","주사위"]', try_count: 35, avg_accuracy_pct: 52, duration_minutes: 14 },
  { id: 3, treated_at: '2025.11.16', session_no: 11, trained_sound: '어두초성 ㅅ', tags_json: '["1음절","문장"]',  try_count: 40, avg_accuracy_pct: 60, duration_minutes: 16 }
]

export default function ChildDetail({ id }: Props) {
  const { go } = useRouter()
  const [detail, setDetail] = useState<ChildDetailDto>(FALLBACK_DETAIL)
  const [diagnoses, setDiagnoses] = useState<DiagnosisListItem[]>(FALLBACK_DIAGNOSES)
  const [treatments, setTreatments] = useState<TreatmentListItem[]>(FALLBACK_TREATMENTS)

  const loadDetail = () => api.childDetail(id).then(setDetail).catch(() => {})

  useEffect(() => {
    loadDetail()
    api.childDiagnoses(id).then(setDiagnoses).catch(() => {})
    api.childTreatments(id).then(setTreatments).catch(() => {})
  }, [id])

  const memoByType = useMemo(() => {
    const m: Record<Role, { content: string; updated_at: string } | null> = {
      admin: null,
      doctor: null,
      therapist: null
    }
    for (const r of detail.memos) m[r.type] = { content: r.content, updated_at: r.updated_at }
    return m
  }, [detail.memos])

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-10 py-8 space-y-12">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold text-ink-900">아동 정보</h2>
            <button
              type="button"
              onClick={() => go({ name: 'list' })}
              className="text-[12px] text-ink-900 hover:text-brand transition-colors"
            >
              목록으로 돌아가기 &gt;
            </button>
          </div>

          {/* Info Table */}
          <InfoCard child={detail.child} childId={id} onUpdate={loadDetail} />

          {/* Memo Cards */}
          <section>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <MemoCard
                childId={id}
                role="admin"
                initial={memoByType.admin?.content ?? ''}
                lastEdited={memoByType.admin?.content ? (memoByType.admin.updated_at ?? '-') : '-'}
              />
              <MemoCard
                childId={id}
                role="doctor"
                initial={memoByType.doctor?.content ?? ''}
                lastEdited={memoByType.doctor?.content ? (memoByType.doctor.updated_at ?? '-') : '-'}
              />
              <MemoCard
                childId={id}
                role="therapist"
                initial={memoByType.therapist?.content ?? ''}
                lastEdited={memoByType.therapist?.content ? (memoByType.therapist.updated_at ?? '-') : '-'}
              />
            </div>
          </section>

          {/* 진단 이력 */}
          <DiagnosisSection childId={id} diagnoses={diagnoses} />

          {/* 치료 이력 */}
          <TreatmentSection childId={id} treatments={treatments} />

          <div className="text-[12px] text-ink-400 pt-4">아동 ID: {id}</div>
        </main>
      </div>
    </div>
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

function InfoCard({
  child,
  childId,
  onUpdate
}: {
  child: ChildDetailDto['child']
  childId: number
  onUpdate: () => void
}) {
  const { user } = useAuth()
  const isDoctor = user?.role === 'doctor'

  const [diagInputMode, setDiagInputMode] = useState(false)
  const [diagValue, setDiagValue] = useState('')
  const [diagSaving, setDiagSaving] = useState(false)
  const [showTherapistModal, setShowTherapistModal] = useState(false)

  const saveDiagnosis = async () => {
    if (!diagValue.trim()) return
    setDiagSaving(true)
    try {
      await api.updatePrimaryDiagnosis(childId, diagValue.trim())
      setDiagInputMode(false)
      setDiagValue('')
      onUpdate()
    } catch {
      alert('저장에 실패했습니다.')
    } finally {
      setDiagSaving(false)
    }
  }

  const durationLabel = serviceDurationLabel(child.service_started_at)

  return (
    <>
      <div className="rounded-md border border-[#DEDEDE] bg-white overflow-hidden">

        {/* Row 1: 아동명 */}
        <TableRow label="아동명">
          <span className="text-[#585858] font-medium">{child.name}</span>
          <span className="text-[#484848] ml-8">{child.identifier}</span>
        </TableRow>

        {/* Row 2: 생년원일 */}
        <TableRow label="생년원일">
          <span className="text-[#585858]">{child.birth_date ?? '-'}</span>
          {child.age_label && (
            <span className="text-[#585858] ml-8">{child.age_label}</span>
          )}
        </TableRow>

        {/* Row 3: 주진단 */}
        <TableRow label="주진단">
          {diagInputMode ? (
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                value={diagValue}
                onChange={(e) => setDiagValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveDiagnosis() }}
                placeholder="주진단 입력"
                autoFocus
                className="flex-1 h-8 px-2 border border-[#CCCCCC] rounded-[4px] text-[14px] focus:outline-none focus:border-[#005744]"
              />
              <button
                onClick={saveDiagnosis}
                disabled={diagSaving || !diagValue.trim()}
                className="h-8 px-3 rounded-[4px] bg-[#005744] text-white text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {diagSaving ? '저장 중…' : '저장'}
              </button>
              <button
                onClick={() => { setDiagInputMode(false); setDiagValue('') }}
                className="h-8 px-3 rounded-[4px] border border-[#CCCCCC] text-[#585858] text-[13px]"
              >
                취소
              </button>
            </div>
          ) : child.primary_diagnosis ? (
            <div className="flex items-center gap-4">
              <span className="text-[#585858]">{child.primary_diagnosis}</span>
              {isDoctor && (
                <button
                  onClick={() => { setDiagValue(child.primary_diagnosis!); setDiagInputMode(true) }}
                  className="h-8 px-4 rounded-[4px] border border-[#005744] text-[#005744] text-[13px] font-medium hover:bg-[#005744] hover:text-white transition-colors"
                >
                  수정하기
                </button>
              )}
            </div>
          ) : isDoctor ? (
            <button
              onClick={() => setDiagInputMode(true)}
              className="h-8 px-4 rounded-[4px] border border-[#005744] text-[#005744] text-[13px] font-medium hover:bg-[#005744] hover:text-white transition-colors"
            >
              입력하기
            </button>
          ) : (
            <span className="text-[#B0B0B0]">-</span>
          )}
        </TableRow>

        {/* Row 4: 담당 의사 */}
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

        {/* Row 5: 담당 치료사 */}
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
          ) : isDoctor ? (
            <button
              onClick={() => setShowTherapistModal(true)}
              className="h-8 px-4 rounded-[4px] border border-[#005744] text-[#005744] text-[13px] font-medium hover:bg-[#005744] hover:text-white transition-colors"
            >
              배정하기
            </button>
          ) : (
            <span className="text-[#585858]">미배정</span>
          )}
        </TableRow>

        {/* Row 6: 하이동동 시작일 */}
        <TableRow label="하이동동 시작일" last>
          <span className="text-[#585858]">{child.service_started_at ?? '-'}</span>
          {durationLabel && (
            <span className="text-[#585858] ml-8">{durationLabel}</span>
          )}
        </TableRow>

      </div>

      {showTherapistModal && (
        <AssignTherapistModal
          childId={childId}
          onAssigned={() => { setShowTherapistModal(false); onUpdate() }}
          onClose={() => setShowTherapistModal(false)}
        />
      )}
    </>
  )
}

/* ---------------------------------- */
/* Assign Therapist Modal             */
/* ---------------------------------- */
function AssignTherapistModal({
  childId,
  onAssigned,
  onClose
}: {
  childId: number
  onAssigned: () => void
  onClose: () => void
}) {
  const [therapists, setTherapists] = useState<StaffItem[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)

  useEffect(() => {
    api.staff(['therapist'])
      .then(setTherapists)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleAssign = async (code: string) => {
    setAssigning(true)
    try {
      await api.assignTherapist(childId, code)
      onAssigned()
    } catch {
      alert('배정에 실패했습니다.')
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-[8px] w-[400px] max-h-[480px] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="text-[16px] font-semibold text-ink-850">담당 치료사 배정</h3>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 2l14 14M16 2 2 16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded animate-pulse bg-surface-active" />
              ))}
            </div>
          ) : therapists.length === 0 ? (
            <p className="text-center text-ink-400 py-8">배정 가능한 치료사가 없습니다.</p>
          ) : (
            <ul className="space-y-1">
              {therapists.map((t) => (
                <li key={t.code}>
                  <button
                    onClick={() => handleAssign(t.code)}
                    disabled={assigning}
                    className="w-full h-10 px-4 rounded-[5px] text-left text-[14px] text-ink-700 hover:bg-surface-active transition-colors disabled:opacity-50"
                  >
                    {t.name} <span className="text-ink-400 text-[12px]">({t.code})</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- */
/* Memo Card — RBAC + 저장 API         */
/* ---------------------------------- */
function MemoCard({
  childId,
  role,
  initial,
  lastEdited
}: {
  childId: number
  role: Role
  initial: string
  lastEdited: string
}) {
  const [value, setValue] = useState(initial)
  const [savedAt, setSavedAt] = useState(lastEdited)
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()
  const canEdit = user?.role === role
  const title = `${roleLabel(role)} 메모`

  useEffect(() => {
    setValue(initial)
    setSavedAt(lastEdited)
  }, [initial, lastEdited])

  const handleSave = async () => {
    if (!canEdit || saving) return
    setSaving(true)
    try {
      const res = await api.saveMemo(childId, role, value)
      setSavedAt(res.updated_at)
    } catch (e) {
      alert('저장에 실패했습니다. (워커가 실행 중인지 확인해주세요)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface-card border border-line rounded-[5px] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[18px] font-semibold text-ink-850">{title}</h3>
          {!canEdit && (
            <span className="text-[11px] text-ink-400 px-2 py-0.5 rounded-full bg-surface-active">읽기 전용</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || saving}
          className="h-10 px-5 rounded-[5px] bg-brand text-white text-[15px] font-medium hover:opacity-90 transition disabled:bg-ink-300 disabled:cursor-not-allowed"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        readOnly={!canEdit}
        placeholder={canEdit ? '메모를 입력하세요' : '아직 작성된 메모가 없습니다.'}
        className="w-full h-[100px] resize-none border border-line rounded-[5px] p-3 text-[14px] text-ink-700 focus:outline-none focus:border-brand read-only:bg-surface-active read-only:cursor-not-allowed"
      />
      <div className="mt-3 text-[12px] text-ink-200">최종 정보 수정일시 : {savedAt}</div>
    </div>
  )
}

/* ---------------------------------- */
/* 진단 이력                           */
/* ---------------------------------- */
function DiagnosisSection({ childId, diagnoses }: { childId: number; diagnoses: DiagnosisListItem[] }) {
  const { go } = useRouter()
  const [range, setRange] = useState<'today' | '1w' | '1m' | '3m' | '12m'>('1m')
  const latest = diagnoses[0]

  return (
    <section>
      <h2 className="text-[18px] font-semibold text-ink-900 mb-5">진단 이력</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 mb-6">
        <div className="bg-surface-card border border-line rounded-[5px] p-5">
          <div className="text-[18px] font-medium text-ink-850 mb-1">최근진단일</div>
          <div className="text-[14px] text-ink-500">
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
        <span className="text-[12px] text-ink-900">[데이터 다운로드]</span>
        <OutlineButton>엑셀 다운</OutlineButton>
        <OutlineButton>PDF 다운</OutlineButton>
      </div>

      <div className="overflow-x-auto rounded-md border border-line bg-surface-card">
        <table className="w-full min-w-[800px] text-[15px]">
          <thead>
            <tr className="border-b border-line bg-line-soft">
              <Th className="w-10"><span className="sr-only">선택</span></Th>
              <Th>진단일시</Th>
              <Th>사용시간</Th>
              <Th>정확도</Th>
              <Th>진단 결과 요약</Th>
              <Th className="w-32">상세보기</Th>
            </tr>
          </thead>
          <tbody>
            {diagnoses.length === 0 && (
              <tr>
                <td colSpan={6} className="h-[80px] text-center text-ink-400">진단 기록이 없습니다.</td>
              </tr>
            )}
            {diagnoses.map((row) => (
              <tr
                key={row.id}
                onClick={() => go({ name: 'diagnosis', childId, diagnosisId: row.id })}
                className="cursor-pointer hover:bg-surface-active transition-colors"
              >
                <Td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" className="w-5 h-5 rounded-[3px] border border-ink-850 accent-brand" />
                </Td>
                <Td className="text-ink-850">{row.examined_at}</Td>
                <Td className="text-ink-850">{row.duration_label ?? '-'}</Td>
                <Td className="text-ink-850">{row.accuracy_pct != null ? `${row.accuracy_pct}%` : '-'}</Td>
                <Td className="text-ink-850">{row.summary ?? '-'}</Td>
                <Td>
                  <button className="inline-flex items-center gap-1 text-ink-850 hover:text-brand">
                    상세보기
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="m1 1 4 4-4 4" strokeLinecap="round" />
                    </svg>
                  </button>
                </Td>
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
  // treated_at 은 'YYYY.MM.DD' 또는 'YYYY.MM.DD HH:MM' 형식 — 날짜 부분만 사용
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
    accuracy:  { labels, values: accuracyVals, maxValue: 100,                              stat: `${periodLabel} 평균 발음 정확도는 ${avgAcc}%에요.` },
    tryCount:  { labels, values: tryVals,       maxValue: Math.max(...tryVals,      1),    stat: `${periodLabel} 총 ${totalTry}회 발음했어요.` },
    duration:  { labels, values: durationVals,  maxValue: Math.max(...durationVals, 1),    stat: `${periodLabel} 총 ${totalMin}분을 연습했어요.` }
  }
}

function TreatmentSection({ childId, treatments }: { childId: number; treatments: TreatmentListItem[] }) {
  const { go } = useRouter()
  const [period, setPeriod] = useState<'week' | 'month' | '3month'>('week')
  const [range, setRange] = useState<'today' | '1w' | '1m' | '3m' | '12m'>('1m')

  const chartData = useMemo(() => buildChartData(treatments, period), [treatments, period])

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[18px] font-semibold text-ink-900">치료 이력</h2>
        <div className="flex items-center gap-4 text-[15px]">
          {(['week', 'month', '3month'] as const).map((p) => {
            const label = p === 'week' ? '주간' : p === 'month' ? '월간' : '3개월'
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`pb-1 border-b-2 ${
                  period === p ? 'border-brand text-brand font-semibold' : 'border-transparent text-ink-500'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-6 mb-4 text-[14px] text-ink-850">
        <LegendDot color="bg-chart-green" label="P (성공)" />
        <LegendDot color="bg-chart-orange" label="F (실패)" />
        <LegendDot color="bg-chart-red" label="T (시도)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard title="정확도 (%)"   data={chartData.accuracy} />
        <ChartCard title="발음 횟수 (회)" data={chartData.tryCount} />
        <ChartCard title="훈련시간 (분)" data={chartData.duration} />
      </div>

      <DateRangeFilter range={range} onChange={setRange} />

      <div className="flex items-center justify-end gap-3 my-4">
        <span className="text-[12px] text-ink-900">[데이터 다운로드]</span>
        <OutlineButton>엑셀 다운</OutlineButton>
        <OutlineButton>PDF 다운</OutlineButton>
      </div>

      <div className="overflow-x-auto rounded-md border border-line bg-surface-card">
        <table className="w-full min-w-[900px] text-[15px]">
          <thead>
            <tr className="border-b border-line bg-line-soft">
              <Th>치료일시</Th>
              <Th>회기</Th>
              <Th>훈련조음</Th>
              <Th>치료 분야</Th>
              <Th>발음 시도 횟수</Th>
              <Th>평균정확도</Th>
              <Th className="w-32">상세보기</Th>
            </tr>
          </thead>
          <tbody>
            {treatments.length === 0 && (
              <tr>
                <td colSpan={7} className="h-[80px] text-center text-ink-400">치료 기록이 없습니다.</td>
              </tr>
            )}
            {treatments.map((row) => {
              const tags = parseTags(row.tags_json)
              return (
                <tr
                  key={row.id}
                  onClick={() => go({ name: 'treatment', childId, treatmentId: row.id })}
                  className="cursor-pointer hover:bg-surface-active transition-colors"
                >
                  <Td className="text-ink-850">{row.treated_at}</Td>
                  <Td className="text-ink-850">{row.session_no ?? '-'}회기</Td>
                  <Td className="text-ink-850">{row.trained_sound ?? '-'}</Td>
                  <Td>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {tags.map((t) => (
                        <Tag key={t} label={t} />
                      ))}
                    </div>
                  </Td>
                  <Td className="text-ink-850">{row.try_count ?? 0}회</Td>
                  <Td className="text-ink-850">{row.avg_accuracy_pct != null ? `${row.avg_accuracy_pct}%` : '-'}</Td>
                  <Td>
                    <button className="inline-flex items-center gap-1 text-ink-850 hover:text-brand">
                      상세보기
                      <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="m1 1 4 4-4 4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </Td>
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
    <th className={`h-[45px] px-3 text-center font-medium text-[15px] text-ink-850 ${className}`}>
      {children}
    </th>
  )
}

function Td({
  children,
  className = '',
  onClick
}: {
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void
}) {
  return (
    <td onClick={onClick} className={`h-[45px] px-3 text-center border-t border-line ${className}`}>
      {children}
    </td>
  )
}

function MetricBlock({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className="bg-surface-card border border-line rounded-[5px] p-4 flex flex-col justify-between min-w-[140px]">
      <div>
        <div className="text-[14px] font-medium text-ink-850 leading-snug">{label}</div>
        <div className="text-[12px] text-ink-400 mt-1">{sub}</div>
      </div>
      <div className="text-[24px] font-semibold text-brand mt-3">{value}</div>
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
    ['today', '오늘'],
    ['1w', '1주일'],
    ['1m', '1개월'],
    ['3m', '3개월'],
    ['12m', '12개월']
  ]

  return (
    <div className="flex flex-wrap items-center gap-3 bg-surface-card border border-line rounded-[5px] p-4">
      <span className="text-[15px] font-medium text-ink-850">조회기간</span>
      <div className="flex items-center gap-2">
        {chips.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`h-7 px-3 rounded-[3px] text-[12px] font-medium border transition ${
              range === key
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface-card text-ink-700 hover:border-brand'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-2">
        <DateInput value="2025.02.03" />
        <span className="text-ink-500">~</span>
        <DateInput value="2025.03.03" />
      </div>

      <button className="h-7 px-4 rounded-[3px] bg-brand text-white text-[12px] font-medium ml-auto hover:opacity-90 transition">
        조회
      </button>
    </div>
  )
}

function DateInput({ value }: { value: string }) {
  return (
    <div className="relative">
      <input
        type="text"
        defaultValue={value}
        className="h-7 w-[110px] px-2 pr-7 border border-line rounded-[3px] text-[12px] text-ink-700 focus:outline-none focus:border-brand"
        readOnly
      />
      <svg className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    </div>
  )
}

function OutlineButton({ children }: { children: React.ReactNode }) {
  return (
    <button className="h-9 px-3 rounded-[5px] border border-brand text-brand text-[14px] font-medium hover:bg-brand hover:text-white transition-colors">
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
    '1음절': 'bg-tag-yellow text-ink-700',
    룰렛: 'bg-tag-green text-ink-700',
    주사위: 'bg-tag-blue text-ink-700',
    문장: 'bg-tag-pink text-ink-700'
  }
  const cls = colors[label] ?? 'bg-tag-yellow text-ink-700'
  return <span className={`inline-block px-2 py-0.5 rounded-[10px] text-[12px] ${cls}`}>{label}</span>
}

type ChartCardData = { labels: string[]; values: number[]; maxValue: number; stat: string }

function ChartCard({ title, data }: { title: string; data: ChartCardData }) {
  const { labels, values, maxValue, stat } = data
  return (
    <div className="bg-surface-card border border-line rounded-[5px] p-4">
      <div className="text-[14px] font-medium text-ink-850 mb-3">{title}</div>
      <div className="h-[140px] flex items-end gap-3 border-b border-dashed border-line-dash relative">
        <span className="absolute top-0 right-0 text-[10px] text-ink-300">목표</span>
        {labels.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[12px] text-ink-400 pb-4">데이터 없음</div>
        ) : labels.map((label, i) => {
          const pct = maxValue > 0 ? Math.round((values[i] / maxValue) * 100) : 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '120px' }}>
                <span className="w-2 bg-chart-green  rounded-sm" style={{ height: `${pct}%` }} />
                <span className="w-2 bg-chart-orange rounded-sm" style={{ height: `${pct > 0 ? Math.max(8, pct - 20) : 0}%` }} />
                <span className="w-2 bg-chart-red    rounded-sm" style={{ height: `${pct > 0 ? Math.max(15, pct - 10) : 0}%` }} />
              </div>
              <span className="text-[11px] text-ink-500 truncate max-w-full">{label}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 text-[13px] text-ink-700">
        {stat.split(/(\d+%?|\d+회|\d+분)/g).map((part, i) =>
          /\d/.test(part) ? (
            <span key={i} className="text-accent-highlight font-semibold">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </div>
    </div>
  )
}

function SmallPagination({ pages = [1] }: { pages?: number[] }) {
  if (pages.length <= 1) {
    return (
      <div className="flex items-center justify-center gap-1 mt-6">
        <button className="w-7 h-7 rounded-[3px] text-[15px] font-medium bg-line-dash text-ink-700">
          1
        </button>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center gap-1 mt-6 text-[15px] text-ink-500">
      <button className="w-7 h-7 grid place-items-center hover:text-brand">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 1 1 6l5 5" strokeLinecap="round" /></svg>
      </button>
      {pages.map((n) => (
        <button
          key={n}
          className={`w-7 h-7 rounded-[3px] font-medium transition ${
            n === 1 ? 'bg-line-dash text-ink-700' : 'text-ink-500 hover:bg-surface-active'
          }`}
        >
          {n}
        </button>
      ))}
      <button className="w-7 h-7 grid place-items-center hover:text-brand">
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="m1 1 5 5-5 5" strokeLinecap="round" /></svg>
      </button>
    </div>
  )
}
