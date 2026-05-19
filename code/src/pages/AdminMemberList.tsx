import { useEffect, useMemo, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { api, type AdminMember } from '../lib/api'
import { useRouter } from '../lib/router'

const PAGE_SIZE = 10
type MemberType = 'doctor' | 'therapist'

export default function AdminMemberList() {
  const { go } = useRouter()
  const [mtype, setMtype] = useState<MemberType>('doctor')
  const [members, setMembers] = useState<AdminMember[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const load = (type: MemberType, q: string) => {
    setLoading(true)
    api.adminMembers(type, q)
      .then(data => { setMembers(data); setPage(1); setSelected(new Set()) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load('doctor', '') }, [])

  const handleTypeChange = (t: MemberType) => {
    setMtype(t)
    setQuery('')
    load(t, '')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(mtype, query)
  }

  const filtered = useMemo(() => members, [members])

  const paged = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const toggleRow = (id: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const allPageSelected = paged.length > 0 && paged.every(c => selected.has(c.id))
  const toggleAll = () => {
    if (allPageSelected) setSelected(new Set())
    else setSelected(new Set(paged.map(c => c.id)))
  }

  const handleDelete = async () => {
    if (selected.size === 0) return
    if (!window.confirm(`선택한 ${selected.size}명의 회원을 삭제하시겠습니까?`)) return
    setDeleting(true)
    try {
      await api.adminDeleteMembers([...selected])
      load(mtype, query)
    } catch {
      window.alert('삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8">

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
            <h1 className="text-[18px] font-semibold">
              <span className="text-[#919191]">{mtype === 'doctor' ? '의사' : '치료사'} 목록</span>{' '}
              <span className="text-[#005744]">{filtered.length}</span>
            </h1>

            <div className="flex items-center gap-4 flex-wrap">
              {/* 역할 필터 */}
              <div className="flex items-center gap-4">
                {(['doctor', 'therapist'] as const).map(t => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer select-none text-[15px] tracking-[-0.03em] text-[#2F2E2E]">
                    <input
                      type="radio"
                      name="mtype"
                      checked={mtype === t}
                      onChange={() => handleTypeChange(t)}
                      className="w-[17px] h-[17px] accent-[#005744]"
                    />
                    {t === 'doctor' ? '의사' : '치료사'}
                  </label>
                ))}
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

              {/* 삭제 버튼 */}
              <button
                type="button"
                onClick={handleDelete}
                disabled={selected.size === 0 || deleting}
                className="h-[34px] px-4 bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 disabled:bg-[#B5B5B5] disabled:cursor-not-allowed transition-colors"
              >
                삭제{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            </div>
          </div>

          {/* 테이블 */}
          <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
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
              </colgroup>
              <thead>
                <tr className="bg-[#EAEAEA] border-b border-[#575757]">
                  <th className="h-[52px] text-center">
                    <input type="checkbox" checked={allPageSelected} onChange={toggleAll} className="w-[18px] h-[18px] accent-[#005744]" />
                  </th>
                  <th className="h-[52px] text-center font-medium text-[#272727]">순번</th>
                  <th className="h-[52px] text-center font-medium text-[#272727]">활동</th>
                  <th className="h-[52px] text-center font-medium text-[#272727]">이름</th>
                  <th className="h-[52px] text-center font-medium text-[#272727]">식별코드</th>
                  <th className="h-[52px] text-center font-medium text-[#272727]">소속기관</th>
                  <th className="h-[52px] text-center font-medium text-[#272727]">소속과</th>
                  <th className="h-[52px] text-center font-medium text-[#272727]">진단 요일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEDEDE]">
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="py-4 px-4"><div className="h-4 rounded animate-pulse bg-[#EAEAEA] w-full" /></td></tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={8} className="py-16 text-center text-[#919191]">등록된 회원이 없습니다.</td></tr>
                )}
                {!loading && paged.map((m, i) => (
                  <tr
                    key={m.id}
                    className="h-[52px] hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                    onClick={() => go({ name: 'admin-member-detail', id: m.id })}
                  >
                    <td className="text-center" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleRow(m.id)} className="w-[18px] h-[18px] accent-[#005744]" />
                    </td>
                    <td className="text-center text-[#585858] font-medium">{(page - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`inline-flex items-center justify-center w-[40px] h-[20px] rounded-[5px] text-[13px] font-medium text-white ${
                          m.status === '재직' ? 'bg-[#57987E]' : 'bg-[#A7A7A7]'
                        }`}>{m.status}</span>
                        {m.is_new && (
                          <span className="inline-flex items-center justify-center w-[40px] h-[20px] rounded-[5px] text-[13px] font-medium text-white bg-[#8CC7FF]">NEW</span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 text-center text-[#585858] font-medium">{m.name}</td>
                    <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{m.code}</td>
                    <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{m.instt_code ?? '-'}</td>
                    <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{m.depart_code ?? '-'}</td>
                    <td className="px-2 text-center text-[#585858] font-medium">-</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-6">
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-[27px] flex items-center justify-center text-[#777777] disabled:opacity-30">
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 1 1 6l5 5" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} type="button" onClick={() => setPage(p)}
                  className={`w-[29px] h-[27px] flex items-center justify-center rounded-[5px] text-[15px] font-medium transition-colors ${
                    p === page ? 'bg-[#EAEAEA] text-[#5D5D5D]' : 'text-[#5D5D5D] hover:bg-[#EAEAEA]/60'
                  }`}>{p}</button>
              ))}
              <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-8 h-[27px] flex items-center justify-center text-[#777777] disabled:opacity-30">
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m1 1 5 5-5 5" /></svg>
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
