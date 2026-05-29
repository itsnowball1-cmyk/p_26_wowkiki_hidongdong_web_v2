import { useEffect, useState } from 'react'
import StatsCustomDetail from './StatsCustomDetail'

type MemberRow = { idx: number; id: string; code: string | null; name: string; regist_date: string; child_count?: number }
type WebKpi = { mau: number; wau: number; dau: number; mau_change: number; wau_change: number; dau_change: number }
type CustomKpi = { monthly: number; weekly: number; daily: number; m_change: number; w_change: number; d_change: number }
type LoginLog = { login_dt: string; ip: string; env: string }
type CustomLog = { log_idx: number; activity_dt: string; child_name_code: string; status: string }
type TaskLog = { task_dt: string; task_content: string; child_name_code: string }
type TabKey = 'login' | 'custom' | 'task'

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }
const PAGE_SIZE = 20

function TrendBadge({ change }: { change: number | undefined | null }) {
  if (change == null || change === 0) return <span className="text-[10px] font-semibold ml-2 text-[#585858]">-</span>
  if (change > 0) return <span className="text-[10px] font-semibold ml-2 text-[#FF5151]">↑{change}</span>
  return <span className="text-[10px] font-semibold ml-2 text-[#4656AA]">{change}</span>
}

export default function StatsStaffDetail({
  member,
  role,
  instt_name,
  onBack,
}: {
  member: MemberRow
  role: 'doctor' | 'therapist'
  instt_name: string
  onBack: () => void
}) {
  const [webKpi, setWebKpi] = useState<WebKpi | null>(null)
  const [customKpi, setCustomKpi] = useState<CustomKpi | null>(null)
  const [tab, setTab] = useState<TabKey>('login')
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([])
  const [customLogs, setCustomLogs] = useState<CustomLog[]>([])
  const [taskLogs, setTaskLogs] = useState<TaskLog[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedCustom, setSelectedCustom] = useState<CustomLog | null>(null)

  const roleLabel = role === 'doctor' ? '의사' : '치료사'

  useEffect(() => {
    fetch(`/api/admin/staff-stats?member_idx=${member.idx}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setWebKpi(d.web ?? null)
          setCustomKpi(d.custom ?? null)
        }
      })
  }, [member.idx])

  useEffect(() => {
    loadPage(tab, 1)
  }, [member.idx, tab])

  const loadPage = (t: TabKey, p: number) => {
    setLoading(true)
    setPage(p)
    const endpoint = t === 'login'
      ? `/api/admin/child-login-history?member_idx=${member.idx}&page=${p}&limit=${PAGE_SIZE}`
      : t === 'custom'
      ? `/api/admin/staff-custom-history?member_idx=${member.idx}&page=${p}&limit=${PAGE_SIZE}`
      : `/api/admin/staff-task-history?member_idx=${member.idx}&page=${p}&limit=${PAGE_SIZE}`
    fetch(endpoint, { headers: HEADERS })
      .then(r => r.ok ? r.json() : { items: [], total: 0 })
      .then(d => {
        if (t === 'login') setLoginLogs(d.items ?? [])
        else if (t === 'custom') setCustomLogs(d.items ?? [])
        else setTaskLogs(d.items ?? [])
        setTotal(d.total ?? 0)
      })
      .finally(() => setLoading(false))
  }

  const handleTabChange = (t: TabKey) => {
    setTab(t)
    setSearch('')
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const displayedLoginLogs = loginLogs.filter(r => !search || r.login_dt.includes(search) || r.ip.includes(search))
  const displayedCustomLogs = customLogs.filter(r => !search || r.activity_dt.includes(search) || r.child_name_code.includes(search))
  const displayedTaskLogs = taskLogs.filter(r => !search || r.task_dt.includes(search) || r.task_content.includes(search))

  if (selectedCustom) {
    return (
      <StatsCustomDetail
        log={selectedCustom}
        onBack={() => setSelectedCustom(null)}
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

      {/* 기본 정보 */}
      <h2 className="text-[18px] font-medium text-[#000000] mb-3">{roleLabel} 기본 정보</h2>
      <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-6">
        <div className="grid grid-cols-5 bg-[#EAEAEA] border-b border-[#DEDEDE] px-6 h-[52px] items-center text-[15px] font-medium text-[#202020] text-center">
          <span>이름</span>
          <span>식별코드</span>
          <span>담당 아동 수</span>
          <span>가입일시</span>
          <span>소속 기관</span>
        </div>
        <div className="grid grid-cols-5 bg-white px-6 h-[52px] items-center text-[15px] text-center">
          <span className="text-[#585858]">{member.name}</span>
          <span className="text-[#484848]">{member.code ?? '-'}</span>
          <span className="text-[#484848]">{member.child_count ?? 0}</span>
          <span className="text-[#585858]">{member.regist_date}</span>
          <span className="text-[#585858]">{instt_name}</span>
        </div>
      </div>

      {/* 웹 DAU/MAU/WAU + 커스텀 횟수 */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        <div>
          <h3 className="text-[18px] font-medium text-[#000000] mb-2">웹 DAU/MAU/WAU</h3>
          <div className="bg-[#EAEAEA] rounded-[5px] p-3 flex gap-3">
            {([
              { key: 'mau', label: 'MAU(월간)', val: webKpi?.mau ?? 0, change: webKpi?.mau_change, badge: '#FFE2E2' },
              { key: 'wau', label: 'WAU(주간)', val: webKpi?.wau ?? 0, change: webKpi?.wau_change, badge: '#D9D9D9' },
              { key: 'dau', label: 'DAU(일간)', val: webKpi?.dau ?? 0, change: webKpi?.dau_change, badge: '#D5DCFF' },
            ] as const).map(m => (
              <div key={m.key} className="flex-1 bg-white rounded-[5px] px-3 py-2 flex flex-col justify-between shadow-[0_0_4px_rgba(0,0,0,0.25)]" style={{ height: 80 }}>
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-medium text-[#000000]">{m.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-[4px]" style={{ backgroundColor: m.badge }}>웹</span>
                </div>
                <div className="flex items-baseline">
                  <span className="text-[20px] font-semibold text-[#000000]">{m.val.toLocaleString()}</span>
                  <span className="text-[12px] text-[#000000] ml-1">회 접속</span>
                  <TrendBadge change={m.change} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[18px] font-medium text-[#000000] mb-2">커스텀 횟수</h3>
          <div className="bg-[#EAEAEA] rounded-[5px] p-3 flex gap-3">
            {([
              { key: 'monthly', label: '월간', val: customKpi?.monthly ?? 0, change: customKpi?.m_change, badge: '#FFE2E2' },
              { key: 'weekly',  label: '주간', val: customKpi?.weekly  ?? 0, change: customKpi?.w_change, badge: '#D9D9D9' },
              { key: 'daily',   label: '일간', val: customKpi?.daily   ?? 0, change: customKpi?.d_change, badge: '#D5DCFF' },
            ] as const).map(m => (
              <div key={m.key} className="flex-1 bg-white rounded-[5px] px-3 py-2 flex flex-col justify-between shadow-[0_0_4px_rgba(0,0,0,0.25)]" style={{ height: 80 }}>
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-medium text-[#000000]">{m.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-[4px]" style={{ backgroundColor: m.badge }}>커스텀</span>
                </div>
                <div className="flex items-baseline">
                  <span className="text-[20px] font-semibold text-[#000000]">{m.val.toLocaleString()}</span>
                  <span className="text-[12px] text-[#000000] ml-1">회</span>
                  <TrendBadge change={m.change} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 탭 + 검색 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-8">
          {([
            { key: 'login'  as TabKey, label: '로그인 이력' },
            { key: 'custom' as TabKey, label: '커스텀 이력' },
            { key: 'task'   as TabKey, label: '작업 이력' },
          ]).map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => handleTabChange(t.key)}
              className={`text-[20px] leading-none transition-colors ${
                tab === t.key ? 'text-[#005744] font-semibold' : 'text-[#C0C0C0] font-medium'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center h-[40px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 w-[220px]">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="검색"
            className="flex-1 text-[14px] outline-none placeholder:text-[#B5B5B5]"
          />
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="5.5" stroke="#727272" strokeWidth="1.5"/>
            <path d="M13.5 13.5L17 17" stroke="#727272" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>

      {/* 로그 테이블 */}
      <div className="bg-white border border-[#DEDEDE] rounded-[10px] overflow-hidden mb-4">
        {tab === 'login' && (
          <>
            <div className="grid grid-cols-[1fr_1fr_160px] px-6 h-[52px] items-center bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#202020] text-center">
              <span>로그인 일시</span><span>접속IP</span><span>접속 환경</span>
            </div>
            {loading ? <Empty text="불러오는 중…" /> : displayedLoginLogs.length === 0 ? <Empty text="로그인 이력이 없습니다." /> :
              displayedLoginLogs.map((r, i) => (
                <div key={i} className={`grid grid-cols-[1fr_1fr_160px] px-6 h-[36px] items-center text-[15px] text-center ${i < displayedLoginLogs.length - 1 ? 'border-b border-[#DBDBDB]' : ''}`}>
                  <span className="text-[#585858]">{r.login_dt}</span>
                  <span className="text-[#585858]">{r.ip}</span>
                  <span className="text-[#585858]">{r.env}</span>
                </div>
              ))
            }
          </>
        )}
        {tab === 'custom' && (
          <>
            <div className="grid grid-cols-[1fr_1fr_160px] px-6 h-[52px] items-center bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#202020] text-center">
              <span>일시</span><span>아동 이름(식별코드)</span><span>상태</span>
            </div>
            {loading ? <Empty text="불러오는 중…" /> : displayedCustomLogs.length === 0 ? <Empty text="커스텀 이력이 없습니다." /> :
              displayedCustomLogs.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedCustom(r)}
                  className={`w-full grid grid-cols-[1fr_1fr_160px] px-6 h-[36px] items-center text-[15px] text-center hover:bg-[#F8F8F8] transition-colors ${i < displayedCustomLogs.length - 1 ? 'border-b border-[#DBDBDB]' : ''}`}
                >
                  <span className="text-[#585858]">{r.activity_dt}</span>
                  <span className="text-[#585858]">{r.child_name_code}</span>
                  <span className="text-[#585858]">{r.status}</span>
                </button>
              ))
            }
          </>
        )}
        {tab === 'task' && (
          <>
            <div className="grid grid-cols-[1fr_1fr_1fr] px-6 h-[52px] items-center bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#202020] text-center">
              <span>작업 시각</span><span>작업내용</span><span>대상 아동 이름(식별코드)</span>
            </div>
            {loading ? <Empty text="불러오는 중…" /> : displayedTaskLogs.length === 0 ? <Empty text="작업 이력이 없습니다." /> :
              displayedTaskLogs.map((r, i) => (
                <div key={i} className={`grid grid-cols-[1fr_1fr_1fr] px-6 h-[36px] items-center text-[15px] text-center ${i < displayedTaskLogs.length - 1 ? 'border-b border-[#DBDBDB]' : ''}`}>
                  <span className="text-[#585858]">{r.task_dt}</span>
                  <span className="text-[#585858]">{r.task_content}</span>
                  <span className="text-[#484848]">{r.child_name_code}</span>
                </div>
              ))
            }
          </>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1">
          <button type="button" onClick={() => loadPage(tab, page - 1)} disabled={page === 1}
            className="w-[27px] h-[27px] flex items-center justify-center disabled:opacity-30">
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M6 1L1 6L6 11" stroke="#777777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
            const p = i + 1
            return (
              <button key={p} type="button" onClick={() => loadPage(tab, p)}
                className={`w-[29px] h-[27px] rounded-[5px] text-[15px] font-medium transition-colors ${
                  page === p ? 'bg-[#D9D9D9] text-[#5D5D5D]' : 'text-[#5D5D5D] hover:bg-[#F0F0F0]'
                }`}>
                {p}
              </button>
            )
          })}
          <button type="button" onClick={() => loadPage(tab, page + 1)} disabled={page >= totalPages}
            className="w-[27px] h-[27px] flex items-center justify-center disabled:opacity-30">
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1L6 6L1 11" stroke="#777777" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <div className="py-12 text-center text-[14px] text-[#B5B5B5]">{text}</div>
}
