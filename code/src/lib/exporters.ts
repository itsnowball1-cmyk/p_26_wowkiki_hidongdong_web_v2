/**
 * 진단 결과 내보내기 — 엑셀(xlsx) + PDF
 * 동적 import 로 초기 번들 영향 최소화.
 */

export type DiagnosisExportData = {
  identifier: string
  examinedAt: string
  duration: string
  stimulus: Array<{
    target: string
    first: string
    firstError: string
    firstAccuracy: string
    second: string
    deltaText: string
  }>
  consonantMetrics: readonly (readonly [string, string, string, string])[]
  revisedMetrics: readonly (readonly [string, string, string, string])[]
  errorRank: readonly (readonly [number, string, string])[]
  pronunciationPairs: readonly (readonly [string, string])[]
  errorPosition: readonly (readonly [string, string, string])[]
}

function safeFilename(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, '_')
}

export async function exportDiagnosisToExcel(data: DiagnosisExportData): Promise<void> {
  const XLSX = await import('xlsx')

  const rows: (string | number)[][] = []
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []

  const pushSection = (
    title: string,
    columns: number,
    header: (string | number)[],
    body: (string | number)[][]
  ) => {
    if (rows.length > 0) rows.push([]) // blank separator row
    const titleRow = rows.length
    rows.push([title, ...Array(columns - 1).fill('')])
    merges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: columns - 1 } })
    rows.push(header)
    for (const r of body) rows.push(r)
  }

  pushSection(
    '검사 정보',
    2,
    ['항목', '값'],
    [
      ['아동 식별 코드', data.identifier],
      ['검사일', data.examinedAt],
      ['소요시간', data.duration]
    ]
  )

  pushSection(
    '자극반응도',
    6,
    ['목표 발음', '1차 아동 발음', '1차 오류 유형', '1차 발음 정확도', '2차 아동 발음', '2차 평가 (자극반응도)'],
    data.stimulus.map((s) => [s.target, s.first, s.firstError, s.firstAccuracy, s.second, s.deltaText])
  )

  pushSection(
    '평가 결과 - 자음정확도',
    4,
    ['지표', '원점수 (%)', '백분위', '수준'],
    data.consonantMetrics.map((r) => [r[0], r[1], r[2], r[3]])
  )

  pushSection(
    '평가 결과 - 개정 자음정확도',
    4,
    ['지표', '원점수 (%)', '백분위', '수준'],
    data.revisedMetrics.map((r) => [r[0], r[1], r[2], r[3]])
  )

  pushSection(
    '오류 유형 및 출현율',
    3,
    ['순위', '오류 유형', '출현율 (%)'],
    data.errorRank.map((r) => [r[0], r[1], r[2]])
  )

  pushSection(
    '표준 발음 vs 아동 발음',
    2,
    ['표준 발음', '아동 발음'],
    data.pronunciationPairs.map((r) => [r[0], r[1]])
  )

  pushSection(
    '오류 음소 및 위치',
    3,
    ['오류 음소', '오류 유형', '위치'],
    data.errorPosition.map((r) => [r[0], r[1], r[2]])
  )

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [
    { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 24 }
  ]
  sheet['!merges'] = merges

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '검사 결과')

  const filename = safeFilename(
    `검사결과_${data.identifier}_${data.examinedAt.replace(/\./g, '')}.xlsx`
  )
  XLSX.writeFile(wb, filename)
}

export type TreatmentExportData = {
  identifier: string
  treatedAt: string
  sessionLabel: string
  serviceStartedAt: string
  trainedSound: string
  accuracyPct: string
  tryCount: string
  durationLabel: string
  fieldTag: string
  weekly: Array<{
    day: string
    accuracy: number
    tries: number
    minutes: number
  }>
  summary: string[]
}

export async function exportTreatmentToExcel(data: TreatmentExportData): Promise<void> {
  const XLSX = await import('xlsx')

  const rows: (string | number)[][] = []
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []

  const pushSection = (
    title: string,
    columns: number,
    header: (string | number)[],
    body: (string | number)[][]
  ) => {
    if (rows.length > 0) rows.push([])
    const titleRow = rows.length
    rows.push([title, ...Array(columns - 1).fill('')])
    merges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: columns - 1 } })
    rows.push(header)
    for (const r of body) rows.push(r)
  }

  pushSection(
    '아동 기본 정보',
    2,
    ['항목', '값'],
    [
      ['아동 식별 코드', data.identifier],
      ['치료시작일', data.serviceStartedAt]
    ]
  )

  pushSection(
    '오늘의 치료 살펴보기',
    2,
    ['항목', '값'],
    [
      ['치료일', data.treatedAt],
      ['회기', data.sessionLabel],
      ['치료한 발음', data.trainedSound],
      ['발음 정확도', data.accuracyPct],
      ['발음 횟수', data.tryCount],
      ['치료시간', data.durationLabel],
      ['치료분야', data.fieldTag]
    ]
  )

  pushSection(
    '주간 치료 이력',
    4,
    ['요일', '정확도 (%)', '발음 횟수 (회)', '훈련시간 (분)'],
    data.weekly.map((w) => [w.day, w.accuracy, w.tries, w.minutes])
  )

  pushSection('요약', 1, ['요약 메시지'], data.summary.map((s) => [s]))

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet['!cols'] = [
    { wch: 22 }, { wch: 24 }, { wch: 24 }, { wch: 24 }
  ]
  sheet['!merges'] = merges

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '치료 결과')

  const filename = safeFilename(
    `치료결과_${data.identifier}_${data.treatedAt.replace(/\./g, '')}.xlsx`
  )
  XLSX.writeFile(wb, filename)
}

export async function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  ignoreSelector = '[data-pdf-exclude]'
): Promise<void> {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ])

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    ignoreElements: (el) => {
      if (!(el instanceof HTMLElement)) return false
      return !!el.closest(ignoreSelector)
    }
  })

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * pageWidth) / canvas.width

  // 페이지가 여러 장 필요한 경우 분할 렌더
  const pageHeightInCanvasPx = (canvas.width * pageHeight) / pageWidth
  let yOffset = 0
  let first = true

  while (yOffset < canvas.height) {
    const sliceHeight = Math.min(pageHeightInCanvasPx, canvas.height - yOffset)
    const sliceCanvas = document.createElement('canvas')
    sliceCanvas.width = canvas.width
    sliceCanvas.height = sliceHeight
    const ctx = sliceCanvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height)
    ctx.drawImage(canvas, 0, -yOffset)

    const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.92)
    const sliceImgHeight = (sliceHeight * pageWidth) / canvas.width

    if (!first) pdf.addPage()
    pdf.addImage(sliceData, 'JPEG', 0, 0, imgWidth, sliceImgHeight)

    yOffset += sliceHeight
    first = false
  }

  void imgHeight
  pdf.save(safeFilename(filename))
}
