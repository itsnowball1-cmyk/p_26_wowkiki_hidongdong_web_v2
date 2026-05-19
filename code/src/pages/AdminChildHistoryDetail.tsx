import { useEffect, useMemo, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { api, type ChildDetailDto, type DiagnosisListItem, type TreatmentListItem } from '../lib/api'

type Props = { id: number }

export default function AdminChildHistoryDetail({ id }: Props) {
  const { go } = useRouter()
  const [detail, setDetail] = useState<ChildDetailDto | null>(null)
  const [diagnoses, setDiagnoses] = useState<DiagnosisListItem[]>([])
  const [treatments, setTreatments] = useState<TreatmentListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.childDetail(id),
      api.childDiagnoses(id),
      api.childTreatments(id),
    ])
      .then(([d, diag, treat]) => {
        setDetail(d)
        setDiagnoses(diag)
        setTreatments(treat)
      })
      .catch(() => go({ name: 'admin-child-history' }))
      .finally(() => setLoading(false))
  }, [id])

  const memoByType = useMemo(() => {
    if (!detail) return { admin: null, doctor: null, therapist: null }
    const m: Record<string, { content: string; updated_at: string } | null> = {
      admin: null, doctor: null, therapist: null
    }
    for (const r of detail.memos) m[r.type] = { content: r.content, updated_at: r.updated_at }
    return m
  }, [detail])

  if (loading) {
    return (
      <div className="min-h-screen flex bg-[#FAFAFA]">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <TopBar />
          <main className="flex-1 px-10 py-8 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 rounded-[5px] animate-pulse bg-[#EAEAEA]" />
            ))}
          </main>
        </div>
      </div>
    )
  }

  if (!detail) return null

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8 space-y-10 max-w-[1640px]">

          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold text-black">아동 정보</h2>
            <button
              type="button"
              onClick={() => go({ name: 'admin-child-history' })}
              className="text-[12px] text-black hover:text-[#005744] transition-colors"
            >
              목록으로 돌아가기 &gt;
            </button>
          </div>

          {/* 아동 기본 정보 */}
          <InfoCard child={detail.child} />

          {/* 메모 (관리자만 저장 가능) */}
          <section>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <MemoCard
                childId={id}
                role="admin"
                label="관리자 메모"
                canEdit
                initial={memoByType.admin?.content ?? ''}
                lastEdited={memoByType.admin?.updated_at ?? '-'}
              />
              <MemoCard
                childId={id}
                role="doctor"
                label="의사 메모"
                canEdit={false}
                initial={memoByType.doctor?.content ?? ''}
                lastEdited={memoByType.doctor?.updated_at ?? '-'}
              />
              <MemoCard
                childId={id}
                role="therapist"
                label="치료사 메모"
                canEdit={false}
                initial={memoByType.therapist?.content ?? ''}
                lastEdited={memoByType.therapist?.updated_at ?? '-'}
              />
            </div>
          </section>

          {/* 진단 이력 */}
          <DiagnosisSection childId={id} diagnoses={diagnoses} />

          {/* 치료 이력 */}
          <TreatmentSection childId={id} treatments={treatments} />

        </main>
      </div>
    </div>
  )
}

// ── 아동 기본 정보 ────────────────────────────────────────────────────────────

function InfoCard({ child }: { child: ChildDetailDto['child'] }) {
  const rows = [
    { label: '아동명', value: child.name },
    { label: '생년월일', value: child.birth_date ? `${child.birth_date}${child.age_label ? ` / ${child.age_label}` : ''}` : '-' },
    { label: '주진단', value: child.primary_diagnosis ?? '-' },
    {
      label: '담당 의사',
      value: child.doctor_name
        ? `${child.doctor_name} / ${child.doctor_id ?? '-'} · ${child.doctor_department ?? '-'}${child.next_doctor_appointment ? ` · 예약 ${child.next_doctor_appointment}` : ''}`
        : '미배정'
    },
    {
      label: '담당 치료사',
      value: child.therapist_name
        ? `${child.therapist_name} / ${child.therapist_id ?? '-'} · ${child.therapist_department ?? '-'}${child.therapist_schedule ? ` · ${child.therapist_schedule}` : ''}`
        : '미배정'
    },
    { label: '하이동동 시작일', value: child.service_started_at ?? '-' },
  ]

  return (
    <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
      <table className="w-full text-[15px]">
        <tbody>
          {rows.map(({ label, value }) => (
            <tr key={label} className="border-b border-[#DEDEDE] last:border-0">
              <td className="w-[240px] h-[52px] px-6 font-medium text-[#343A40] bg-[#EAEAEA]">{label}</td>
              <td className="h-[52px] px-6 text-[#585858]">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 메모 카드 ─────────────────────────────────────────────────────────────────

function MemoCard({
  childId,
  role,
  label,
  canEdit,
  initial,
  lastEdited,
}: {
  childId: number
  role: 'admin' | 'doctor' | 'therapist'
  label: string
  canEdit: boolean
  initial: string
  lastEdited: string
}) {
  const [value, setValue] = useState(initial)
  const [savedAt, setSavedAt] = useState(lastEdited)
  const [saving, setSaving] = useState(false)

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
    } catch {
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="h-[40px] flex items-center justify-between mb-3">
        <h3 className="text-[18px] font-semibold text-[#343A40]">{label}</h3>
        {canEdit && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-[100px] h-[40px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 transition-colors disabled:opacity-60"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        )}
      </div>
      <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden">
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          readOnly={!canEdit}
          placeholder={canEdit ? '메모를 입력하세요' : '아직 작성된 메모가 없습니다.'}
          className="w-full h-[131px] resize-none p-4 text-[15px] text-[#585858] focus:outline-none bg-white read-only:bg-[#FAFAFA] read-only:cursor-default block"
        />
      </div>
      <div className="mt-2 text-[12px] text-[#A1A1A1] tracking-[-0.04em]">
        최종 정보 수정일시 : {savedAt}
      </div>
    </div>
  )
}

// ── 진단 이력 ─────────────────────────────────────────────────────────────────

function DiagnosisSection({ childId, diagnoses }: { childId: number; diagnoses: DiagnosisListItem[] }) {
  const { go } = useRouter()
  const [range, setRange] = useState<RangeKey>('1m')
  const latest = diagnoses[0]

  return (
    <section>
      <h2 className="text-[18px] font-semibold text-black mb-5">진단 이력</h2>

      {/* 최근 진단 요약 */}
      <div className="border border-[#DEDEDE] rounded-[5px] bg-white p-5 mb-4">
        <div className="text-[18px] font-medium text-[#343A40] mb-1">최근진단일</div>
        <div className="text-[15px] text-[#585858]">
          {latest
            ? `검사일 ${latest.examined_at} · 소요시간 ${latest.duration_label ?? '-'}`
            : '진단 기록이 없습니다.'}
        </div>
      </div>

      <DateRangeFilter range={range} onChange={setRange} />

      <div className="flex items-center justify-end gap-2 my-4">
        <span className="text-[12px] text-black">[데이터 다운로드]</span>
        <DownloadBtn>엑셀 다운</DownloadBtn>
        <DownloadBtn>PDF 다운</DownloadBtn>
      </div>

      <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
        <table className="w-full table-fixed text-[15px]">
          <thead>
            <tr className="bg-[#EAEAEA] border-b border-[#DEDEDE]">
              <th className="w-[54px] h-[45px]" />
              <th className="h-[45px] text-center font-medium text-[#343A40]">진단일</th>
              <th className="h-[45px] text-center font-medium text-[#343A40]">정확도</th>
              <th className="h-[45px] text-center font-medium text-[#343A40]">진단 결과 요약</th>
              <th className="h-[45px] text-center font-medium text-[#343A40] w-[120px]">상세보기</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DEDEDE]">
            {diagnoses.length === 0 && (
              <tr>
                <td colSpan={5} className="h-[80px] text-center text-[#919191]">진단 기록이 없습니다.</td>
              </tr>
            )}
            {diagnoses.map(row => (
              <tr
                key={row.id}
                className="h-[45px] cursor-pointer hover:bg-[#FAFAFA] transition-colors"
                onClick={() => go({ name: 'diagnosis', childId, diagnosisId: row.id })}
              >
                <td className="text-center" onClick={e => e.stopPropagation()}>
                  <input type="checkbox" className="w-[18px] h-[18px] rounded-[3px] accent-[#005744]" />
                </td>
                <td className="px-3 text-center text-[#343A40] font-medium">{row.examined_at}</td>
                <td className="px-3 text-center text-[#343A40] font-medium">
                  {row.accuracy_pct != null ? `${row.accuracy_pct}%` : '-'}
                </td>
                <td className="px-3 text-center text-[#343A40] font-medium truncate">{row.summary ?? '-'}</td>
                <td className="px-3 text-center">
                  <button className="inline-flex items-center gap-1 text-[#343A40] hover:text-[#005744] text-[15px] font-medium">
                    상세보기
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="m1 1 4 4-4 4" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── 치료 이력 ─────────────────────────────────────────────────────────────────

function TreatmentSection({ childId, treatments }: { childId: number; treatments: TreatmentListItem[] }) {
  const { go } = useRouter()
  const [period, setPeriod] = useState<'week' | 'month' | '3month'>('week')
  const [range, setRange] = useState<RangeKey>('1m')

  const chartData = useMemo(() => buildChartData(treatments, period), [treatments, period])

  return (
    <section>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[18px] font-semibold text-black">치료 이력</h2>
        <div className="flex items-center gap-5 text-[15px] tracking-[-0.03em]">
          {(['week', 'month', '3month'] as const).map(p => {
            const label = p === 'week' ? '주간' : p === 'month' ? '월간' : '3개월'
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`pb-1 border-b-2 transition-colors ${
                  period === p ? 'border-[#005744] text-[#005744] font-medium' : 'border-transparent text-[#343A40]'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <ChartCard title="정확도 (%)" data={chartData.accuracy} />
        <ChartCard title="발음 횟수 (회)" data={chartData.tryCount} />
        <ChartCard title="훈련시간 (분)" data={chartData.duration} />
      </div>

      <DateRangeFilter range={range} onChange={setRange} />

      <div className="flex items-center justify-end gap-2 my-4">
        <span className="text-[12px] text-black">[데이터 다운로드]</span>
        <DownloadBtn>엑셀 다운</DownloadBtn>
        <DownloadBtn>PDF 다운</DownloadBtn>
      </div>

      <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
        <table className="w-full table-fixed text-[15px]">
          <thead>
            <tr className="bg-[#EAEAEA] border-b border-[#DEDEDE]">
              <th className="w-[54px] h-[45px]" />
              <th className="h-[45px] text-center font-medium text-[#343A40]">회기</th>
              <th className="h-[45px] text-center font-medium text-[#343A40]">치료일</th>
              <th className="h-[45px] text-center font-medium text-[#343A40]">훈련조음</th>
              <th className="h-[45px] text-center font-medium text-[#343A40]">치료 분야</th>
              <th className="h-[45px] text-center font-medium text-[#343A40]">평균정확도</th>
              <th className="h-[45px] text-center font-medium text-[#343A40]">발음 시도 횟수</th>
              <th className="h-[45px] text-center font-medium text-[#343A40] w-[100px]">상세보기</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#DEDEDE]">
            {treatments.length === 0 && (
              <tr>
                <td colSpan={8} className="h-[80px] text-center text-[#919191]">치료 기록이 없습니다.</td>
              </tr>
            )}
            {treatments.map(row => {
              const tags = parseTags(row.tags_json)
              return (
                <tr
                  key={row.id}
                  className="h-[45px] cursor-pointer hover:bg-[#FAFAFA] transition-colors"
                  onClick={() => go({ name: 'treatment', childId, treatmentId: row.id })}
                >
                  <td className="text-center" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="w-[18px] h-[18px] rounded-[3px] accent-[#005744]" />
                  </td>
                  <td className="px-2 text-center text-[#343A40] font-medium">{row.session_no ?? '-'}회기</td>
                  <td className="px-2 text-center text-[#343A40] font-medium">{row.treated_at}</td>
                  <td className="px-2 text-center text-[#343A40] font-medium">{row.trained_sound ?? '-'}</td>
                  <td className="px-2 text-center">
                    <div className="flex items-center justify-center gap-1 flex-wrap">
                      {tags.map(t => <Tag key={t} label={t} />)}
                    </div>
                  </td>
                  <td className="px-2 text-center text-[#343A40] font-medium">
                    {row.avg_accuracy_pct != null ? `${row.avg_accuracy_pct}%` : '-'}
                  </td>
                  <td className="px-2 text-center text-[#343A40] font-medium">
                    {row.try_count ?? 0}회
                  </td>
                  <td className="px-2 text-center">
                    <button className="inline-flex items-center gap-1 text-[#343A40] hover:text-[#005744] text-[15px] font-medium">
                      상세보기
                      <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="m1 1 4 4-4 4" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── 공통 컴포넌트 ─────────────────────────────────────────────────────────────

type RangeKey = 'today' | '1w' | '1m' | '3m' | '6m' | '12m'

function DateRangeFilter({ range, onChange }: { range: RangeKey; onChange: (r: RangeKey) => void }) {
  const chips: [RangeKey, string][] = [
    ['today', '오늘'], ['1w', '1주일'], ['1m', '1개월'],
    ['3m', '3개월'], ['6m', '6개월'], ['12m', '12개월'],
  ]
  return (
    <div className="flex flex-wrap items-center gap-3 border border-[#DEDEDE] rounded-[5px] bg-white p-4">
      <span className="text-[15px] font-medium text-[#343A40]">조회기간</span>
      <div className="flex items-center gap-2">
        {chips.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`h-[26px] px-3 rounded-[3px] text-[12px] font-medium border transition-colors ${
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
        <span className="text-[#585858]">~</span>
        <DateInput />
      </div>
      <button type="button" className="h-[26px] px-4 rounded-[3px] bg-[#005744] text-white text-[12px] font-medium ml-auto hover:bg-[#005744]/90 transition-colors">
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
        className="h-[26px] w-[110px] px-2 pr-7 border border-[#DEDEDE] rounded-[3px] text-[12px] text-[#585858] focus:outline-none focus:border-[#005744]"
        readOnly
      />
      <svg className="absolute right-2 top-1/2 -translate-y-1/2 text-[#585858] pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    </div>
  )
}

function DownloadBtn({ children }: { children: React.ReactNode }) {
  return (
    <button type="button" className="h-[34px] w-[94px] border border-[#005744] rounded-[5px] bg-white text-[12px] font-medium text-[#005744] tracking-[-0.04em] hover:bg-[#005744]/5 transition-colors">
      {children}
    </button>
  )
}

function Tag({ label }: { label: string }) {
  const colors: Record<string, string> = {
    '1음절': 'bg-[#FFF0BD] text-[#4B4B4B]',
    룰렛: 'bg-[#D8EFB9] text-[#4B4B4B]',
    주사위: 'bg-[#C7E2F5] text-[#4B4B4B]',
    문장: 'bg-[#FDD1D1] text-[#4B4B4B]',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded-[3px] text-[12px] ${colors[label] ?? 'bg-[#FFF0BD] text-[#4B4B4B]'}`}>
      {label}
    </span>
  )
}

type ChartCardData = { labels: string[]; values: number[]; maxValue: number; stat: string }

function ChartCard({ title, data }: { title: string; data: ChartCardData }) {
  const { labels, values, maxValue, stat } = data
  return (
    <div className="border border-[#DEDEDE] rounded-[5px] bg-white p-4">
      <div className="text-[15px] font-medium text-[#343A40] mb-3">{title}</div>
      <div className="h-[140px] flex items-end gap-2 border-b border-dashed border-[#CECECE] relative">
        <span className="absolute top-0 right-0 text-[10px] text-[#B2B2B2]">목표</span>
        {labels.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-[12px] text-[#919191] pb-4">데이터 없음</div>
        ) : labels.map((label, i) => {
          const pct = maxValue > 0 ? Math.round((values[i] / maxValue) * 100) : 0
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '120px' }}>
                <span className="w-2 bg-[#5EBC93] rounded-sm" style={{ height: `${pct}%` }} />
                <span className="w-2 bg-[#FF9873] rounded-sm" style={{ height: `${pct > 0 ? Math.max(8, pct - 20) : 0}%` }} />
                <span className="w-2 bg-[#FF6767] rounded-sm" style={{ height: `${pct > 0 ? Math.max(15, pct - 10) : 0}%` }} />
              </div>
              <span className="text-[11px] text-[#585858] truncate max-w-full">{label}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 text-[13px] text-[#585858]">
        {stat.split(/(\d+%?|\d+회|\d+분)/g).map((part, i) =>
          /\d/.test(part)
            ? <span key={i} className="text-[#FD8D65] font-semibold">{part}</span>
            : <span key={i}>{part}</span>
        )}
      </div>
    </div>
  )
}

function parseTags(json: string | null): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter(x => typeof x === 'string') : []
  } catch { return [] }
}

function buildChartData(treatments: TreatmentListItem[], period: 'week' | 'month' | '3month') {
  const cutoffDays = period === 'week' ? 7 : period === 'month' ? 30 : 90
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - cutoffDays)
  cutoff.setHours(0, 0, 0, 0)

  const parseDateStr = (s: string) => {
    const [y, m, d] = s.split('.').map(Number)
    return new Date(y, m - 1, d)
  }

  const filtered = treatments
    .filter(t => t.treated_at && parseDateStr(t.treated_at) >= cutoff)
    .slice(-7)
  const rev = [...filtered].reverse()

  const labels = rev.map(t => {
    const p = t.treated_at.split('.')
    return p.length >= 3 ? `${Number(p[1])}/${Number(p[2])}` : t.treated_at
  })

  const accVals = rev.map(t => t.avg_accuracy_pct ?? 0)
  const tryVals = rev.map(t => t.try_count ?? 0)
  const durVals = rev.map(t => t.duration_minutes ?? 0)
  const periodLabel = period === 'week' ? '이번주' : period === 'month' ? '이번달' : '최근 3개월'

  return {
    accuracy: {
      labels, values: accVals, maxValue: 100,
      stat: `${periodLabel} 평균 발음 정확도는 ${accVals.length ? Math.round(accVals.reduce((a, b) => a + b, 0) / accVals.length) : 0}%에요.`
    },
    tryCount: {
      labels, values: tryVals, maxValue: Math.max(...tryVals, 1),
      stat: `${periodLabel} 총 ${tryVals.reduce((a, b) => a + b, 0)}회 발음했어요.`
    },
    duration: {
      labels, values: durVals, maxValue: Math.max(...durVals, 1),
      stat: `${periodLabel} 총 ${durVals.reduce((a, b) => a + b, 0)}분을 연습했어요.`
    },
  }
}
