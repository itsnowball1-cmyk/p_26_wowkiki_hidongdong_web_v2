import { useEffect, useMemo, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { api, type AdminDeletedMember } from '../lib/api'

const PAGE_SIZE = 10

function daysUntilExpiry(deletedAt: string | null | undefined): number {
  if (!deletedAt) return 30
  const deleted = new Date(deletedAt.replace(/\./g, '-'))
  if (isNaN(deleted.getTime())) return 30
  const expiry = new Date(deleted)
  expiry.setDate(expiry.getDate() + 30)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000)
}

function ExpiryLabel({ days }: { days: number }) {
  if (days <= 1) return <span className="text-[#FF2A2A] font-medium">오늘 삭제</span>
  if (days <= 3) return <span className="text-[#FFA270] font-medium">{days}일 남음</span>
  return <span className="text-[#585858] font-medium">{days}일 남음</span>
}

function RestoreConfirmModal({ names, mtype, onConfirm, onClose, restoring }: {
  names: string[]
  mtype: 'doctor' | 'therapist'
  onConfirm: () => void
  onClose: () => void
  restoring: boolean
}) {
  const role = mtype === 'doctor' ? '의사' : '치료사'
  const title = `삭제 ${role} 복구`
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="relative bg-white rounded-[10px] w-[480px] pt-[40px] pb-[30px] px-[65px]"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-[#AAAAAA] hover:text-[#333]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M1 1l16 16M17 1 1 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <h2 className="text-[18px] font-bold text-[#1A1A1A] text-center mb-5">{title}</h2>

        <p className="text-[15px] text-[#2F2E2E] text-center leading-[1.7]">
          <span className="font-bold">{names.join(', ')}</span>{' '}
          {role}의 정보를 복구하시겠습니까?<br />
          복구 시 기존 담당 아동 정보는 복원되지 않으며,<br />
          재배정 해야합니다.
        </p>

        <div className="flex gap-3 mt-7 justify-center">
          <button
            type="button"
            onClick={onConfirm}
            disabled={restoring}
            className="w-[120px] h-[42px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 disabled:opacity-60 transition-colors"
          >
            {restoring ? '복구 중…' : '복구'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={restoring}
            className="w-[120px] h-[42px] border border-[#005744] text-[#005744] text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/5 transition-colors"
          >
            취소
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminMemberDeletedList() {
  const [all, setAll] = useState<AdminDeletedMember[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'doctor' | 'therapist'>('doctor')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [restoring, setRestoring] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)

  const load = () => {
    setLoading(true)
    api.adminDeletedMembers()
      .then(data => {
        setAll(data.filter(m => daysUntilExpiry(m.deleted_at) > 0))
        setPage(1)
        setSelected(new Set())
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    let result = all.filter(m => m.mtype === tab)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(m =>
        [m.name, m.code, m.depart_code, m.instt_code].some(v => v?.toLowerCase().includes(q))
      )
    }
    return result
  }, [all, tab, query])

  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page])

  const allPageSelected = paged.length > 0 && paged.every(m => selected.has(m.id))
  const toggleAll = () => {
    if (allPageSelected) setSelected(new Set())
    else setSelected(new Set(paged.map(m => m.id)))
  }
  const toggleRow = (id: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const handleRestoreConfirm = async () => {
    if (!selected.size || restoring) return
    setRestoring(true)
    try {
      await api.adminRestoreMembers([...selected])
      setShowRestoreModal(false)
      load()
    } finally {
      setRestoring(false)
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
            <div className="flex items-center gap-4 flex-wrap">
              <h1 className="text-[18px] font-semibold">
                <span className="text-[#919191]">{tab === 'doctor' ? '의사' : '치료사'} 삭제 목록</span>{' '}
                <span className="text-[#005744]">{filtered.length}</span>
              </h1>
              <span className="text-[14px] text-[#B1B1B1]">
                삭제된 정보는 삭제 목록에서 30일간 보관되며, 이후 완전히 삭제됩니다.
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setPage(1) }}
                  placeholder="검색"
                  className="w-[220px] h-[40px] pl-3 pr-9 border border-[#ADB5BD] rounded-[5px] text-[15px] focus:outline-none focus:border-[#005744] bg-white"
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 text-[#919191] pointer-events-none" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" />
                </svg>
              </div>
              <button
                type="button"
                onClick={() => setShowRestoreModal(true)}
                disabled={selected.size === 0 || restoring}
                className="w-[100px] h-[40px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 disabled:bg-[#B5B5B5] disabled:cursor-not-allowed transition-colors"
              >
                {`복구${selected.size > 0 ? ` (${selected.size})` : ''}`}
              </button>
            </div>
          </div>

          {/* 의사/치료사 탭 */}
          <div className="flex items-center gap-2 mb-4">
            {(['doctor', 'therapist'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setTab(t); setPage(1); setSelected(new Set()) }}
                className={`h-[32px] px-4 rounded-full text-[14px] font-medium transition-colors ${
                  tab === t ? 'bg-[#005744] text-white' : 'bg-[#EAEAEA] text-[#555] hover:bg-[#DEDEDE]'
                }`}
              >
                {t === 'doctor' ? '의사' : '치료사'}
              </button>
            ))}
          </div>

          {/* 테이블 */}
          <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
            <table className="w-full table-fixed text-[15px]">
              <colgroup>
                <col className="w-[54px]" />
                <col /><col /><col /><col /><col /><col /><col />
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
                  <th className="h-[52px] text-center font-medium text-[#272727]">삭제 예정</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DEDEDE]">
                {loading && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8}><div className="h-4 m-4 rounded animate-pulse bg-[#EAEAEA]" /></td>
                  </tr>
                ))}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-[#919191]">
                      삭제된 {tab === 'doctor' ? '의사' : '치료사'}가 없습니다.
                    </td>
                  </tr>
                )}
                {!loading && paged.map((m, i) => {
                  const days = daysUntilExpiry(m.deleted_at)
                  return (
                    <tr key={m.id} className="h-[52px] hover:bg-[#FAFAFA] transition-colors">
                      <td className="text-center">
                        <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleRow(m.id)} className="w-[18px] h-[18px] accent-[#005744]" />
                      </td>
                      <td className="text-center text-[#585858] font-medium">{(page - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="text-center">
                        <span className={`inline-flex items-center justify-center w-[40px] h-[20px] rounded-[5px] text-[13px] font-medium text-white ${
                          m.status === '재직' ? 'bg-[#57987E]' : 'bg-[#A7A7A7]'
                        }`}>{m.status}</span>
                      </td>
                      <td className="px-2 text-center text-[#585858] font-medium">{m.name}</td>
                      <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{m.code}</td>
                      <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{m.instt_code ?? '-'}</td>
                      <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{m.depart_code ?? '-'}</td>
                      <td className="text-center"><ExpiryLabel days={days} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 mt-6">
              <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-[27px] flex items-center justify-center text-[#777777] disabled:opacity-30">
                <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 1 1 6l5 5" /></svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} type="button" onClick={() => setPage(p)}
                  className={`w-[29px] h-[27px] flex items-center justify-center rounded-[5px] text-[15px] font-medium transition-colors ${
                    p === page ? 'bg-[#D9D9D9] text-[#5D5D5D]' : 'text-[#5D5D5D] hover:bg-[#EAEAEA]'
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

      {showRestoreModal && (
        <RestoreConfirmModal
          names={all.filter(m => selected.has(m.id)).map(m => m.name)}
          mtype={tab}
          onConfirm={handleRestoreConfirm}
          onClose={() => { if (!restoring) setShowRestoreModal(false) }}
          restoring={restoring}
        />
      )}
    </div>
  )
}
