import { useEffect, useMemo, useRef, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import AdminChildTabs from '../components/AdminChildTabs'
import TopBar from '../components/TopBar'
import { api, type AdminChildHistory } from '../lib/api'
import { useRouter } from '../lib/router'

const PAGE_SIZE = 10

type StatusFilter = 'active' | 'dormant' | 'all'

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'active',  label: '활성화 유저' },
  { value: 'dormant', label: '휴면 유저' },
  { value: 'all',     label: '전체 유저' },
]

export default function AdminChildHistory() {
  const { go } = useRouter()
  const [status, setStatus] = useState<StatusFilter>('active')
  const [children, setChildren] = useState<AdminChildHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const tableRef = useRef<HTMLDivElement>(null)

  const load = (s: StatusFilter, q: string) => {
    setLoading(true)
    api.adminChildHistory(s, q)
      .then(data => { setChildren(data); setPage(1); setSelected(new Set()) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load('active', '') }, [])

  const handleStatusChange = (s: StatusFilter) => {
    setStatus(s)
    setQuery('')
    load(s, '')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(status, query)
  }

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return children.slice(start, start + PAGE_SIZE)
  }, [children, page])

  const toggleRow = (id: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const allPageSelected = paged.length > 0 && paged.every(c => selected.has(c.id))
  const toggleAll = () => {
    if (allPageSelected) setSelected(new Set())
    else setSelected(new Set(paged.map(c => c.id)))
  }

  const downloadExcel = () => {
    import('xlsx').then(XLSX => {
      const rows = children.map((c, i) => ({
        순번: i + 1,
        이름: c.name,
        나이: c.age_label ?? '',
        식별코드: c.identifier,
        생년월일: c.birth_date ?? '',
        성별: c.gender,
        담당의사: c.doctor_name ?? '',
        '다음 진료 예약': c.next_doctor_appointment ?? '',
        담당치료사: c.therapist_name ?? '',
        '다음 치료 예약': c.next_therapy_appointment ?? '',
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, '아동이력')
      XLSX.writeFile(wb, '아동이력.xlsx')
    })
  }

  const downloadPdf = () => {
    import('html2canvas').then(({ default: html2canvas }) =>
      import('jspdf').then(({ jsPDF }) => {
        const el = tableRef.current
        if (!el) return
        html2canvas(el, { scale: 1.5, useCORS: true }).then(canvas => {
          const imgData = canvas.toDataURL('image/png')
          const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] })
          pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
          pdf.save('아동이력.pdf')
        })
      })
    )
  }

  const totalPages = Math.max(1, Math.ceil(children.length / PAGE_SIZE))

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8">

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
            <h1 className="text-[18px] font-semibold">
              <span className="text-[#919191]">아동 목록</span>{' '}
              <span className="text-[#005744]">{children.length}</span>
            </h1>

            <div className="flex items-center gap-5 flex-wrap">
              {/* 상태 필터 탭 */}
              <div className="flex items-center gap-5">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleStatusChange(opt.value)}
                    className={`text-[15px] tracking-[-0.03em] transition-colors ${
                      status === opt.value
                        ? 'text-[#005744] font-medium'
                        : 'text-[#2F2E2E]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* 데이터 다운로드 */}
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-black">[데이터 다운로드]</span>
                <button
                  type="button"
                  onClick={downloadExcel}
                  className="h-[34px] w-[94px] border border-[#005744] rounded-[5px] bg-white text-[12px] font-medium text-[#005744] tracking-[-0.04em] hover:bg-[#005744]/5 transition-colors"
                >
                  엑셀 다운
                </button>
                <button
                  type="button"
                  onClick={downloadPdf}
                  className="h-[34px] w-[94px] border border-[#005744] rounded-[5px] bg-white text-[12px] font-medium text-[#005744] tracking-[-0.04em] hover:bg-[#005744]/5 transition-colors"
                >
                  PDF 다운
                </button>
              </div>

              {/* 검색 */}
              <form onSubmit={handleSearch}>
                <div className="relative">
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="검색"
                    className="w-[220px] h-[34px] pl-3 pr-9 border border-[#ADB5BD] rounded-[5px] text-[15px] focus:outline-none focus:border-[#005744] bg-white"
                  />
                  <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#919191]">
                    <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>

          <AdminChildTabs />

          {/* 테이블 */}
          <div ref={tableRef} className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
            <table className="w-full table-fixed text-[15px]">
              <colgroup>
                <col className="w-[54px]" />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr className="bg-[#EAEAEA] border-b border-[#575757]">
                  <th className="h-[52px] text-center">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleAll}
                      className="w-[18px] h-[18px] accent-[#005744]"
                    />
                  </th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">순번</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">이름(나이)</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">식별코드</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">생년월일</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">성별</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">담당의사</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">다음 진료 예약</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">담당치료사</th>
                  <th className="h-[52px] text-center font-medium text-[#343A40]">다음 치료 예약</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEDEDE]">
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={10} className="py-4 px-4">
                      <div className="h-4 rounded animate-pulse bg-[#EAEAEA] w-full" />
                    </td>
                  </tr>
                ))}
                {!loading && children.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-[#919191]">데이터가 없습니다.</td>
                  </tr>
                )}
                {!loading && paged.map((child, i) => (
                  <tr key={child.id} className="h-[52px] hover:bg-[#FAFAFA] transition-colors cursor-pointer" onClick={() => go({ name: 'admin-child-history-detail', id: child.id })}>
                    <td className="text-center" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(child.id)}
                        onChange={() => toggleRow(child.id)}
                        className="w-[18px] h-[18px] accent-[#005744]"
                      />
                    </td>
                    <td className="text-center text-[#585858] font-medium">
                      {(page - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-2 text-center text-[#585858] font-medium">
                      {child.name}{child.age_label ? `(${child.age_label})` : ''}
                    </td>
                    <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{child.identifier}</td>
                    <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{child.birth_date ?? '-'}</td>
                    <td className="text-center text-[#585858] font-medium">{child.gender}</td>
                    <td className="px-2 text-center text-[#585858] font-medium">{child.doctor_name ?? '-'}</td>
                    <td className="px-2 text-center text-[#585858] font-medium">{child.next_doctor_appointment ?? '-'}</td>
                    <td className="px-2 text-center text-[#585858] font-medium">{child.therapist_name ?? '-'}</td>
                    <td className="px-2 text-center text-[#585858] font-medium">{child.next_therapy_appointment ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-6">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-[27px] flex items-center justify-center text-[#777777] disabled:opacity-30"
              >
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 1 1 6l5 5" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-[29px] h-[27px] flex items-center justify-center rounded-[5px] text-[15px] font-medium transition-colors ${
                    p === page ? 'bg-[#EAEAEA] text-[#5D5D5D]' : 'text-[#5D5D5D] hover:bg-[#EAEAEA]/60'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-[27px] flex items-center justify-center text-[#777777] disabled:opacity-30"
              >
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m1 1 5 5-5 5" /></svg>
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
