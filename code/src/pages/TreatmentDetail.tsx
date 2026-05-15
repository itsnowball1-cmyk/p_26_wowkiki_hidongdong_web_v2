import { useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { api, type TreatmentDetailDto, type RecordingItem } from '../lib/api'
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

  const summary = useMemo(() => {
    const totalMins = weekly.reduce((s, d) => s + d.minutes, 0)
    const totalTries = weekly.reduce((s, d) => s + d.tries, 0)
    const activeDays = weekly.filter(d => d.accuracy > 0)
    const avgAcc = activeDays.length > 0
      ? Math.round(activeDays.reduce((s, d) => s + d.accuracy, 0) / activeDays.length)
      : 0
    return [
      { template: '이번주 총 ', value: String(totalMins), suffix: ' 분을 연습했어요.' },
      { template: '이번주 총 ', value: String(totalTries), suffix: ' 회 발음했어요.' },
      { template: '이번주 평균 발음 정확도는 ', value: `${avgAcc}%`, suffix: '에요.' }
    ]
  }, [weekly])

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

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-10 py-8 space-y-8 max-w-[1640px]">
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

            {/* 치료 이력 chart */}
            <section>
              <SectionTitle>치료 이력</SectionTitle>
              <div className="bg-surface-card border border-line rounded-[10px] p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <RangeTabs value={range} onChange={setRange} />
                  <div className="flex items-center gap-5">
                    {SERIES.map(s => (
                      <SeriesToggle
                        key={s.key}
                        label={s.label}
                        color={s.color}
                        checked={visible[s.key]}
                        onChange={() => toggleSeries(s.key)}
                      />
                    ))}
                  </div>
                </div>

                <WeeklyBarChart data={weekly} visible={visible} />

                <div className="mt-6 space-y-2">
                  {summary.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-[14px] text-ink-700">
                      <span className="inline-block w-3 h-3 rounded-sm bg-[#666666]" />
                      <span>
                        {s.template}
                        <span className="text-[#FD8D65] font-semibold">{s.value}</span>
                        {s.suffix}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
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
              className="h-[42px] px-5 rounded-[5px] border border-brand text-brand text-[14px] font-medium hover:bg-brand hover:text-white transition-colors"
              onClick={() => go({ name: 'treatment', childId, treatmentId: Math.max(1, treatmentId - 1) })}
            >
              &lt; 이전
            </button>
            <span className="text-[18px] font-medium text-ink-900">
              {detail?.treated_at ?? '-'}
            </span>
            <button
              type="button"
              disabled
              className="h-[42px] px-5 rounded-[5px] border border-[#CBCBCB] text-[#CCCCCC] text-[14px] font-medium cursor-not-allowed"
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

function WeeklyBarChart({
  data,
  visible
}: {
  data: WeeklyPoint[]
  visible: Record<SeriesKey, boolean>
}) {
  const allValues = data.flatMap(d => [d.accuracy, d.tries, d.minutes])
  const max = Math.max(...allValues, 100)

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 right-0 flex items-center pointer-events-none">
        <div className="flex-1 border-t border-dashed border-line-dash" />
        <span className="text-[12px] text-[#B2B2B2] ml-2">목표</span>
      </div>

      <div className="grid grid-cols-7 gap-4 h-[280px] pt-6">
        {data.map(d => (
          <div key={d.day} className="flex flex-col items-center">
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
            <div className="text-[13px] text-ink-900 mt-2">{d.day}</div>
          </div>
        ))}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
        {tiles.map((t, i) => {
          const playing = playingIdx === i
          return (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i, t.url)}
              className="flex items-center justify-between h-[42px] px-3 bg-white border border-[#C3C3C3] rounded-[5px] hover:border-brand transition-colors"
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
