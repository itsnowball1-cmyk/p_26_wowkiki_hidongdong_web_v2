import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'
import type { DiagnosisDetailDto } from '../lib/api'
import { exportDiagnosisToExcel, exportElementToPdf, type DiagnosisExportData } from '../lib/exporters'

type Props = { childId: number; diagnosisId: number }

type Recording = { index: number; word: string; url: string }


export default function DiagnosisDetail({ childId, diagnosisId }: Props) {
  const { go } = useRouter()
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [diagData, setDiagData] = useState<DiagnosisDetailDto | null>(null)
  const [exporting, setExporting] = useState<null | 'excel' | 'pdf'>(null)
  const pdfRef = useRef<HTMLDivElement>(null)

  const buildExportData = (): DiagnosisExportData => ({
    identifier: diagData?.identifier ?? '-',
    examinedAt: diagData?.examined_at ?? '-',
    duration: diagData?.duration_label ?? '-',
    stimulus: [],
    consonantMetrics: (diagData?.statistics ?? []) as DiagnosisExportData['consonantMetrics'],
    revisedMetrics: (diagData?.revised_statistics ?? []) as DiagnosisExportData['revisedMetrics'],
    errorRank: (diagData?.error_rank ?? []).map(r => [r.rank, r.type, r.ratio] as const),
    pronunciationPairs: (diagData?.mispronunciations ?? []).map(m => [m.word, m.ch_pron] as const),
    errorPosition: (diagData?.error_position ?? []).map(p => [p.count > 1 ? `${p.phoneme} (${p.count})` : p.phoneme, p.types, p.positions] as const)
  })

  const handleExcel = async () => {
    if (exporting) return
    setExporting('excel')
    try {
      await exportDiagnosisToExcel(buildExportData())
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
      const filename = diagData
        ? `검사결과_${diagData.identifier}_${diagData.examined_at.replace(/\./g, '')}.pdf`
        : '검사결과.pdf'
      await exportElementToPdf(pdfRef.current, filename)
    } catch (e) {
      console.error(e)
      alert('PDF 다운로드에 실패했습니다.')
    } finally {
      setExporting(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    api.diagnosis(diagnosisId)
      .then(data => { if (!cancelled) setDiagData(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [diagnosisId])

  useEffect(() => {
    let cancelled = false
    api.diagnosisRecordings(diagnosisId)
      .then((items) => {
        if (cancelled) return
        const mapped = items
          .filter((it) => it.url)
          .map((it, i) => ({ index: i + 1, word: it.word ?? String(it.index), url: it.url }))
        setRecordings(mapped)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [diagnosisId])

  const stimulusRows = diagData?.stimulability ?? []
  const statistics = diagData?.statistics ?? []
  const revisedStatistics = diagData?.revised_statistics ?? []
  const mispronunciations = diagData?.mispronunciations ?? []
  const errorPosition = diagData?.error_position ?? []
  const errorRank = diagData?.error_rank ?? []

  const { user } = useAuth()

  return (
    <div className="min-h-screen flex bg-surface">
      {user?.role === 'admin' ? <AdminSidebar /> : <Sidebar />}

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-10 py-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <h1 className="text-[22px] font-bold text-ink-800">검사 결과</h1>
            <div className="flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => go({ name: 'detail', id: childId })}
                className="text-[12px] text-ink-900 hover:text-brand transition-colors"
              >
                목록으로 돌아가기 &gt;
              </button>
              <div className="flex items-center gap-2">
                <OutlineButton onClick={handleExcel} disabled={!!exporting}>
                  {exporting === 'excel' ? '내보내는 중…' : '엑셀 다운'}
                </OutlineButton>
                <OutlineButton onClick={handlePdf} disabled={!!exporting}>
                  {exporting === 'pdf' ? '내보내는 중…' : 'PDF 다운'}
                </OutlineButton>
              </div>
            </div>
          </div>

          <div ref={pdfRef} className="space-y-6">
          {/* Meta Card */}
          <div className="bg-surface-card border border-line-card rounded-[5px] px-8 py-6 grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-10">
            <div>
              <div className="text-[18px] font-semibold text-ink-850">아동 식별 코드</div>
              <div className="text-[15px] text-ink-700 mt-1">{diagData?.identifier ?? '-'}</div>
            </div>
            <div>
              <div className="text-[18px] font-semibold text-ink-850">검사일</div>
              <div className="text-[15px] text-ink-700 mt-1">{diagData?.examined_at ?? '-'}</div>
            </div>
            <div>
              <div className="text-[18px] font-semibold text-ink-850">소요시간</div>
              <div className="text-[15px] text-ink-700 mt-1">{diagData?.duration_label ?? '-'}</div>
            </div>
          </div>

          {/* Big Result Card */}
          <div className="bg-surface-card border border-line-card rounded-[5px] p-8 space-y-10">
            {/* 자극반응도 */}
            {stimulusRows.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <SectionTitle>자극반응도</SectionTitle>
                  <button className="h-[35px] px-4 rounded-lg border border-brand text-brand text-[13px] font-medium hover:bg-brand hover:text-white transition-colors">
                    결과 요약
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] border-collapse">
                    <thead>
                      <tr className="bg-surface-chip">
                        <Th>목표 발음</Th>
                        <Th>1차 아동 발음</Th>
                        <Th>1차 오류 유형</Th>
                        <Th>1차 발음 정확도</Th>
                        <Th>2차 아동 발음</Th>
                        <Th>2차 평가 (자극반응도)</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* stimulability 구조가 확인되면 여기에 렌더링 */}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* 자음정확도 */}
            <section>
              <SectionTitle className="mb-4">평가 결과 - 자음정확도</SectionTitle>
              {statistics.length > 0
                ? <MetricsTable rows={statistics as DiagnosisExportData['consonantMetrics']} />
                : <EmptyState />}
            </section>

            {/* 개정 자음정확도 */}
            <section>
              <SectionTitle className="mb-4">평가 결과 - 개정 자음정확도</SectionTitle>
              {revisedStatistics.length > 0
                ? <MetricsTable rows={revisedStatistics as DiagnosisExportData['revisedMetrics']} />
                : <EmptyState />}
            </section>

            {/* 오류 유형 및 출현율 */}
            <section>
              <SectionTitle className="mb-4">오류 유형 및 출현율</SectionTitle>
              {errorRank.length > 0 ? (
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
                      {errorRank.map((row) => (
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
              <SectionTitle className="mb-4">표준 발음 vs 아동 발음</SectionTitle>
              {mispronunciations.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-surface-chip">
                        <Th>표준 발음</Th>
                        <Th>아동 발음</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {mispronunciations.map(({ word, ch_pron }, i) => (
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
              <SectionTitle className="mb-4">오류 음소 및 위치</SectionTitle>
              {errorPosition.length > 0 ? (
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
                      {errorPosition.map(({ phoneme, count, types, positions }) => (
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

            {/* 진단 녹음 듣기 — 녹음 데이터가 있을 때만 노출. PDF 에는 제외. */}
            {recordings.length > 0 && (
              <section data-pdf-exclude>
                <SectionTitle className="mb-5">진단 녹음 듣기</SectionTitle>
                <RecordingGrid recordings={recordings} />
              </section>
            )}
          </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/* ---------------------------------- */
/* Recording grid                     */
/* ---------------------------------- */
function RecordingGrid({ recordings }: { recordings: Recording[] }) {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const audio = new Audio()
    const onEnded = () => setPlayingIdx(null)
    audio.addEventListener('ended', onEnded)
    audioRef.current = audio
    return () => {
      audio.removeEventListener('ended', onEnded)
      audio.pause()
      audioRef.current = null
    }
  }, [])

  const toggle = (rec: Recording) => {
    const audio = audioRef.current
    if (!audio) return
    if (playingIdx === rec.index) {
      audio.pause()
      setPlayingIdx(null)
      return
    }
    audio.pause()
    audio.src = rec.url
    audio.play().catch(() => setPlayingIdx(null))
    setPlayingIdx(rec.index)
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-3 gap-y-3">
      {recordings.map((rec) => (
        <RecordingItem
          key={rec.index}
          index={rec.index}
          word={rec.word}
          playing={playingIdx === rec.index}
          onClick={() => toggle(rec)}
        />
      ))}
    </div>
  )
}

function RecordingItem({
  index,
  word,
  playing,
  onClick
}: {
  index: number
  word: string
  playing: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 h-[50px] px-3 bg-surface-card border border-line-card rounded-[5px] hover:border-brand hover:shadow-sm transition-all text-left"
    >
      <span
        className={`w-7 h-7 rounded-[4px] grid place-items-center shrink-0 transition-colors ${
          playing ? 'bg-brand-danger' : 'bg-brand'
        }`}
      >
        {playing ? (
          <svg width="10" height="12" viewBox="0 0 10 12" fill="white">
            <rect x="1" y="1" width="3" height="10" rx="0.5" />
            <rect x="6" y="1" width="3" height="10" rx="0.5" />
          </svg>
        ) : (
          <svg width="10" height="12" viewBox="0 0 12 12" fill="white">
            <polygon points="3,1.5 10,6 3,10.5" />
          </svg>
        )}
      </span>
      <span className="text-[15px] text-ink-900">
        <span className="text-ink-400 mr-1">{String(index).padStart(2, '0')}</span>
        {word}
      </span>
    </button>
  )
}

/* ---------------------------------- */
/* Shared primitives                  */
/* ---------------------------------- */
function EmptyState() {
  return <p className="text-ink-400 text-[13px] py-2">데이터 없음</p>
}

function SectionTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`text-[20px] font-bold text-ink-800 ${className}`}>{children}</h2>
}

function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`h-[50px] px-3 text-center font-bold text-[15px] text-ink-800 border border-line-cell ${className}`}>
      {children}
    </th>
  )
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`h-[48px] px-3 text-center text-[15px] text-ink-800 border border-line-cell ${className}`}>
      {children}
    </td>
  )
}

function MetricsTable({
  rows
}: {
  rows: readonly (readonly [string, string, string, string])[]
}) {
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
          {rows.map((row) => (
            <tr key={row[0]}>
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
