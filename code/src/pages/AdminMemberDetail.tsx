import { useEffect, useRef, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { api, type AdminMemberDetailDto, type AdminStaffItem } from '../lib/api'
import { useRouter } from '../lib/router'

function DoctorSearchSubModal({
  onSelect,
  onClose,
}: {
  onSelect: (staff: AdminStaffItem) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminStaffItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    api.adminStaff('doctor', query).then(setResults).catch(() => {})
  }, [query])

  return (
    <div className="w-[520px] h-[560px] bg-white rounded-[5px] flex flex-col overflow-hidden">
      <div className="px-[42px] pt-[42px] pb-4 border-b border-[#DEDEDE]">
        <h3 className="text-[18px] font-semibold text-black mb-5">의사 검색</h3>
        <input
          ref={inputRef}
          type="text"
          placeholder="의사 이름 또는 코드 검색"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pb-1.5 border-b-2 border-[#7C7C7C] text-[15px] outline-none placeholder-[#AAAAAA] bg-transparent"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && !query.trim() && (
          <p className="py-10 text-center text-[14px] text-[#919191]">의사 이름을 입력하세요.</p>
        )}
        {results.length === 0 && query.trim() && (
          <p className="py-10 text-center text-[14px] text-[#919191]">검색 결과가 없습니다.</p>
        )}
        {results.map(s => (
          <div
            key={s.code}
            onClick={() => onSelect(s)}
            className="flex items-center justify-between px-[42px] py-3.5 hover:bg-[#F5F5F5] cursor-pointer border-b border-[#F0F0F0] last:border-0"
          >
            <span className="text-[15px] text-[#272727]">{s.name} <span className="text-[#919191]">({s.code})</span></span>
            {s.depart_code && <span className="text-[13px] text-[#919191]">{s.depart_code}</span>}
          </div>
        ))}
      </div>
      <div className="px-[42px] py-4 border-t border-[#DEDEDE] flex justify-end">
        <button
          type="button"
          onClick={onClose}
          className="px-5 h-[38px] text-[14px] text-[#555] border border-[#DEDEDE] rounded-[5px] hover:bg-[#F5F5F5] transition-colors"
        >
          닫기
        </button>
      </div>
    </div>
  )
}

function DoctorChangeModal({
  selectedChildren,
  onClose,
  onDone,
}: {
  selectedChildren: { id: number; name: string }[]
  onClose: () => void
  onDone: () => void
}) {
  const [doctor, setDoctor] = useState<AdminStaffItem | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!doctor) return
    setSaving(true)
    try {
      await Promise.all(selectedChildren.map(c => api.adminAssignChild(c.id, { doctor_code: doctor.code })))
      onDone()
    } catch {
      window.alert('담당의사 변경에 실패했습니다.')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      {showSearch ? (
        <DoctorSearchSubModal
          onSelect={d => { setDoctor(d); setShowSearch(false) }}
          onClose={() => setShowSearch(false)}
        />
      ) : (
        <div className="w-[520px] bg-white rounded-[5px]">

          {/* 제목 + X */}
          <div className="flex items-center justify-between px-[42px] pt-[42px]">
            <h2 className="text-[18px] font-semibold text-black">담당의사 변경</h2>
            <button type="button" onClick={onClose} disabled={saving} className="text-[#707070] hover:text-black disabled:opacity-40">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M1 1l13 13M14 1L1 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* 아동정보 */}
          <div className="px-[42px] mt-[30px]">
            <p className="text-[15px] font-semibold text-black mb-[14px]">아동정보</p>
            <div className="border border-[#DEDEDE] rounded-[4px] overflow-hidden">
              {selectedChildren.map((child, i) => (
                <div key={child.id} className={`flex h-[42px] ${i > 0 ? 'border-t border-[#DEDEDE]' : ''}`}>
                  <div className="w-[157px] shrink-0 bg-[#EAEAEA] flex items-center justify-center text-[15px] text-black">
                    아동 이름
                  </div>
                  <div className="flex-1 flex items-center justify-center text-[15px] text-[#242424]">
                    {child.name}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 변경할 담당의사 */}
          <div className="px-[42px] mt-[50px]">
            <div className="flex items-center justify-between mb-[26px]">
              <p className="text-[15px] font-semibold text-black">변경할 담당의사</p>
              <button
                type="button"
                onClick={() => setShowSearch(true)}
                className="w-[68px] h-[35px] border border-[#005744] text-[#005744] text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/5 transition-colors"
              >
                찾기
              </button>
            </div>
            <div className="border border-[#DEDEDE] rounded-[4px] overflow-hidden">
              {([
                { label: '소속과', value: doctor?.depart_code ?? '' },
                { label: '이름', value: doctor?.name ?? '' },
                { label: '식별코드', value: doctor?.code ?? '' },
              ] as const).map((row, i) => (
                <div key={row.label} className={`flex h-[42px] ${i > 0 ? 'border-t border-[#DEDEDE]' : ''}`}>
                  <div className="w-[157px] shrink-0 bg-[#EAEAEA] flex items-center justify-center text-[15px] text-black">
                    {row.label}
                  </div>
                  <div className="flex-1 flex items-center justify-center text-[15px] text-[#242424]">
                    {row.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 저장 / 취소 */}
          <div className="flex gap-[19px] justify-center mt-[44px] pb-[42px]">
            <button
              type="button"
              onClick={handleSave}
              disabled={!doctor || saving}
              className={`w-[125px] h-[40px] text-white text-[15px] font-medium rounded-[5px] transition-colors ${
                doctor && !saving ? 'bg-[#005744] hover:bg-[#005744]/90' : 'bg-[#C0C0C0] cursor-not-allowed'
              }`}
            >
              저장
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-[125px] h-[40px] border border-[#005744] text-[#005744] text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/5 disabled:opacity-40 transition-colors"
            >
              취소
            </button>
          </div>

        </div>
      )}
    </div>
  )
}

function DeleteConfirmModal({
  names,
  onConfirm,
  onClose,
  deleting,
}: {
  names: string[]
  onConfirm: () => void
  onClose: () => void
  deleting: boolean
}) {
  const nameStr = names.join(', ')
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center">
      <div className="w-[400px] bg-white rounded-[5px] relative px-[65px] pt-[40px] pb-[30px]">

        {/* X 닫기 */}
        <button
          type="button"
          onClick={onClose}
          disabled={deleting}
          className="absolute top-[21px] right-[24px] text-[#707070] hover:text-black disabled:opacity-40"
        >
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path d="M1 1l13 13M14 1L1 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>

        {/* 제목 */}
        <h3 className="text-[20px] font-bold text-[#2F2E2E] text-center">
          등록 아동 삭제
        </h3>

        {/* 본문 */}
        <div className="mt-3 text-[12px] text-center leading-[18px] text-[#2F2E2E]">
          <span className="font-bold">{nameStr}</span>
          <span className="font-normal"> 아동을 담당아동 목록에서 삭제하시겠습니까?</span>
          <br />
          <span className="font-normal">담당 의료진은 더이상 해당 아동의 정보를 확인할 수 없습니다.</span>
          <br />
          <span className="text-[10px] text-[#ADADAD] font-normal">(삭제 목록에서 1개월간 보관되며, 이후 모든 정보가 영구삭제됩니다.)</span>
        </div>

        {/* 버튼 */}
        <div className="flex gap-[19px] mt-5 justify-center">
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="w-[125px] h-[40px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 disabled:opacity-40 transition-colors"
          >
            삭제
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="w-[125px] h-[40px] border border-[#005744] text-black text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/5 disabled:opacity-40 transition-colors"
          >
            취소
          </button>
        </div>

      </div>
    </div>
  )
}

const PAGE_SIZE = 10

export default function AdminMemberDetail({ id }: { id: number }) {
  const { go } = useRouter()
  const [data, setData] = useState<AdminMemberDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDepart, setEditDepart] = useState('')
  const [editStatus, setEditStatus] = useState<'재직' | '휴직'>('재직')
  const [editDays, setEditDays] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    setLoadError(false)
    api.adminMemberDetail(id)
      .then(d => { setData(d); setSelected(new Set()) })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [id, reloadKey])

  const pagedChildren = data
    ? data.children.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : []
  const totalPages = data ? Math.max(1, Math.ceil(data.children.length / PAGE_SIZE)) : 1

  const allPageSelected = pagedChildren.length > 0 && pagedChildren.every(c => selected.has(c.id))
  const toggleAll = () => {
    if (allPageSelected) setSelected(new Set())
    else setSelected(new Set(pagedChildren.map(c => c.id)))
  }
  const toggleRow = (cid: number) =>
    setSelected(prev => { const s = new Set(prev); s.has(cid) ? s.delete(cid) : s.add(cid); return s })

  const handleDelete = () => {
    if (selected.size === 0) return
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    try {
      await api.adminDeleteChildren([...selected])
      setShowDeleteModal(false)
      setReloadKey(k => k + 1)
    } catch {
      window.alert('삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  const DAYS = ['월', '화', '수', '목', '금', '토', '일']

  const handleEdit = () => {
    if (!data) return
    setEditName(data.member.name)
    setEditDepart(data.member.depart_code ?? '')
    setEditStatus(data.member.status)
    setEditDays(data.member.diag_days ? data.member.diag_days.split(',').filter(Boolean) : [])
    setIsEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.adminUpdateMember(id, {
        name: editName,
        depart_code: editDepart || null,
        status: editStatus,
        diag_days: editDays.length > 0 ? editDays.join(',') : null,
      })
      setIsEditing(false)
      setReloadKey(k => k + 1)
    } catch {
      window.alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const toggleDay = (day: string) =>
    setEditDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])

  const isDoctor = data?.member.mtype === 'doctor'
  const roleLabel = isDoctor ? '의사' : '치료사'

  return (
    <>
    {showDeleteModal && data && (
      <DeleteConfirmModal
        names={data.children.filter(c => selected.has(c.id)).map(c => c.name)}
        onConfirm={handleDeleteConfirm}
        onClose={() => { if (!deleting) setShowDeleteModal(false) }}
        deleting={deleting}
      />
    )}
    {showAssignModal && data && (
      <DoctorChangeModal
        selectedChildren={data.children.filter(c => selected.has(c.id))}
        onClose={() => setShowAssignModal(false)}
        onDone={() => { setShowAssignModal(false); setReloadKey(k => k + 1) }}
      />
    )}
    <div className="min-h-screen flex bg-[#FAFAFA]">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8">

          {/* 목록으로 돌아가기 */}
          <div className="flex justify-end mb-2">
            <button
              type="button"
              onClick={() => go({ name: 'admin-members' })}
              className="text-[12px] text-black hover:text-[#005744] transition-colors"
            >
              목록으로 돌아가기 &gt;
            </button>
          </div>

          {/* 헤더: 제목 + 편집/저장 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-[18px] font-medium text-black">{roleLabel} 정보</h2>
            {!loading && !loadError && data && (
              isEditing ? (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-[100px] h-[40px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 disabled:opacity-40 transition-colors"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="w-[100px] h-[40px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 transition-colors"
                >
                  편집
                </button>
              )
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-[5px] animate-pulse bg-[#EAEAEA]" />
              ))}
            </div>
          ) : loadError ? (
            <div className="py-20 text-center text-[#919191]">
              회원 정보를 불러올 수 없습니다.
              <button type="button" onClick={() => go({ name: 'admin-members' })} className="ml-4 text-[#005744] underline text-[14px]">목록으로</button>
            </div>
          ) : data && (
            <>
              {/* 회원 정보 테이블 */}
              <section className="mb-8">
                <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
                  <table className="w-full table-fixed text-[15px]">
                    <thead>
                      <tr className="bg-[#EAEAEA] border-b border-[#575757]">
                        <th className="h-[52px] text-center font-medium text-[#272727]">활동</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">이름</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">식별코드</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">소속기관</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">소속과</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">진단 요일</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="h-[60px]">
                        {/* 활동 */}
                        <td className="text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              {(['재직', '휴직'] as const).map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setEditStatus(s)}
                                  className={`w-[40px] h-[24px] rounded-[5px] text-[13px] font-medium transition-colors ${
                                    editStatus === s
                                      ? s === '재직' ? 'bg-[#57987E] text-white' : 'bg-[#A7A7A7] text-white'
                                      : 'bg-[#EAEAEA] text-[#888]'
                                  }`}
                                >{s}</button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1.5">
                              <span className={`inline-flex items-center justify-center w-[40px] h-[20px] rounded-[5px] text-[13px] font-medium text-white ${
                                data.member.status === '재직' ? 'bg-[#57987E]' : 'bg-[#A7A7A7]'
                              }`}>{data.member.status}</span>
                              {data.member.is_new && (
                                <span className="inline-flex items-center justify-center w-[40px] h-[20px] rounded-[5px] text-[13px] font-medium text-white bg-[#8CC7FF]">NEW</span>
                              )}
                            </div>
                          )}
                        </td>
                        {/* 이름 */}
                        <td className="px-2 text-center">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editName}
                              onChange={e => setEditName(e.target.value)}
                              className="w-full text-center text-[15px] text-[#272727] border border-[#DEDEDE] rounded-[4px] px-2 py-1 outline-none focus:border-[#005744]"
                            />
                          ) : (
                            <span className="text-[#585858] font-medium">{data.member.name}</span>
                          )}
                        </td>
                        {/* 식별코드 - 항상 읽기 전용 */}
                        <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{data.member.code}</td>
                        {/* 소속기관 - 항상 읽기 전용 */}
                        <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{data.member.instt_code ?? '-'}</td>
                        {/* 소속과 */}
                        <td className="px-2 text-center">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editDepart}
                              onChange={e => setEditDepart(e.target.value)}
                              className="w-full text-center text-[15px] text-[#272727] border border-[#DEDEDE] rounded-[4px] px-2 py-1 outline-none focus:border-[#005744]"
                            />
                          ) : (
                            <span className="text-[#484848] font-normal">{data.member.depart_code ?? '-'}</span>
                          )}
                        </td>
                        {/* 진단 요일 */}
                        <td className="px-2 text-center">
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-[3px]">
                              {DAYS.map(day => (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => toggleDay(day)}
                                  className={`w-[26px] h-[26px] rounded-[4px] text-[12px] font-medium transition-colors ${
                                    editDays.includes(day)
                                      ? 'bg-[#005744] text-white'
                                      : 'bg-[#EAEAEA] text-[#888]'
                                  }`}
                                >{day}</button>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[#585858] font-medium">
                              {data.member.diag_days ?? '-'}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 담당 아동 목록 */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[18px] font-semibold">
                    <span className="text-[#919191]">담당 아동 목록</span>{' '}
                    <span className="text-[#005744]">{data.children.length}</span>
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={selected.size === 0}
                      onClick={() => setShowAssignModal(true)}
                      className="h-[40px] px-4 bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      담당의사 변경
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={selected.size === 0 || deleting}
                      className="h-[40px] px-4 border border-[#005744] text-[#005744] text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      아동 삭제
                    </button>
                  </div>
                </div>

                <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
                  <table className="w-full table-fixed text-[15px]">
                    <colgroup>
                      <col className="w-[54px]" />
                      <col /><col /><col /><col /><col /><col /><col /><col /><col />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#EAEAEA] border-b border-[#575757]">
                        <th className="h-[52px] text-center">
                          <input type="checkbox" checked={allPageSelected} onChange={toggleAll} className="w-[18px] h-[18px] accent-[#005744]" />
                        </th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">순번</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">이름</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">식별코드</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">생년월일</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">성별</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">다음 진료 예약</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">담당 치료사</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">다음 치료 예약</th>
                        <th className="h-[52px] text-center font-medium text-[#272727]">하이동동 시작일</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#DEDEDE]">
                      {data.children.length === 0 && (
                        <tr><td colSpan={10} className="py-16 text-center text-[#919191]">담당 아동이 없습니다.</td></tr>
                      )}
                      {pagedChildren.map((c, i) => (
                        <tr
                          key={c.id}
                          className="h-[52px] hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                          onClick={() => go({ name: 'admin-child-detail', id: c.id, memberId: id })}
                        >
                          <td className="text-center" onClick={e => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleRow(c.id)} className="w-[18px] h-[18px] accent-[#005744]" />
                          </td>
                          <td className="text-center text-[#585858] font-medium">{(page - 1) * PAGE_SIZE + i + 1}</td>
                          <td className="px-2 text-center text-[#585858] font-medium">{c.name}{c.age_label ? `(${c.age_label})` : ''}</td>
                          <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{c.identifier}</td>
                          <td className="px-2 text-center text-[#484848] font-normal tracking-[-0.03em]">{c.birth_date ?? '-'}</td>
                          <td className="text-center text-[#484848] font-normal">{c.gender}</td>
                          <td className="px-2 text-center text-[#484848] font-normal">{c.next_doctor_appointment ?? '-'}</td>
                          <td className="px-2 text-center text-[#484848] font-normal">{c.therapist_name ?? '-'}</td>
                          <td className="px-2 text-center text-[#484848] font-normal">{c.next_therapy_appointment ?? '-'}</td>
                          <td className="px-2 text-center text-[#484848] font-normal">{c.regist_date ?? '-'}</td>
                        </tr>
                      ))}
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
                          p === page ? 'bg-[#EAEAEA] text-[#5D5D5D]' : 'text-[#5D5D5D] hover:bg-[#EAEAEA]/60'
                        }`}>{p}</button>
                    ))}
                    <button type="button" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="w-8 h-[27px] flex items-center justify-center text-[#777777] disabled:opacity-30">
                      <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m1 1 5 5-5 5" /></svg>
                    </button>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </div>
    </>
  )
}
