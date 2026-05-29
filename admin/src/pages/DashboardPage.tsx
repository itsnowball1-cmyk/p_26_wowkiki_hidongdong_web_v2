import { useEffect, useRef, useState } from 'react'
import Layout from '../components/Layout'
import { useRouter } from '../lib/router'

type Metric = 'mau' | 'wau' | 'dau'

type MauSet = {
  mau: number; wau: number; dau: number
  mau_change: number; wau_change: number; dau_change: number
}

type DashboardStats = {
  total_institutions: number
  total_web_users: number
  total_app_users: number
  new_web_this_month: number
  new_web_last_month: number
  new_app_this_month: number
  new_app_last_month: number
}

type PendingItem = {
  idx: number; name: string; inst_name: string
  role: string; instt_code: string; regist_date: string
}

type InquiryItem = {
  cs_idx: number; name: string; s_title: string
  regist_date: string; s_type: string
}

type NoticeItem = { idx: number; title: string; created_at: string }

type DashboardData = {
  stats: DashboardStats
  mau_stats: { web: MauSet; app: MauSet }
  pending_total: number
  pending_approvals: PendingItem[]
  unanswered_total: number
  inquiries: InquiryItem[]
  pinned_notices: NoticeItem[]
  recent_notices: NoticeItem[]
}

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }
const METRIC_LABELS: Record<Metric, string> = { mau: 'MAU', wau: 'WAU', dau: 'DAU' }
const S_TYPE: Record<string, string> = {
  '01': '아동관리', '02': '전체 내진 일정', '03': '아동별 커스텀',
  '04': '마이페이지', '05': '기타',
}

function fmtDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function getDateRange(metric: Metric): string {
  const now = new Date()
  if (metric === 'mau') {
    return `${fmtDate(new Date(now.getFullYear(), now.getMonth(), 1))} ~ ${fmtDate(now)}`
  }
  if (metric === 'wau') {
    return `${fmtDate(new Date(now.getTime() - 7 * 86400000))} ~ ${fmtDate(now)}`
  }
  return fmtDate(new Date(now.getTime() - 86400000))
}

function pctChange(curr: number, prev: number): number | null {
  if (prev === 0 && curr === 0) return null
  if (prev === 0) return 100
  return Math.round((curr - prev) / prev * 100)
}

export default function DashboardPage() {
  const { go } = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [webMetric, setWebMetric] = useState<Metric>('mau')
  const [appMetric, setAppMetric] = useState<Metric>('mau')
  const [approveModal, setApproveModal] = useState<{ idx: number; role: string; insttCode: string } | null>(null)
  const [insttCodeInput, setInsttCodeInput] = useState('')
  const [rejectModal, setRejectModal] = useState<{ idx: number; name: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/admin/dashboard-data', { headers: HEADERS })
      .then(r => r.ok ? r.json() as Promise<DashboardData> : null)
      .then(d => { if (d) setData(d) })
      .finally(() => setLoading(false))
  }, [])

  const handleApprove = async (action: 'approve' | 'reject') => {
    const idx = action === 'approve' ? approveModal?.idx : rejectModal?.idx
    if (!idx) return
    setActionLoading(idx)
    try {
      const body: Record<string, unknown> = { idx, action }
      if (action === 'approve') body.instt_code = insttCodeInput
      if (action === 'reject') body.reject_reason = rejectReason
      const res = await fetch('/api/admin/approve', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) })
      if (res.ok) {
        setData(prev => prev ? {
          ...prev,
          pending_approvals: prev.pending_approvals.filter(a => a.idx !== idx),
          pending_total: Math.max(0, prev.pending_total - 1),
        } : prev)
        setApproveModal(null); setRejectModal(null)
        setInsttCodeInput(''); setRejectReason('')
      }
    } finally { setActionLoading(null) }
  }

  const s = data?.stats
  const ms = data?.mau_stats
  const alertTotal = (data?.pending_total ?? 0) + (data?.unanswered_total ?? 0)

  return (
    <Layout title="대시보드">
      {/* ── KPI 카드 3개 ── */}
      <div className="grid grid-cols-3 gap-5 mb-5">
        <KpiCard label="전체 기관 수"      value={loading ? '—' : (s?.total_institutions ?? 0).toLocaleString()} unit="곳" pct={pctChange(s?.new_web_this_month ?? 0, s?.new_web_last_month ?? 0)} />
        <KpiCard label="전체 웹 유저"      value={loading ? '—' : (s?.total_web_users   ?? 0).toLocaleString()} unit="명" pct={pctChange(s?.new_web_this_month ?? 0, s?.new_web_last_month ?? 0)} />
        <KpiCard label="전체 앱 아동 유저" value={loading ? '—' : (s?.total_app_users   ?? 0).toLocaleString()} unit="명" pct={pctChange(s?.new_app_this_month ?? 0, s?.new_app_last_month ?? 0)} />
      </div>

      {/* ── MAU 패널 2개 ── */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        <MauPanel title="Web" metric={webMetric} onMetricChange={setWebMetric} stats={ms?.web} loading={loading} onDetail={() => go({ name: 'stats' })} />
        <MauPanel title="App" metric={appMetric} onMetricChange={setAppMetric} stats={ms?.app} loading={loading} onDetail={() => go({ name: 'stats' })} />
      </div>

      {/* ── 하단 2패널 ── */}
      <div className="grid grid-cols-2 gap-5">

        {/* 공지사항 */}
        <div>
          <h2 className="text-[20px] font-semibold text-[#202020] mb-3">공지사항</h2>
          <div className="bg-white rounded-[10px] border border-[#DEDEDE] overflow-hidden">
            <NoticeSection title="고정 공지" notices={data?.pinned_notices ?? []} loading={loading} onNew={() => go({ name: 'notice-write' })} onSelect={id => go({ name: 'notice-detail', id: String(id) })} onEdit={id => go({ name: 'notice-detail', id: String(id) })} />
            <div className="border-t-4 border-[#F3F3F3]">
              <NoticeSection title="일반 공지" notices={data?.recent_notices ?? []} loading={loading} onNew={() => go({ name: 'notice-write' })} onSelect={id => go({ name: 'notice-detail', id: String(id) })} onEdit={id => go({ name: 'notice-detail', id: String(id) })} />
            </div>
          </div>
        </div>

        {/* 알림 */}
        <div>
          <div className="flex items-baseline gap-1.5 mb-3">
            <h2 className="text-[20px] font-semibold text-[#202020]">알림</h2>
            {alertTotal > 0 && <span className="text-[20px] font-semibold text-[#FF4646]">{alertTotal}</span>}
          </div>
          <div className="bg-white rounded-[10px] border border-[#DEDEDE] overflow-hidden">

            {/* 신규 기관 승인 */}
            <div>
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[16px] font-medium text-[#202020]">신규 기관 승인</span>
                  {(data?.pending_total ?? 0) > 0 && (
                    <span className="text-[16px] font-medium text-[#FF4646]">{data!.pending_total}</span>
                  )}
                </div>
                <button type="button" onClick={() => go({ name: 'institutions' })}
                  className="text-[12px] text-[#919191] hover:text-[#005744]">전체보기 &gt;</button>
              </div>
              <div className="grid grid-cols-[90px_1fr_110px_70px] px-5 py-2 bg-[#EAEAEA] text-[13px] font-medium text-[#202020] text-center border-t border-[#DEDEDE]">
                <span>가입일시</span><span>기관명</span><span>승인/반려</span><span>상세보기</span>
              </div>
              {loading ? (
                <div className="py-5 text-center text-[12px] text-[#B5B5B5]">불러오는 중…</div>
              ) : (data?.pending_approvals ?? []).length === 0 ? (
                <div className="py-5 text-center text-[12px] text-[#B5B5B5]">승인 대기 없음</div>
              ) : data!.pending_approvals.map((a, i) => (
                <div key={a.idx} className={`grid grid-cols-[90px_1fr_110px_70px] px-5 py-2 items-center text-[13px] text-center ${i % 2 === 0 ? 'bg-white' : 'bg-[#EAEAEA]'}`}>
                  <span className="text-[#202020]">{a.regist_date}</span>
                  <span className="text-[#202020] text-left truncate px-1">{a.inst_name || a.instt_code}</span>
                  <div className="flex justify-center gap-1">
                    <button type="button" disabled={actionLoading === a.idx}
                      onClick={() => { setApproveModal({ idx: a.idx, role: a.role, insttCode: a.instt_code }); setInsttCodeInput(a.role === '치료사' ? a.instt_code : '') }}
                      className="w-[42px] h-[25px] rounded-[5px] bg-[#6EBE88] text-white text-[12px] font-medium hover:opacity-80 disabled:opacity-50">승인</button>
                    <button type="button" disabled={actionLoading === a.idx}
                      onClick={() => setRejectModal({ idx: a.idx, name: a.inst_name || a.name })}
                      className="w-[42px] h-[25px] rounded-[5px] bg-[#FF7979] text-white text-[12px] font-medium hover:opacity-80 disabled:opacity-50">반려</button>
                  </div>
                  <button type="button" onClick={() => go({ name: 'institutions' })}
                    className="text-[12px] text-[#202020] hover:text-[#005744]">상세보기</button>
                </div>
              ))}
            </div>

            {/* 문의사항 */}
            <div className="border-t-4 border-[#F3F3F3]">
              <div className="flex items-center justify-between px-5 py-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-[16px] font-medium text-[#202020]">문의사항</span>
                  {(data?.unanswered_total ?? 0) > 0 && (
                    <span className="text-[16px] font-medium text-[#FF4646]">{data!.unanswered_total}</span>
                  )}
                </div>
                <button type="button" onClick={() => go({ name: 'cs' })}
                  className="text-[12px] text-[#919191] hover:text-[#005744]">전체보기 &gt;</button>
              </div>
              <div className="grid grid-cols-[90px_80px_1fr_70px] px-5 py-2 bg-[#EAEAEA] text-[13px] font-medium text-[#202020] text-center border-t border-[#DEDEDE]">
                <span>등록일시</span><span>문의유형</span><span className="text-left">제목</span><span>답변</span>
              </div>
              {loading ? (
                <div className="py-5 text-center text-[12px] text-[#B5B5B5]">불러오는 중…</div>
              ) : (data?.inquiries ?? []).length === 0 ? (
                <div className="py-5 text-center text-[12px] text-[#B5B5B5]">미답변 문의 없음</div>
              ) : data!.inquiries.map((q, i) => (
                <div key={q.cs_idx}
                  onClick={() => go({ name: 'cs-detail', id: String(q.cs_idx) })}
                  className={`grid grid-cols-[90px_80px_1fr_70px] px-5 py-2 items-center text-[13px] text-center cursor-pointer hover:bg-[#F5F5F5] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#EAEAEA]'}`}>
                  <span className="text-[#202020]">{q.regist_date}</span>
                  <span className="text-[#202020]">{S_TYPE[q.s_type] ?? (q.s_type || '-')}</span>
                  <span className="text-[#202020] text-left truncate px-1">{q.s_title}</span>
                  <span className="text-[#FF4646] font-medium">답변대기</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 승인 모달 */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] p-6 w-[360px] shadow-xl">
            <h3 className="text-[16px] font-bold text-[#202020] mb-4">승인 처리</h3>
            {approveModal.role !== '치료사' ? (
              <div className="mb-4">
                <label className="block text-[13px] text-[#727272] mb-1">기관코드</label>
                <input type="text" value={insttCodeInput} onChange={e => setInsttCodeInput(e.target.value)}
                  placeholder="기관코드 입력"
                  className="w-full h-[40px] border border-[#DEDEDE] rounded-[5px] px-3 text-[14px] outline-none focus:border-[#005744]" />
              </div>
            ) : (
              <p className="text-[13px] text-[#727272] mb-4">치료사 승인을 진행합니다.</p>
            )}
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setApproveModal(null); setInsttCodeInput('') }}
                className="px-4 h-[36px] rounded-[5px] border border-[#DEDEDE] text-[14px] text-[#727272] hover:bg-[#F9F9F9]">취소</button>
              <button type="button" disabled={!!actionLoading || (approveModal.role !== '치료사' && !insttCodeInput.trim())}
                onClick={() => handleApprove('approve')}
                className="px-4 h-[36px] rounded-[5px] bg-[#005744] text-white text-[14px] font-medium hover:opacity-80 disabled:opacity-50">승인</button>
            </div>
          </div>
        </div>
      )}

      {/* 반려 모달 */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] p-6 w-[360px] shadow-xl">
            <h3 className="text-[16px] font-bold text-[#202020] mb-1">반려 처리</h3>
            <p className="text-[13px] text-[#727272] mb-4">{rejectModal.name}</p>
            <div className="mb-4">
              <label className="block text-[13px] text-[#727272] mb-1">반려 사유</label>
              <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="반려 사유를 입력해주세요" rows={3}
                className="w-full border border-[#DEDEDE] rounded-[5px] px-3 py-2 text-[14px] outline-none focus:border-[#005744] resize-none" />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setRejectModal(null); setRejectReason('') }}
                className="px-4 h-[36px] rounded-[5px] border border-[#DEDEDE] text-[14px] text-[#727272] hover:bg-[#F9F9F9]">취소</button>
              <button type="button" disabled={!!actionLoading} onClick={() => handleApprove('reject')}
                className="px-4 h-[36px] rounded-[5px] bg-[#FF7979] text-white text-[14px] font-medium hover:opacity-80 disabled:opacity-50">반려</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

/* ── KPI 카드 — 가로 한 줄 레이아웃, 회색 배경, 퍼센트 배지 ── */
function KpiCard({ label, value, unit, pct }: {
  label: string; value: string; unit: string; pct: number | null
}) {
  const up = (pct ?? 0) >= 0
  return (
    <div className="bg-[#EAEAEA] rounded-[10px] px-6 h-[72px] flex items-center justify-between">
      <span className="text-[15px] font-medium text-[#202020]">{label}</span>
      <div className="flex items-center gap-5">
        <div className="flex items-baseline gap-1">
          <span className="text-[22px] font-bold text-[#202020]">{value}</span>
          <span className="text-[14px] text-[#202020]">{unit}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {pct !== null ? (
            <span className={`text-[14px] font-semibold ${up ? 'text-[#FF5151]' : 'text-[#4656AA]'}`}>
              {up ? `↑${pct}%` : `↓${Math.abs(pct)}%`}
            </span>
          ) : (
            <span className="text-[14px] text-[#B5B5B5]">-</span>
          )}
          <span className="text-[13px] text-[#919191]">지난달 대비</span>
        </div>
      </div>
    </div>
  )
}

/* ── MAU 패널 — 좌측 회색(제목) + 우측 흰색(데이터) 투톤 ── */
function MauPanel({ title, metric, onMetricChange, stats, loading, onDetail }: {
  title: string; metric: Metric; onMetricChange: (m: Metric) => void
  stats?: MauSet; loading: boolean; onDetail: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const count = stats?.[metric] ?? 0
  const change = (stats?.[`${metric}_change` as keyof MauSet] as number) ?? 0
  const up = change > 0

  return (
    <div className="rounded-[10px] overflow-hidden flex" style={{ border: '1px solid #DEDEDE', minHeight: '200px' }}>
      {/* 좌측 회색 영역 */}
      <div className="w-[180px] flex-shrink-0 bg-[#EAEAEA] flex items-center justify-center">
        <span className="text-[25px] font-bold text-[#000000]">{title}</span>
      </div>

      {/* 우측 흰색 영역 */}
      <div className="flex-1 bg-white px-6 py-5 flex flex-col">
        {/* 드롭다운 + 날짜 범위 */}
        <div className="flex items-center gap-2 mb-4">
          <div className="relative" ref={ref}>
            <button type="button" onClick={() => setOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 h-[31px] rounded-[8px] bg-[#EAEAEA] text-[15px] font-medium text-[#202020] select-none whitespace-nowrap">
              {METRIC_LABELS[metric]}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" className={`transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`}>
                <path d="M1 1L5 5L9 1" stroke="#222222" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {open && (
              <div className="absolute top-full left-0 mt-1 w-[90px] bg-white border border-[#DEDEDE] rounded-[8px] shadow-md z-10 overflow-hidden">
                {(['mau', 'wau', 'dau'] as Metric[]).map(m => (
                  <button key={m} type="button" onClick={() => { onMetricChange(m); setOpen(false) }}
                    className={`w-full text-center py-2 text-[14px] hover:bg-[#F3F3F3] transition ${metric === m ? 'text-[#005744] font-semibold' : 'text-[#202020]'}`}>
                    {METRIC_LABELS[m]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center h-[31px] px-3 rounded-[8px] bg-[#EAEAEA] text-[14px] font-medium text-[#202020] whitespace-nowrap">
            {getDateRange(metric)}
          </div>
        </div>

        {/* 숫자 + 배지 */}
        <div className="flex items-end justify-between flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-[45px] font-normal text-[#000000] leading-none">
              {loading ? '—' : count.toLocaleString()}
            </span>
            <span className="text-[25px] text-[#000000] ml-1">명</span>
          </div>
          {change !== 0 && (
            <span className={`text-[15px] font-semibold px-2 py-0.5 rounded-[4px] ${up ? 'bg-[#FFE2E2] text-[#FF5151]' : 'bg-[#D5DCFF] text-[#4656AA]'}`}>
              {up ? `+ ${change}` : `- ${Math.abs(change)}`}
            </span>
          )}
        </div>

        {/* 통계 상세 링크 */}
        <div className="flex justify-end mt-3">
          <button type="button" onClick={onDetail}
            className="text-[12px] font-medium text-[#727272] hover:text-[#005744]">통계 상세→</button>
        </div>
      </div>
    </div>
  )
}

/* ── 공지사항 서브섹션 ── */
function NoticeSection({ title, notices, loading, onNew, onSelect, onEdit }: {
  title: string; notices: NoticeItem[]; loading: boolean
  onNew: () => void; onSelect: (id: number) => void; onEdit: (id: number) => void
}) {
  return (
    <div>
      <div className="flex items-center justify-between px-6 py-3">
        <span className="text-[16px] font-medium text-[#202020]">{title}</span>
        <button type="button" onClick={onNew}
          className="text-[12px] text-[#202020] hover:text-[#005744]">[+새 공지작성]</button>
      </div>
      <div className="grid grid-cols-[60px_1fr_150px_55px] px-6 py-2 bg-[#EAEAEA] text-[13px] font-medium text-[#202020] text-center border-t border-[#DEDEDE]">
        <span>번호</span>
        <span className="text-left">제목</span>
        <span>등록일시(수정일시)</span>
        <span>수정</span>
      </div>
      {loading ? (
        <div className="py-5 text-center text-[12px] text-[#B5B5B5]">불러오는 중…</div>
      ) : notices.length === 0 ? (
        <div className="py-5 text-center text-[12px] text-[#B5B5B5]">공지사항이 없습니다.</div>
      ) : notices.map((n, i) => (
        <div key={n.idx}
          onClick={() => onSelect(n.idx)}
          className={`grid grid-cols-[60px_1fr_150px_55px] px-6 py-2.5 items-center text-[13px] text-center cursor-pointer hover:bg-[#F5F5F5] transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-[#EAEAEA]'}`}>
          <span className="text-[#202020]">{i + 1}</span>
          <span className="text-[#202020] text-left truncate pr-2">{n.title}</span>
          <span className="text-[#202020]">{n.created_at}</span>
          <button type="button" onClick={e => { e.stopPropagation(); onEdit(n.idx) }}
            className="text-[13px] text-[#202020] hover:text-[#005744] font-medium">수정</button>
        </div>
      ))}
    </div>
  )
}
