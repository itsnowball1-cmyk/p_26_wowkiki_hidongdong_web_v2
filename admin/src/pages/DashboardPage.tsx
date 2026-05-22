import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

type Stats = {
  total_institutions: number
  total_web_users: number
  total_app_users: number
}

type Approval = {
  idx: number
  id: string
  name: string
  role: string
  instt_code: string
  regist_date: string
}

const HEADERS = { 'content-type': 'application/json', 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingApprovals, setLoadingApprovals] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', { headers: HEADERS })
      if (res.ok) setStats(await res.json() as Stats)
    } finally { setLoadingStats(false) }
  }

  const fetchApprovals = async () => {
    try {
      const res = await fetch('/api/admin/pending-approvals', { headers: HEADERS })
      if (res.ok) setApprovals(await res.json() as Approval[])
    } finally { setLoadingApprovals(false) }
  }

  useEffect(() => { fetchStats(); fetchApprovals() }, [])

  const handleApprove = async (idx: number, action: 'approve' | 'reject') => {
    setActionLoading(idx)
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ idx, action })
      })
      if (res.ok) {
        setApprovals(prev => prev.filter(a => a.idx !== idx))
      }
    } finally { setActionLoading(null) }
  }

  return (
    <Layout title="대시보드">
      {/* ── 통계 카드 3개 ── */}
      <div className="grid grid-cols-3 gap-5 mb-8">
        <StatCard
          label="전체 기관 수"
          value={loadingStats ? '—' : `${stats?.total_institutions.toLocaleString() ?? 0}`}
          unit="곳"
        />
        <StatCard
          label="전체 웹 유저"
          value={loadingStats ? '—' : `${stats?.total_web_users.toLocaleString() ?? 0}`}
          unit="명"
          badge={{ color: '#FFE2E2', text: '웹' }}
        />
        <StatCard
          label="전체 앱 아동 유저"
          value={loadingStats ? '—' : `${stats?.total_app_users.toLocaleString() ?? 0}`}
          unit="명"
          badge={{ color: '#D5DCFF', text: '앱' }}
        />
      </div>

      {/* ── 신규 기관 승인 ── */}
      <div className="bg-white rounded-[10px] border border-[#DEDEDE] overflow-hidden">
        {/* 섹션 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#DEDEDE]">
          <div className="flex items-center gap-3">
            <h2 className="text-[16px] font-bold text-[#202020]">신규 기관 승인</h2>
            {approvals.length > 0 && (
              <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-[#FF4646] text-white text-[12px] font-bold grid place-items-center">
                {approvals.length}
              </span>
            )}
          </div>
        </div>

        {/* 테이블 헤더 */}
        <div className="grid grid-cols-[60px_1fr_100px_120px_120px_160px] px-6 py-3 bg-[#FAFAFA] border-b border-[#DEDEDE] text-[13px] font-semibold text-[#727272]">
          <span>번호</span>
          <span>이름 / 아이디</span>
          <span>구분</span>
          <span>기관코드</span>
          <span>가입일시</span>
          <span className="text-center">승인/반려</span>
        </div>

        {/* 테이블 바디 */}
        {loadingApprovals ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
        ) : approvals.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">승인 대기 중인 계정이 없습니다.</div>
        ) : (
          approvals.map((a, i) => (
            <div
              key={a.idx}
              className={`grid grid-cols-[60px_1fr_100px_120px_120px_160px] px-6 py-4 items-center text-[14px] text-[#202020] ${
                i < approvals.length - 1 ? 'border-b border-[#DEDEDE]' : ''
              }`}
            >
              <span className="text-[#727272]">{i + 1}</span>
              <div>
                <p className="font-medium">{a.name}</p>
                <p className="text-[12px] text-[#B5B5B5]">{a.id}</p>
              </div>
              <span>
                <span className="px-2 py-0.5 rounded-full text-[12px] bg-[#EAEAEA] text-[#585858]">
                  {a.role}
                </span>
              </span>
              <span className="text-[#585858]">{a.instt_code}</span>
              <span className="text-[#727272]">{a.regist_date}</span>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handleApprove(a.idx, 'approve')}
                  disabled={actionLoading === a.idx}
                  className="w-[55px] h-[28px] rounded-[5px] bg-[#6EBE88] text-white text-[13px] font-medium hover:opacity-80 transition disabled:opacity-50"
                >
                  승인
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(a.idx, 'reject')}
                  disabled={actionLoading === a.idx}
                  className="w-[55px] h-[28px] rounded-[5px] bg-[#FF7979] text-white text-[13px] font-medium hover:opacity-80 transition disabled:opacity-50"
                >
                  반려
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  )
}

function StatCard({
  label, value, unit, badge
}: {
  label: string
  value: string
  unit: string
  badge?: { color: string; text: string }
}) {
  return (
    <div className="bg-[#EAEAEA] rounded-[10px] px-6 py-5 flex items-center justify-between">
      <div>
        <p className="text-[13px] text-[#727272] mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-[32px] font-bold text-[#202020]">{value}</span>
          <span className="text-[14px] text-[#727272]">{unit}</span>
        </div>
      </div>
      {badge && (
        <span
          className="px-3 py-1 rounded-full text-[13px] font-medium text-[#585858]"
          style={{ backgroundColor: badge.color }}
        >
          {badge.text}
        </span>
      )}
    </div>
  )
}
