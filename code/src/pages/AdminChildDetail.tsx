import { useEffect, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { api, type AdminChildDetail as ChildDetail, type AdminChildSchedule, type AdminStaffItem } from '../lib/api'
import { useRouter } from '../lib/router'

// ── 캘린더 ──────────────────────────────────────────────────────────────────

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

function Calendar({ childId, childName }: { childId: number; childName: string }) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [schedules, setSchedules] = useState<AdminChildSchedule[]>([])
  const [showDoctor, setShowDoctor] = useState(true)
  const [showTherapist, setShowTherapist] = useState(true)

  useEffect(() => {
    api.adminChildSchedules(childId, year, month)
      .then(setSchedules)
      .catch(() => {})
  }, [childId, year, month])

  const prevMonth = () => { if (month === 1) { setYear(y => y - 1); setMonth(12) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 12) { setYear(y => y + 1); setMonth(1) } else setMonth(m => m + 1) }

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const filtered = schedules.filter(s =>
    (s.schedule_type === '1' && showDoctor) || (s.schedule_type !== '1' && showTherapist)
  )

  const schedsByDate: Record<number, AdminChildSchedule[]> = {}
  filtered.forEach(s => {
    const d = new Date(s.start_datetime)
    if (d.getFullYear() === year && d.getMonth() + 1 === month) {
      const day = d.getDate()
      if (!schedsByDate[day]) schedsByDate[day] = []
      schedsByDate[day].push(s)
    }
  })

  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() + 1 && year === today.getFullYear()

  const fmtTime = (dt: string) => dt.slice(11, 16)

  return (
    <div>
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button type="button" onClick={prevMonth} className="w-8 h-8 rounded-full bg-[#57988A] flex items-center justify-center">
          <svg width="8" height="13" viewBox="0 0 8 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M7 1 1 7l6 6" /></svg>
        </button>
        <span className="text-[30px] font-normal text-[#3E3E3E]">{year}년 {month}월</span>
        <button type="button" onClick={nextMonth} className="w-8 h-8 rounded-full bg-[#57988A] flex items-center justify-center">
          <svg width="8" height="13" viewBox="0 0 8 14" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M1 1l6 6-6 6" /></svg>
        </button>
      </div>

      {/* 타이틀 + 필터 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[18px] font-semibold text-[#2F2E2E]">{childName} 아동 일정</span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => setShowDoctor(v => !v)}>
            <span className={`w-[18px] h-[18px] rounded-[3px] border-2 flex items-center justify-center transition-colors ${showDoctor ? 'bg-[#FFE180] border-[#FFE180]' : 'bg-white border-[#DEDEDE]'}`}>
              {showDoctor && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="#4B4B4B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
            <span className="text-[15px] text-[#3E3E3E]">진료</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer" onClick={() => setShowTherapist(v => !v)}>
            <span className={`w-[18px] h-[18px] rounded-[3px] border-2 flex items-center justify-center transition-colors ${showTherapist ? 'bg-[#78C773] border-[#78C773]' : 'bg-white border-[#DEDEDE]'}`}>
              {showTherapist && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </span>
            <span className="text-[15px] text-[#3E3E3E]">치료</span>
          </label>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className="h-11 flex items-center justify-center text-[18px] font-medium text-black">{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 border-t border-l border-[#DEDEDE]">
        {cells.map((day, idx) => (
          <div key={idx} className="min-h-[140px] border-r border-b border-[#DEDEDE] p-2">
            {day !== null && (
              <>
                <div className="mb-1">
                  {isToday(day) ? (
                    <span className="w-7 h-7 rounded-full bg-[#005744] text-white flex items-center justify-center text-[15px]">{day}</span>
                  ) : (
                    <span className="text-[15px] text-[#3E3E3E]">{day}</span>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  {(schedsByDate[day] ?? []).map(s => (
                    <div
                      key={s.id}
                      className={`px-1.5 py-0.5 rounded text-[13px] truncate ${
                        s.schedule_type === '1'
                          ? 'bg-[#FFE180] text-[#4B4B4B]'
                          : 'bg-[#78C773] text-white'
                      }`}
                    >
                      {fmtTime(s.start_datetime)} {s.schedule_type === '1' ? '진료' : s.schedule_type === '2' ? '언어치료' : '치료'}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 배정 팝업 ────────────────────────────────────────────────────────────────

function AssignModal({
  type,
  childId,
  childName,
  onClose,
  onAssigned,
}: {
  type: 'doctor' | 'therapist'
  childId: number
  childName: string
  onClose: () => void
  onAssigned: (staff: AdminStaffItem) => void
}) {
  const isDoctor = type === 'doctor'
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AdminStaffItem[]>([])
  const [loading, setLoading] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [pending, setPending] = useState<AdminStaffItem | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    setLoading(true)
    api.adminStaff(type, query)
      .then(setResults)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [query, type])

  const handleConfirm = async () => {
    if (!pending || assigning) return
    setAssigning(true)
    try {
      const body = isDoctor
        ? { doctor_code: pending.code }
        : { teacher_code: pending.code }
      await api.adminAssignChild(childId, body)
      onAssigned(pending)
      onClose()
    } finally {
      setAssigning(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative bg-white w-[520px] h-[560px] rounded overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-[22px] right-[22px] w-[18px] h-[18px] flex items-center justify-center text-[#3E3E3E] hover:text-black transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M2 2l14 14M16 2 2 16" />
          </svg>
        </button>

        {/* 제목 */}
        <div className="px-[37px] pt-[42px]">
          <h2 className="text-[18px] font-semibold text-black">
            {isDoctor ? '담당 의사 배정하기' : '담당 치료사 배정하기'}
          </h2>
        </div>

        {/* 검색 */}
        <div className="px-[37px] mt-[21px] relative">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={isDoctor ? '의사의 이름이나 소속과를 입력하세요.' : '치료사의 이름이나 소속과를 입력하세요.'}
            className="w-full h-[29px] border-b-2 border-[#7C7C7C] text-[15px] text-[#3E3E3E] placeholder-[#AEAEAE] focus:outline-none pr-9 tracking-[-0.03em] bg-transparent"
            autoFocus
          />
          <span className="absolute right-[37px] top-1/2 -translate-y-1/2 pointer-events-none text-[#7C7C7C]">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="9" r="6" /><path d="m14 14 4 4" strokeLinecap="round" />
            </svg>
          </span>
        </div>

        {/* 목록 */}
        <div className="px-[37px] mt-[46px] overflow-y-auto" style={{ maxHeight: '371px' }}>
          {loading && (
            <div className="flex items-center justify-center py-10 text-[15px] text-[#AEAEAE]">
              검색 중...
            </div>
          )}
          {!loading && query.trim() && results.length === 0 && (
            <div className="flex items-center justify-center py-10 text-[15px] text-[#AEAEAE]">
              검색 결과가 없습니다.
            </div>
          )}
          {!loading && results.map(staff => (
            <div
              key={staff.code}
              onClick={() => setPending(staff)}
              className="h-[71px] flex flex-col justify-center cursor-pointer hover:bg-[#F5F5F5] -mx-[37px] px-[37px] transition-colors"
            >
              <div className="text-[15px] text-[#AEAEAE] tracking-[-0.03em]">
                {staff.name} ({staff.code})
              </div>
              <div className="text-[15px] text-[#AEAEAE] tracking-[-0.03em]">
                {staff.depart_code ?? '-'}
              </div>
            </div>
          ))}
        </div>

        {/* 확인 팝업 */}
        {pending && (
          <div className="absolute inset-0 z-[60] bg-black/40 flex items-center justify-center">
            <div className="bg-white rounded-[12px] px-8 py-8 w-[340px] flex flex-col items-center gap-6" onClick={e => e.stopPropagation()}>
              <p className="text-[15px] text-center leading-relaxed text-ink-900">
                <span className="font-bold">{childName}</span> 아동의 담당 {isDoctor ? '의사' : '치료사'}를{' '}
                <span className="font-bold">{pending.name}</span>으로 변경하시겠습니까?
              </p>
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setPending(null)}
                  className="flex-1 h-[44px] rounded-[8px] border border-line-soft text-[15px] font-medium text-ink-700 hover:bg-surface-active transition-colors"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={assigning}
                  className="flex-1 h-[44px] rounded-[8px] bg-brand text-white text-[15px] font-medium hover:bg-brand/90 disabled:opacity-50 transition-colors"
                >
                  변경하기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────────────────────

export default function AdminChildDetail({ id, memberId }: { id: number; memberId?: number }) {
  const { go } = useRouter()
  const [child, setChild] = useState<ChildDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [assignModal, setAssignModal] = useState<'doctor' | 'therapist' | null>(null)

  const backRoute = memberId ? { name: 'admin-member-detail' as const, id: memberId } : { name: 'admin-children' as const }

  useEffect(() => {
    api.adminChildDetail(id)
      .then(setChild)
      .catch(() => go(backRoute))
      .finally(() => setLoading(false))
  }, [id])

  const handleAssigned = (type: 'doctor' | 'therapist', staff: AdminStaffItem) => {
    setChild(prev => {
      if (!prev) return prev
      if (type === 'doctor') {
        return {
          ...prev,
          doctor_code: staff.code,
          doctor_name: staff.name,
          doctor_department: staff.depart_code ?? null,
        }
      } else {
        return {
          ...prev,
          teacher_code: staff.code,
          therapist_name: staff.name,
          therapist_department: staff.depart_code ?? null,
        }
      }
    })
  }

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-10 py-7">

          {/* 헤더 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => go(backRoute)}
                className="flex items-center gap-1 text-[#919191] hover:text-[#005744] transition-colors text-[15px]"
              >
                <svg width="6" height="11" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 1 1 6l5 5" /></svg>
                목록
              </button>
              <span className="text-[18px] font-semibold text-[#343A40]">
                {loading ? '' : child?.name} 아동 정보
              </span>
            </div>
            <button
              type="button"
              className="w-[100px] h-[40px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 transition-colors"
            >
              수정
            </button>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-[5px] animate-pulse bg-[#EAEAEA]" />
              ))}
            </div>
          ) : child && (
            <>
              {/* 아동 기본 정보 */}
              <section className="mb-8">
                <h2 className="text-[18px] font-semibold text-black mb-3">아동 기본 정보</h2>
                <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
                  <table className="w-full table-fixed text-[15px]">
                    <thead>
                      <tr className="bg-[#EAEAEA] border-b border-[#575757]">
                        <th className="h-[52px] text-center font-medium text-[#343A40]">이름(나이)</th>
                        <th className="h-[52px] text-center font-medium text-[#343A40]">식별코드</th>
                        <th className="h-[52px] text-center font-medium text-[#343A40]">생년월일</th>
                        <th className="h-[52px] text-center font-medium text-[#343A40]">성별</th>
                        <th className="h-[52px] text-center font-medium text-[#343A40]">하이동동 시작일</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="h-[52px]">
                        <td className="text-center text-[#585858] font-medium">
                          {child.name}{child.age_label ? `(${child.age_label})` : ''}
                        </td>
                        <td className="text-center text-[#484848] font-normal tracking-[-0.03em]">{child.identifier}</td>
                        <td className="text-center text-[#484848] font-normal tracking-[-0.03em]">{child.birth_date ?? '-'}</td>
                        <td className="text-center text-[#585858] font-medium">{child.gender}</td>
                        <td className="text-center text-[#585858] font-medium">{child.regist_date ?? '-'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* 담당 의사 / 치료사 */}
              <section className="mb-8">
                <div className="grid grid-cols-2 gap-6">
                  {/* 담당 의사 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-[18px] font-semibold text-black">담당 의사 정보</h2>
                      <button
                        type="button"
                        onClick={() => setAssignModal('doctor')}
                        className="w-[100px] h-[40px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 transition-colors"
                      >
                        배정/변경
                      </button>
                    </div>
                    <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
                      <table className="w-full text-[15px]">
                        <tbody>
                          {[
                            { label: '이름', value: child.doctor_name ?? '-' },
                            { label: '소속과', value: child.doctor_department ?? '-' },
                            { label: '식별코드', value: child.doctor_code ?? '-' },
                          ].map(({ label, value }) => (
                            <tr key={label} className="border-b border-[#DEDEDE] last:border-0">
                              <td className="w-[160px] h-[52px] px-6 font-medium text-black bg-[#FAFAFA]">{label}</td>
                              <td className="h-[52px] px-6 text-[#585858]">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 담당 치료사 */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-[18px] font-semibold text-black">담당 치료사 정보</h2>
                      <button
                        type="button"
                        onClick={() => setAssignModal('therapist')}
                        className="w-[100px] h-[40px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/90 transition-colors"
                      >
                        배정/변경
                      </button>
                    </div>
                    <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
                      <table className="w-full text-[15px]">
                        <tbody>
                          {[
                            { label: '이름', value: child.therapist_name ?? '-' },
                            { label: '소속과', value: child.therapist_department ?? '-' },
                            { label: '식별코드', value: child.teacher_code ?? '-' },
                          ].map(({ label, value }) => (
                            <tr key={label} className="border-b border-[#DEDEDE] last:border-0">
                              <td className="w-[160px] h-[52px] px-6 font-medium text-black bg-[#FAFAFA]">{label}</td>
                              <td className="h-[52px] px-6 text-[#585858]">{value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>

              {/* 아동 일정 캘린더 */}
              <section>
                <Calendar childId={id} childName={child.name} />
              </section>
            </>
          )}
        </main>
      </div>

      {/* 배정 팝업 */}
      {assignModal && (
        <AssignModal
          type={assignModal}
          childId={id}
          childName={child?.name ?? ''}
          onClose={() => setAssignModal(null)}
          onAssigned={staff => handleAssigned(assignModal, staff)}
        />
      )}
    </div>
  )
}
