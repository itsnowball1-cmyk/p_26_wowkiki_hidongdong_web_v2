import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api, type TreatmentDetailDto, type RecordingItem, type TreatmentListItem } from '../lib/api'
import {
  exportTreatmentToExcel,
  exportElementToPdf,
  type TreatmentExportData
} from '../lib/exporters'

type Props = { childId: number; treatmentId: number }

type RecordingTile = { word: string; url?: string }
type RecordingGroupData = { key: string; label: string; tiles: RecordingTile[] }

type SeriesKey = 'accuracy' | 'tries' | 'minutes'
const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'accuracy', label: '정확도(%)', color: '#FF6767' },
  { key: 'tries', label: '발음 횟수 (회)', color: '#FF9873' },
  { key: 'minutes', label: '훈련시간 (분)', color: '#5EBC93' }
]

const EMPTY_WEEKLY = [
  { day: '월', accuracy: 0, tries: 0, minutes: 0 },
  { day: '화', accuracy: 0, tries: 0, minutes: 0 },
  { day: '수', accuracy: 0, tries: 0, minutes: 0 },
  { day: '목', accuracy: 0, tries: 0, minutes: 0 },
  { day: '금', accuracy: 0, tries: 0, minutes: 0 },
  { day: '토', accuracy: 0, tries: 0, minutes: 0 },
  { day: '일', accuracy: 0, tries: 0, minutes: 0 }
]

export default function TreatmentDetail({ childId, treatmentId }: Props) {
  const { go } = useRouter()
  const [range, setRange] = useState<'주간' | '월간' | '3개월'>('주간')
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    accuracy: true,
    tries: true,
    minutes: true
  })
  const [exporting, setExporting] = useState<null | 'excel' | 'pdf'>(null)
  const pdfRef = useRef<HTMLDivElement>(null)
  const [detail, setDetail] = useState<TreatmentDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [recordingGroups, setRecordingGroups] = useState<RecordingGroupData[]>([])
  const [allTreatments, setAllTreatments] = useState<TreatmentListItem[]>([])

  useEffect(() => {
    api.childTreatments(childId)
      .then(setAllTreatments)
      .catch(console.error)
  }, [childId])

  useEffect(() => {
    setLoading(true)
    setDetail(null)
    setRecordingGroups([])
    api.treatmentDetail(treatmentId)
      .then(d => setDetail(d))
      .catch(console.error)
      .finally(() => setLoading(false))
    api.treatmentRecordings(treatmentId)
      .then((items: RecordingItem[]) => {
        const map = new Map<string, RecordingTile[]>()
        for (const item of items) {
          const word = item.word ?? '알 수 없음'
          if (!map.has(word)) map.set(word, [])
          map.get(word)!.push({ word, url: item.url })
        }
        setRecordingGroups(
          [...map.entries()].map(([word, tiles]) => ({ key: word, label: word, tiles }))
        )
      })
      .catch(console.error)
  }, [treatmentId])

  const weekly = detail?.weekly ?? EMPTY_WEEKLY

  // 월간: 이번달 캘린더 데이터
  const { calYear, calMonth } = useMemo(() => {
    // 가장 최근 치료 기록의 연/월 기준
    if (allTreatments.length > 0) {
      const p = allTreatments[0].treated_at?.split(' ')[0].split('.').map(Number) ?? []
      if (p.length >= 3) return { calYear: p[0], calMonth: p[1] }
    }
    const n = new Date()
    return { calYear: n.getFullYear(), calMonth: n.getMonth() + 1 }
  }, [allTreatments])

  const calendarMap = useMemo(() => {
    const map = new Map<number, { acc: number[]; tries: number; minutes: number }>()
    if (range !== '월간') return map
    for (const t of allTreatments) {
      if (!t.treated_at) continue
      const p = t.treated_at.split(' ')[0].split('.').map(Number)
      if (p.length < 3 || p[0] !== calYear || p[1] !== calMonth) continue
      if (!map.has(p[2])) map.set(p[2], { acc: [], tries: 0, minutes: 0 })
      const b = map.get(p[2])!
      if (t.avg_accuracy_pct != null) b.acc.push(t.avg_accuracy_pct)
      b.tries   += t.try_count       ?? 0
      b.minutes += t.duration_minutes ?? 0
    }
    return map
  }, [range, allTreatments, calYear, calMonth])

  // 3개월: 최근 3개월 월별 집계 막대 데이터
  const periodData = useMemo((): WeeklyPoint[] => {
    if (range !== '3개월') return []
    const now = new Date()
    const slots: { ym: string; label: string }[] = []
    for (let i = 2; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1)
      slots.push({ ym: `${m.getFullYear()}-${m.getMonth() + 1}`, label: `${m.getMonth() + 1}월` })
    }
    const buckets = new Map<string, { label: string; acc: number[]; tries: number; minutes: number }>()
    for (const { ym, label } of slots) buckets.set(ym, { label, acc: [], tries: 0, minutes: 0 })
    for (const t of allTreatments) {
      if (!t.treated_at) continue
      const p = t.treated_at.split(' ')[0].split('.').map(Number)
      if (p.length < 3) continue
      const ym = `${p[0]}-${p[1]}`
      if (!buckets.has(ym)) continue
      const b = buckets.get(ym)!
      if (t.avg_accuracy_pct != null) b.acc.push(t.avg_accuracy_pct)
      b.tries   += t.try_count       ?? 0
      b.minutes += t.duration_minutes ?? 0
    }
    return [...buckets.values()].map(b => ({
      day:      b.label,
      accuracy: b.acc.length ? Math.round(b.acc.reduce((a, v) => a + v) / b.acc.length) : 0,
      tries:    b.tries,
      minutes:  b.minutes
    }))
  }, [range, allTreatments])

  const activeData = useMemo(
    () => (range === '주간' ? weekly : periodData),
    [range, weekly, periodData]
  )

  const summary = useMemo(() => {
    if (range === '월간') {
      let totalTries = 0, totalMins = 0
      const accs: number[] = []
      for (const { acc, tries, minutes } of calendarMap.values()) {
        accs.push(...acc)
        totalTries += tries
        totalMins  += minutes
      }
      const avgAcc = accs.length ? Math.round(accs.reduce((a, v) => a + v) / accs.length) : 0
      return [
        { template: '이번달 총 ', value: String(totalMins), suffix: ' 분을 연습했어요.' },
        { template: '이번달 총 ', value: String(totalTries), suffix: ' 회 발음했어요.' },
        { template: '이번달 평균 발음 정확도는 ', value: `${avgAcc}%`, suffix: '에요.' }
      ]
    }
    const totalMins = activeData.reduce((s, d) => s + d.minutes, 0)
    const totalTries = activeData.reduce((s, d) => s + d.tries, 0)
    const activeDays = activeData.filter(d => d.accuracy > 0)
    const avgAcc = activeDays.length > 0
      ? Math.round(activeDays.reduce((s, d) => s + d.accuracy, 0) / activeDays.length)
      : 0
    const label = range === '주간' ? '이번주' : '3개월 간'
    return [
      { template: `${label} 총 `, value: String(totalMins), suffix: ' 분을 연습했어요.' },
      { template: `${label} 총 `, value: String(totalTries), suffix: ' 회 발음했어요.' },
      { template: `${label} 평균 발음 정확도는 `, value: `${avgAcc}%`, suffix: '에요.' }
    ]
  }, [range, activeData, calendarMap])

  const { prevTreatmentId, nextTreatmentId } = useMemo(() => {
    if (allTreatments.length === 0) return { prevTreatmentId: null, nextTreatmentId: null }
    const idx = allTreatments.findIndex(t => t.id === treatmentId)
    if (idx === -1) return { prevTreatmentId: null, nextTreatmentId: null }
    return {
      prevTreatmentId: idx + 1 < allTreatments.length ? allTreatments[idx + 1].id : null,
      nextTreatmentId: idx > 0 ? allTreatments[idx - 1].id : null
    }
  }, [allTreatments, treatmentId])

  const buildExport = (): TreatmentExportData => ({
    identifier: detail?.identifier ?? '',
    treatedAt: detail?.treated_at ?? '',
    sessionLabel: `${detail?.session_no ?? ''}회기`,
    serviceStartedAt: detail?.service_started_at ?? '',
    trainedSound: detail?.trained_sound ?? '',
    accuracyPct: `${detail?.accuracy_pct ?? ''}%`,
    tryCount: `${detail?.try_count ?? ''}회`,
    durationLabel: `${detail?.duration_minutes ?? ''}분`,
    fieldTag: detail?.tags?.[0] ?? '',
    weekly,
    summary: summary.map(s => `${s.template}${s.value}${s.suffix}`)
  })

  const handleExcel = async () => {
    if (exporting) return
    setExporting('excel')
    try {
      await exportTreatmentToExcel(buildExport())
    } catch (e) {
      console.error(e)
      alert('엑셀 다운로드에 실패했습니다.')
    } finally {
      setExporting(null)
    }
  }

  const handlePdf = async () => {
    if (exporting || !pdfRef.current) return
    setExporting('pdf')
    try {
      await exportElementToPdf(
        pdfRef.current,
        `치료결과_${detail?.identifier ?? ''}_${(detail?.treated_at ?? '').replace(/\./g, '')}.pdf`
      )
    } catch (e) {
      console.error(e)
      alert('PDF 다운로드에 실패했습니다.')
    } finally {
      setExporting(null)
    }
  }

  const toggleSeries = (key: SeriesKey) => setVisible(p => ({ ...p, [key]: !p[key] }))

  const { user } = useAuth()

  return (
    <div className="min-h-screen flex bg-surface">
      {user?.role === 'admin' ? <AdminSidebar /> : <Sidebar />}

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-10 py-8 space-y-8">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-baseline gap-4">
              <h1 className="text-[22px] font-semibold text-ink-900">치료 이력</h1>
              {loading ? (
                <div className="h-5 w-32 rounded bg-line-soft animate-pulse" />
              ) : (
                <>
                  <MetaLabel label="회기" value={`${detail?.session_no ?? '-'}회기`} />
                  <MetaLabel label="치료일" value={detail?.treated_at ?? '-'} />
                </>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => go({ name: 'detail', id: childId })}
                className="text-[12px] text-ink-900 hover:text-brand transition-colors"
              >
                목록으로 돌아가기 &gt;
              </button>
              <div className="flex items-center gap-2">
                <OutlineButton onClick={handleExcel} disabled={!!exporting || loading}>
                  {exporting === 'excel' ? '내보내는 중…' : '엑셀 다운'}
                </OutlineButton>
                <OutlineButton onClick={handlePdf} disabled={!!exporting || loading}>
                  {exporting === 'pdf' ? '내보내는 중…' : 'PDF 다운'}
                </OutlineButton>
              </div>
            </div>
          </div>

          <div ref={pdfRef} className="space-y-10">
            {/* 아동 기본 정보 */}
            <section>
              <SectionTitle>아동 기본 정보</SectionTitle>
              {loading ? (
                <SkeletonInfoGrid rows={1} />
              ) : (
                <InfoGrid
                  cells={[
                    ['아동 식별 코드', detail?.identifier ?? '-'],
                    ['치료시작일', detail?.service_started_at ?? '-']
                  ]}
                />
              )}
            </section>

            {/* 오늘의 치료 살펴보기 */}
            <section>
              <SectionTitle>오늘의 치료 살펴보기</SectionTitle>
              {loading ? (
                <SkeletonInfoGrid rows={2} />
              ) : (
                <InfoGrid
                  cells={[
                    ['치료한 발음', detail?.trained_sound ?? '-'],
                    ['발음 정확도', detail?.accuracy_pct != null ? `${detail.accuracy_pct}%` : '-'],
                    ['발음횟수', detail?.try_count != null ? `${detail.try_count}회` : '-'],
                    ['치료시간', detail?.duration_minutes != null ? `${detail.duration_minutes}분` : '-'],
                    ['치료분야', detail?.tags?.length ? <Tag key="tag" label={detail.tags[0]} /> : '-']
                  ]}
                />
              )}
            </section>

            {/* 진단 대비 개선 리포트 */}
            {detail?.baseline && detail?.improvement && (
              <section>
                <SectionTitle>진단 대비 개선</SectionTitle>
                <ImprovementCard baseline={detail.baseline} current={{
                  consonant_pct: detail.consonant_pct,
                  word_pos_pct: detail.word_pos_pct,
                  vowel_pct: detail.vowel_pct,
                  error_phoneme_count: detail.error_position.length,
                }} delta={detail.improvement} />
              </section>
            )}

            {/* 다음 단계 제안 — 임계 충족시만 */}
            {detail?.next_step && (
              <section>
                <SectionTitle>다음 단계 제안</SectionTitle>
                <NextStepCard step={detail.next_step} />
              </section>
            )}

            {/* 평가 결과 - 자음정확도 */}
            <section>
              <SectionTitle>평가 결과 - 자음정확도</SectionTitle>
              {(detail?.statistics ?? []).length > 0
                ? <MetricsTable rows={detail!.statistics} />
                : <EmptyState />}
            </section>

            {/* 평가 결과 - 개정 자음정확도 */}
            <section>
              <SectionTitle>평가 결과 - 개정 자음정확도</SectionTitle>
              {(detail?.revised_statistics ?? []).length > 0
                ? <MetricsTable rows={detail!.revised_statistics} />
                : <EmptyState />}
            </section>

            {/* 오류 유형 및 출현율 */}
            <section>
              <SectionTitle>오류 유형 및 출현율</SectionTitle>
              {(detail?.error_rank ?? []).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-surface-chip">
                        <Th className="w-[280px]">순위</Th>
                        <Th>오류 유형</Th>
                        <Th>출현율 (%)</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail!.error_rank.map(row => (
                        <tr key={row.rank}>
                          <Td>{row.rank}</Td>
                          <Td>{row.type}</Td>
                          <Td>{row.ratio}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState />}
            </section>

            {/* 표준 발음 vs 아동 발음 */}
            <section>
              <SectionTitle>표준 발음 vs 아동 발음</SectionTitle>
              {(detail?.mispronunciations ?? []).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-surface-chip">
                        <Th>표준 발음</Th>
                        <Th>아동 발음</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail!.mispronunciations.map(({ word, ch_pron }, i) => (
                        <tr key={i}>
                          <Td>{word}</Td>
                          <Td>{ch_pron}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState />}
            </section>

            {/* 오류 음소 및 위치 */}
            <section>
              <SectionTitle>오류 음소 및 위치</SectionTitle>
              {(detail?.error_position ?? []).length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-surface-chip">
                        <Th className="w-[280px]">오류 음소</Th>
                        <Th>오류 유형</Th>
                        <Th>위치</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail!.error_position.map(({ phoneme, count, types, positions }) => (
                        <tr key={phoneme}>
                          <Td>{count > 1 ? `${phoneme} (${count})` : phoneme}</Td>
                          <Td>{types}</Td>
                          <Td>{positions}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <EmptyState />}
            </section>


            {/* 치료녹음 듣기 — 녹음이 있을 때만 노출. PDF 에는 제외 */}
            {recordingGroups.length > 0 && (
              <section data-pdf-exclude>
                <SectionTitle>치료녹음 듣기</SectionTitle>
                <div className="space-y-6">
                  {recordingGroups.map(group => (
                    <RecordingGroup key={group.key} label={group.label} tiles={group.tiles} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Pager */}
          <div className="flex items-center justify-center gap-4 pt-4 pb-12">
            <button
              type="button"
              disabled={prevTreatmentId === null}
              className={prevTreatmentId !== null
                ? 'h-[42px] px-5 rounded-[5px] border border-brand text-brand text-[14px] font-medium hover:bg-brand hover:text-white transition-colors'
                : 'h-[42px] px-5 rounded-[5px] border border-[#CBCBCB] text-[#CCCCCC] text-[14px] font-medium cursor-not-allowed'
              }
              onClick={() => prevTreatmentId !== null && go({ name: 'treatment', childId, treatmentId: prevTreatmentId })}
            >
              &lt; 이전
            </button>
            <span className="text-[18px] font-medium text-ink-900">
              {detail?.treated_at ?? '-'}
            </span>
            <button
              type="button"
              disabled={nextTreatmentId === null}
              className={nextTreatmentId !== null
                ? 'h-[42px] px-5 rounded-[5px] border border-brand text-brand text-[14px] font-medium hover:bg-brand hover:text-white transition-colors'
                : 'h-[42px] px-5 rounded-[5px] border border-[#CBCBCB] text-[#CCCCCC] text-[14px] font-medium cursor-not-allowed'
              }
              onClick={() => nextTreatmentId !== null && go({ name: 'treatment', childId, treatmentId: nextTreatmentId })}
            >
              다음 &gt;
            </button>
          </div>

          <div className="text-[11px] text-ink-400">치료 ID: {treatmentId}</div>
        </main>
      </div>
    </div>
  )
}

/* ---------------------------------- */
/* Sub-components                     */
/* ---------------------------------- */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[18px] font-semibold text-ink-900 mb-4">{children}</h2>
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <th className={`text-[14px] font-semibold text-ink-900 px-5 py-3 text-center border border-line ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`text-[14px] text-ink-700 px-5 py-3 text-center border border-line ${className}`}>{children}</td>
}

function EmptyState() {
  return <div className="text-[14px] text-ink-400">데이터 없음</div>
}

function MetricsTable({ rows }: { rows: [string, string, string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-surface-chip">
            <Th>지표</Th>
            <Th>원점수 (%)</Th>
            <Th>백분위</Th>
            <Th>수준</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <Td>{row[0]}</Td>
              <Td>{row[1]}</Td>
              <Td>{row[2]}</Td>
              <Td>{row[3]}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ImprovementCard({
  baseline,
  current,
  delta,
}: {
  baseline: { examined_at: string | null; consonant_pct: number | null; word_pos_pct: number | null; vowel_pct: number | null; error_phoneme_count: number }
  current:  { consonant_pct: number | null; word_pos_pct: number | null; vowel_pct: number | null; error_phoneme_count: number }
  delta:    { consonant_delta: number | null; word_pos_delta: number | null; vowel_delta: number | null; error_phoneme_reduced: number | null }
}) {
  const cells: { label: string; before: number | null; after: number | null; diff: number | null; suffix: string }[] = [
    { label: '자음정확도',              before: baseline.consonant_pct, after: current.consonant_pct, diff: delta.consonant_delta, suffix: '%' },
    { label: '단어 내 위치별 자음 정확도', before: baseline.word_pos_pct,  after: current.word_pos_pct,  diff: delta.word_pos_delta,  suffix: '%' },
    { label: '모음정확도',              before: baseline.vowel_pct,    after: current.vowel_pct,    diff: delta.vowel_delta,    suffix: '%' },
  ]
  const fmt = (v: number | null, suffix = '%') => v != null ? `${v}${suffix}` : '--'
  const deltaColor = (d: number | null) => d == null ? 'text-ink-400' : d > 0 ? 'text-[#22A06B]' : d < 0 ? 'text-brand-danger' : 'text-ink-500'
  const deltaSign  = (d: number | null) => d == null ? '' : d > 0 ? `+${d}` : `${d}`
  return (
    <div className="bg-surface-card border border-line rounded-[10px] p-6 space-y-4">
      <div className="text-[13px] text-ink-500">베이스라인 진단일: {baseline.examined_at ?? '-'}</div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cells.map(c => (
          <div key={c.label} className="border border-line rounded-[6px] p-4">
            <div className="text-[13px] text-ink-500 mb-2">{c.label}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-[14px] text-ink-700">{fmt(c.before, c.suffix)}</span>
              <span className="text-[13px] text-ink-400">→</span>
              <span className="text-[20px] font-bold text-ink-900">{fmt(c.after, c.suffix)}</span>
              <span className={`text-[14px] font-semibold ml-auto ${deltaColor(c.diff)}`}>
                {c.diff != null ? `${deltaSign(c.diff)}p` : '--'}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="border border-line rounded-[6px] p-4 flex items-baseline gap-2">
        <span className="text-[13px] text-ink-500">오류 음소 수</span>
        <span className="text-[14px] text-ink-700 ml-2">{baseline.error_phoneme_count}개</span>
        <span className="text-[13px] text-ink-400">→</span>
        <span className="text-[20px] font-bold text-ink-900">{current.error_phoneme_count}개</span>
        <span className={`text-[14px] font-semibold ml-auto ${deltaColor(delta.error_phoneme_reduced)}`}>
          {delta.error_phoneme_reduced != null && delta.error_phoneme_reduced !== 0
            ? (delta.error_phoneme_reduced > 0 ? `−${delta.error_phoneme_reduced}` : `+${-delta.error_phoneme_reduced}`)
            : '0'}
        </span>
      </div>
    </div>
  )
}

function NextStepCard({ step }: { step: { sound: string | null; threshold: number; achieved: number; message: string } }) {
  return (
    <div className="bg-[#F0F8F1] border border-[#22A06B] rounded-[10px] p-5 flex gap-3 items-start">
      <div className="text-[22px] leading-none">✅</div>
      <div className="space-y-1">
        <div className="text-[15px] font-semibold text-[#22A06B]">
          다음 단계로 진행 권장 (자음정확도 {step.achieved}% ≥ 기준 {step.threshold}%)
        </div>
        <div className="text-[14px] text-ink-700">{step.message}</div>
      </div>
    </div>
  )
}

function MetaLabel({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-[15px]">
      <span className="font-bold text-ink-900">{label}</span>
      <span className="text-ink-700 ml-2">{value}</span>
    </span>
  )
}

function InfoGrid({ cells }: { cells: Array<[string, React.ReactNode]> }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 border-t border-line bg-surface-card overflow-hidden rounded-md">
      {cells.map(([label, value], i) => (
        <div
          key={i}
          className={`grid grid-cols-[200px_1fr] border-b border-line ${
            i % 2 === 0 ? 'md:border-r md:border-line' : ''
          }`}
        >
          <div className="bg-surface-chip text-[15px] font-medium text-ink-900 px-5 py-3 flex items-center min-h-[52px]">
            {label}
          </div>
          <div className="text-[15px] text-ink-700 px-5 py-3 flex items-center min-h-[52px]">
            {value}
          </div>
        </div>
      ))}
    </div>
  )
}

function SkeletonInfoGrid({ rows }: { rows: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 border-t border-line bg-surface-card overflow-hidden rounded-md">
      {Array.from({ length: rows * 2 }).map((_, i) => (
        <div
          key={i}
          className={`grid grid-cols-[200px_1fr] border-b border-line ${
            i % 2 === 0 ? 'md:border-r md:border-line' : ''
          }`}
        >
          <div className="bg-surface-chip px-5 py-3 min-h-[52px] flex items-center">
            <div className="h-4 w-24 rounded bg-line-soft animate-pulse" />
          </div>
          <div className="px-5 py-3 min-h-[52px] flex items-center">
            <div className="h-4 w-32 rounded bg-line-soft animate-pulse" />
          </div>
        </div>
      ))}
    </div>
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
  return <span className={`inline-block px-3 py-1 rounded-[10px] text-[13px] ${cls}`}>{label}</span>
}

function RangeTabs({
  value,
  onChange
}: {
  value: '주간' | '월간' | '3개월'
  onChange: (v: '주간' | '월간' | '3개월') => void
}) {
  const options: Array<'주간' | '월간' | '3개월'> = ['주간', '월간', '3개월']
  return (
    <div className="inline-flex bg-line-soft p-1 rounded-[8px]">
      {options.map(o => {
        const active = o === value
        return (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`h-[34px] px-6 rounded-[5px] text-[15px] font-medium transition-colors ${
              active
                ? 'bg-white border border-brand text-ink-900'
                : 'text-ink-700 hover:text-ink-900'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}

function SeriesToggle({
  label,
  color,
  checked,
  onChange
}: {
  label: string
  color: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        onClick={onChange}
        className={`w-5 h-5 rounded-[3px] grid place-items-center transition-colors ${
          checked ? 'bg-brand' : 'bg-white border border-[#B2B2B2]'
        }`}
        role="checkbox"
        aria-checked={checked}
      >
        {checked && (
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="white" strokeWidth="2">
            <path d="M1 5l3.5 3.5L11 1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[14px] text-ink-900">{label}</span>
    </label>
  )
}

type WeeklyPoint = { day: string; accuracy: number; tries: number; minutes: number }

/* ----- 월별 캘린더 dot-chart ----- */
type CalEntry = { acc: number[]; tries: number; minutes: number }

function MonthCalendar({
  year, month, data, visible
}: {
  year: number
  month: number
  data: Map<number, CalEntry>
  visible: Record<SeriesKey, boolean>
}) {
  const DAYS = ['월', '화', '수', '목', '금', '토', '일']
  const daysInMonth = new Date(year, month, 0).getDate()
  const rawDow = new Date(year, month - 1, 1).getDay() // 0=Sun
  const offset = rawDow === 0 ? 6 : rawDow - 1        // Mon-start offset

  const SERIES = [
    { key: 'accuracy' as SeriesKey, color: '#FF4646', fmt: (e: CalEntry) => e.acc.length ? `${Math.round(e.acc.reduce((a, v) => a + v) / e.acc.length)}%` : null },
    { key: 'tries'    as SeriesKey, color: '#FF9873', fmt: (e: CalEntry) => e.tries   > 0 ? `${e.tries}회`   : null },
    { key: 'minutes'  as SeriesKey, color: '#5EBC93', fmt: (e: CalEntry) => e.minutes > 0 ? `${e.minutes}분` : null },
  ]

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ]

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-[#E8E8E8] mb-0">
        {DAYS.map(d => (
          <div key={d} className="text-[15px] font-semibold text-center text-ink-900 py-3">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-l border-t border-[#E8E8E8]">
        {cells.map((day, idx) => {
          const entry = day !== null ? data.get(day) ?? null : null
          return (
            <div key={idx} className="border-r border-b border-[#E8E8E8] min-h-[76px] p-2">
              {day !== null && (
                <>
                  <div className="text-[10px] text-[#C0C0C0] leading-none mb-1.5">{day}</div>
                  {SERIES.map(({ key, color, fmt }) => {
                    if (!visible[key]) return null
                    const label = entry ? fmt(entry) : null
                    // 정확도는 70% 기준: 이상=빨강, 미만=회색
                    let activeColor = color
                    if (key === 'accuracy' && entry && entry.acc.length > 0) {
                      const avg = entry.acc.reduce((a, v) => a + v) / entry.acc.length
                      if (avg < 70) activeColor = '#B2B2B2'
                    }
                    return (
                      <div key={key} className="flex items-center gap-1.5 mb-[3px]">
                        <span className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                          style={{ backgroundColor: label ? activeColor : '#D0D0D0' }} />
                        {label
                          ? <span className="text-[11px] font-semibold leading-none" style={{ color: activeColor }}>{label}</span>
                          : <span className="text-[11px] text-[#C8C8C8] leading-none">-</span>
                        }
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeeklyBarChart({
  data,
  visible,
  showSeriesLabels = false
}: {
  data: WeeklyPoint[]
  visible: Record<SeriesKey, boolean>
  showSeriesLabels?: boolean
}) {
  const allValues = data.flatMap(d => [d.accuracy, d.tries, d.minutes])
  const max = Math.max(...allValues, 100)
  const colMinW = data.length <= 7 ? undefined : Math.max(48, Math.floor(660 / data.length))

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 right-0 flex items-center pointer-events-none">
        <div className="flex-1 border-t border-dashed border-line-dash" />
        <span className="text-[12px] text-[#B2B2B2] ml-2">목표</span>
      </div>

      <div className="overflow-x-auto">
        <div
          className="h-[280px] pt-6"
          style={
            colMinW
              ? { display: 'grid', gridTemplateColumns: `repeat(${data.length}, ${colMinW}px)`, gap: '0.5rem' }
              : { display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, data.length)}, 1fr)`, gap: '1rem' }
          }
        >
          {data.map((d, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div className="flex-1 flex items-end justify-center gap-1 w-full">
                {(['accuracy', 'tries', 'minutes'] as SeriesKey[]).map(key => {
                  if (!visible[key]) return null
                  const value = d[key]
                  const heightPct = max > 0 ? (value / max) * 100 : 0
                  const color =
                    key === 'accuracy' ? '#FF6767' : key === 'tries' ? '#FF9873' : '#5EBC93'
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center justify-end h-full"
                      style={{ width: 24 }}
                    >
                      <div className="text-[12px] text-ink-700 mb-1 leading-none">{value || ''}</div>
                      <div
                        className="w-full rounded-sm"
                        style={{
                          backgroundColor: value > 0 ? color : '#EAEAEA',
                          height: `${Math.max(2, heightPct)}%`,
                          minHeight: 4
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              {showSeriesLabels && (
                <div className="flex justify-center gap-1 mt-1">
                  {(['accuracy', 'tries', 'minutes'] as SeriesKey[]).map(key =>
                    visible[key] ? (
                      <div key={key} className="text-[11px] text-ink-400 leading-none" style={{ width: 24, textAlign: 'center' }}>
                        {key === 'accuracy' ? 'P' : key === 'tries' ? 'F' : 'T'}
                      </div>
                    ) : null
                  )}
                </div>
              )}
              <div className="text-[13px] font-semibold text-ink-900 mt-1">{d.day}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RecordingGroup({
  label,
  tiles
}: {
  label: string
  tiles: RecordingTile[]
}) {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.addEventListener('ended', () => setPlayingIdx(null))
  }

  const toggle = (i: number, url?: string) => {
    const audio = audioRef.current
    if (!audio) return
    if (playingIdx === i) {
      audio.pause()
      setPlayingIdx(null)
      return
    }
    audio.pause()
    if (url) audio.src = url
    audio.play().catch(() => setPlayingIdx(null))
    setPlayingIdx(i)
  }

  return (
    <div>
      <div className="text-[15px] text-ink-900 mb-3">{label}</div>
      <div className="flex flex-wrap gap-2">
        {tiles.map((t, i) => {
          const playing = playingIdx === i
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i, t.url)}
              className="flex flex-1 items-center justify-between h-[42px] px-3 min-w-[140px] bg-white border border-[#C3C3C3] rounded-[5px] hover:border-brand transition-colors"
            >
              <span className="text-[14px] text-ink-900 truncate">{t.word}</span>
              <span
                className={`w-6 h-6 rounded-[2px] grid place-items-center shrink-0 ${
                  playing ? 'bg-brand-danger' : 'bg-brand'
                }`}
              >
                {playing ? (
                  <svg width="8" height="10" viewBox="0 0 10 12" fill="white">
                    <rect x="1" y="1" width="3" height="10" rx="0.5" />
                    <rect x="6" y="1" width="3" height="10" rx="0.5" />
                  </svg>
                ) : (
                  <svg width="8" height="10" viewBox="0 0 12 12" fill="white">
                    <polygon points="3,1.5 10,6 3,10.5" />
                  </svg>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function OutlineButton({
  children,
  onClick,
  disabled
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-[34px] px-3 rounded-[5px] border border-brand text-brand text-[12px] font-medium hover:bg-brand hover:text-white transition-colors disabled:border-ink-300 disabled:text-ink-300 disabled:hover:bg-transparent disabled:hover:text-ink-300 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  )
}
