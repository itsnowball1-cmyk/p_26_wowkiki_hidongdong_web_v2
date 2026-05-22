import { useEffect, useState } from 'react'
import StatsChildDetail from './StatsChildDetail'
import StatsStaffDetail from './StatsStaffDetail'

type StatGroup = { mau: number; wau: number; dau: number }
type MemberRow = { idx: number; id: string; code: string | null; name: string; birth_date: string | null; is_male: boolean; regist_date: string; child_count?: number }
type TabKey = 'funnel' | 'child' | 'doctor' | 'therapist'

const HEADERS = { 'content-type': 'application/json', 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }

const FUNNEL_STEPS = [
  { step: '앱 접속',       count: 1000, pct: 100, dropoutAfter: 10 },
  { step: '1음절 단어카드', count: 850,  pct: 85,  dropoutAfter: 10 },
  { step: '룰렛 게임',     count: 460,  pct: 46,  dropoutAfter: 27 },
  { step: '주사위 게임',   count: 520,  pct: 52,  dropoutAfter: 10 },
  { step: '문장 훈련',     count: 520,  pct: 52,  dropoutAfter: null },
]
const COMPLETION_RATE = 32

function calcAge(s: string | null) {
  if (!s) return '-'
  const parts = s.split('.')
  if (parts.length < 3) return '-'
  const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return `만 ${age}세`
}

export default function StatsInstitutionDetail({
  instt_code,
  instt_name,
  onBack,
}: {
  instt_code: string
  instt_name: string
  onBack: () => void
}) {
  const [kpi, setKpi] = useState<{ web: StatGroup; app: StatGroup } | null>(null)
  const [tab, setTab] = useState<TabKey>('funnel')
  const [members, setMembers] = useState<MemberRow[]>([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [selectedChild, setSelectedChild] = useState<MemberRow | null>(null)
  const [selectedStaff, setSelectedStaff] = useState<{ member: MemberRow; role: 'doctor' | 'therapist' } | null>(null)

  useEffect(() => {
    fetch(`/api/admin/institution-stats?instt_code=${instt_code}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setKpi(d) })
  }, [instt_code])

  const fetchMembers = (role: 'child' | 'doctor' | 'therapist') => {
    setMembersLoading(true)
    fetch(`/api/admin/institution-members?instt_code=${instt_code}&role=${role}&status=all`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : [])
      .then(d => setMembers(d as MemberRow[]))
      .finally(() => setMembersLoading(false))
  }

  const handleTabChange = (t: TabKey) => {
    setTab(t)
    if (t !== 'funnel') fetchMembers(t as 'child' | 'doctor' | 'therapist')
  }

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'funnel',    label: '앱 훈련 퍼널 차트' },
    { key: 'child',     label: '아동 리스트' },
    { key: 'doctor',    label: '의사 리스트' },
    { key: 'therapist', label: '치료사 리스트' },
  ]

  const maxPct = Math.max(...FUNNEL_STEPS.map(s => s.pct))
  const tabLabel = tab === 'child' ? '아동' : tab === 'doctor' ? '의사' : '치료사'

  if (selectedChild) {
    return (
      <StatsChildDetail
        child={selectedChild}
        onBack={() => setSelectedChild(null)}
      />
    )
  }

  if (selectedStaff) {
    return (
      <StatsStaffDetail
        member={selectedStaff.member}
        role={selectedStaff.role}
        instt_name={instt_name}
        onBack={() => setSelectedStaff(null)}
      />
    )
  }

  return (
    <div>
      {/* 목록으로 돌아가기 */}
      <div className="flex justify-end mb-4">
        <button type="button" onClick={onBack} className="text-[12px] text-[#000000] hover:text-[#005744] transition">
          목록으로 돌아가기&gt;
        </button>
      </div>

      {/* 기관 기본 정보 */}
      <h2 className="text-[18px] font-medium text-[#000000] mb-3">기관 기본 정보</h2>
      <div className="grid grid-cols-[242px_1fr_242px_1fr] border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-6">
        <div className="bg-[#EAEAEA] h-[52px] flex items-center px-6 text-[15px] font-medium text-[#222222] border-r border-[#DEDEDE]">기관명</div>
        <div className="bg-white h-[52px] flex items-center px-6 text-[15px] text-[#585858] border-r border-[#DEDEDE]">{instt_name}</div>
        <div className="bg-[#EAEAEA] h-[52px] flex items-center px-6 text-[15px] font-medium text-[#222222] border-r border-[#DEDEDE]">기관 식별코드</div>
        <div className="bg-white h-[52px] flex items-center px-6 text-[15px] text-[#484848]">{instt_code}</div>
      </div>

      {/* 웹/앱 KPI 카드 */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {(['web', 'app'] as const).map(type => (
          <div key={type}>
            <h3 className="text-[18px] font-medium text-[#000000] mb-2">{type === 'web' ? '웹' : '앱'} DAU/MAU/WAU</h3>
            <div className="bg-[#EAEAEA] rounded-[5px] p-3 flex gap-3">
              {(['mau', 'wau', 'dau'] as const).map(m => {
                const val = kpi?.[type]?.[m] ?? 0
                const isDAU = m === 'dau'
                return (
                  <div key={m} className="flex-1 bg-white rounded-[5px] px-3 py-2 flex flex-col justify-between relative overflow-hidden shadow-[0_0_4px_rgba(0,0,0,0.25)]" style={{ height: 80 }}>
                    <div className="flex items-start justify-between">
                      <span className="text-[10px] font-medium text-[#000000]">
                        {m === 'mau' ? 'MAU(월간)' : m === 'wau' ? 'WAU(주간)' : 'DAU(일간)'}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-[4px]"
                        style={{ backgroundColor: isDAU ? '#D5DCFF' : '#FFE2E2' }}>
                        {type === 'web' ? '웹' : '앱'}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[20px] font-semibold text-[#000000]">{val.toLocaleString()}</span>
                      <span className="text-[12px] text-[#000000]">명</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex items-baseline gap-8 mb-4">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => handleTabChange(t.key)}
            className={`text-[20px] transition-colors leading-none ${
              tab === t.key ? 'text-[#005744] font-semibold' : 'text-[#C0C0C0] font-medium'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 퍼널 탭 */}
      {tab === 'funnel' && (
        <div className="bg-white border border-[#DEDEDE] rounded-[5px] p-8" style={{ minHeight: 430 }}>
          <div className="flex gap-8">
            <div className="flex-1">
              {FUNNEL_STEPS.map((s, i) => (
                <div key={i}>
                  <div className="flex items-center gap-4 h-[36px]">
                    <div className="w-[140px] text-[15px] font-medium text-[#000000] flex-shrink-0">{s.step}</div>
                    <div className="w-[120px] text-[15px] text-[#585858] flex-shrink-0">{s.count.toLocaleString()}명 ({s.pct}%)</div>
                    <div className="flex-1 bg-[#F0F0F0] rounded-[3px] h-[24px] overflow-hidden">
                      <div
                        className="h-full rounded-[3px] transition-all"
                        style={{ width: `${(s.pct / maxPct) * 100}%`, backgroundColor: '#57987E' }}
                      />
                    </div>
                  </div>
                  {s.dropoutAfter !== null && (
                    <div className="flex items-center gap-4 h-[28px]">
                      <div className="w-[140px] flex-shrink-0" />
                      <div className="w-[120px] flex-shrink-0" />
                      <div className="text-[13px] text-[#FF5151] font-medium">이탈률 {s.dropoutAfter}%</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 미션 완료율 도넛 */}
            <div className="flex-shrink-0 flex flex-col items-center justify-center w-[200px]">
              <div className="relative w-[150px] h-[150px]">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="#EAEAEA" strokeWidth="14" />
                  <circle
                    cx="60" cy="60" r="50" fill="none"
                    stroke="#57987E" strokeWidth="14"
                    strokeDasharray={`${2 * Math.PI * 50 * COMPLETION_RATE / 100} ${2 * Math.PI * 50}`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[22px] font-bold text-[#000000]">{COMPLETION_RATE}%</span>
                </div>
              </div>
              <p className="text-[15px] font-medium text-[#000000] mt-3">미션 완료율 {COMPLETION_RATE}%</p>
            </div>
          </div>
        </div>
      )}

      {/* 멤버 탭 */}
      {tab !== 'funnel' && (
        <div className="bg-white border border-[#DEDEDE] rounded-[10px] overflow-hidden">
          {/* 목록 헤더 */}
          <div className="flex items-center px-6 py-3 border-b border-[#DEDEDE]">
            <p className="text-[18px] font-semibold">
              <span className="text-[#919191]">{tabLabel} 목록</span>
              <span className="text-[#005744] ml-2">{members.length}</span>
            </p>
          </div>

          {tab === 'child' ? (
            <>
              <div className="grid grid-cols-[60px_160px_160px_140px_100px_140px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#202020] text-center">
                <span>순번</span><span>이름(나이)</span><span>식별코드</span><span>생년월일</span><span>성별</span><span>가입일시</span>
              </div>
              {membersLoading ? <Empty text="불러오는 중…" /> : members.length === 0 ? <Empty text="아동이 없습니다." /> :
                members.map((m, i) => (
                  <button
                    key={m.idx}
                    type="button"
                    onClick={() => setSelectedChild(m)}
                    className={`w-full grid grid-cols-[60px_160px_160px_140px_100px_140px] px-6 py-3 items-center text-[15px] text-center hover:bg-[#F8F8F8] transition-colors ${i < members.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}
                  >
                    <span className="text-[#585858]">{i + 1}</span>
                    <span className="text-[#585858]">{m.name}({calcAge(m.birth_date)})</span>
                    <span className="text-[#484848]">{m.code ?? '-'}</span>
                    <span className="text-[#484848]">{m.birth_date ?? '-'}</span>
                    <span className="text-[#585858]">{m.is_male ? '남아' : '여아'}</span>
                    <span className="text-[#585858]">{m.regist_date}</span>
                  </button>
                ))
              }
            </>
          ) : (
            <>
              <div className="grid grid-cols-[60px_1fr_160px_100px_140px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#202020] text-center">
                <span>순번</span><span>이름</span><span>식별코드</span><span>담당 아동 수</span><span>가입일시</span>
              </div>
              {membersLoading ? <Empty text="불러오는 중…" /> : members.length === 0 ? <Empty text="데이터가 없습니다." /> :
                members.map((m, i) => (
                  <button
                    key={m.idx}
                    type="button"
                    onClick={() => setSelectedStaff({ member: m, role: tab as 'doctor' | 'therapist' })}
                    className={`w-full grid grid-cols-[60px_1fr_160px_100px_140px] px-6 py-3 items-center text-[15px] text-center hover:bg-[#F8F8F8] transition-colors ${i < members.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}
                  >
                    <span className="text-[#585858]">{i + 1}</span>
                    <span className="text-[#585858]">{m.name}</span>
                    <span className="text-[#484848]">{m.code ?? '-'}</span>
                    <span className="text-[#484848]">{m.child_count ?? 0}</span>
                    <span className="text-[#585858]">{m.regist_date}</span>
                  </button>
                ))
              }
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="py-12 text-center text-[14px] text-[#B5B5B5]">{text}</div>
}
