import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { api, type DashboardDto } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useRouter } from '../lib/router'

type Child = DashboardDto['children'][number]

function DeltaBadge({ delta }: { delta: number; label: string }) {
  if (delta > 0) return (
    <span className="inline-flex items-center justify-center px-2 h-[22px] rounded-[4px] text-[13px] font-semibold bg-[#FFE2E2] text-[#FF5151]">
      + {delta}
    </span>
  )
  if (delta < 0) return (
    <span className="inline-flex items-center justify-center px-2 h-[22px] rounded-[4px] text-[13px] font-semibold bg-[#D5DCFF] text-[#4656AA]">
      - {Math.abs(delta)}
    </span>
  )
  return (
    <span className="inline-flex items-center justify-center px-2 h-[22px] rounded-[4px] text-[13px] font-semibold bg-[#DEDEDE] text-[#555]">
      -
    </span>
  )
}

function StatCard({ label, value, unit, delta, deltaLabel }: {
  label: string
  value: number | string
  unit?: string
  delta?: number
  deltaLabel: string
}) {
  return (
    <div className="flex-1 min-w-0 border border-[#DEDEDE] rounded-[8px] bg-white px-6 pt-5 pb-5">
      <div className="inline-flex items-center justify-center h-[30px] px-4 rounded-[5px] bg-[#EAEAEA] text-[14px] font-medium text-[#202020] mb-4">
        {label}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-[40px] font-light leading-none text-[#202020]">{value}</span>
            {unit && <span className="text-[22px] font-light text-[#202020]">{unit}</span>}
          </div>
          {delta !== undefined && (
            <div className="flex items-center gap-2 mt-2">
              <DeltaBadge delta={delta} label={deltaLabel} />
              <span className="text-[10px] text-[#B3B3B3]">{deltaLabel}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct))
  return (
    <div className="flex items-center gap-2 justify-center">
      <div className="w-[100px] h-[10px] rounded-full bg-[#E8E8E8] overflow-hidden">
        <div
          className="h-full rounded-full bg-[#005744] transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-[13px] text-[#484848] w-[36px] text-right">{clamped}%</span>
    </div>
  )
}

function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center px-[5px] h-5 rounded-[5px] border border-[#FF5151] text-[#FF5151] text-[13px] font-medium whitespace-nowrap">
      {children}
    </span>
  )
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('.').map(Number)
  if (!y || !m) return null
  const diagMs = new Date(y, m - 1, d || 1).getTime()
  const todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime()
  return Math.floor((todayMs - diagMs) / 86400000)
}

function DiagnosisCell({ child, isClinical }: { child: Child; isClinical: boolean }) {
  const daysSinceDiag = daysSince(child.diagnosis_date)
  const needsRediag = isClinical && daysSinceDiag !== null && daysSinceDiag >= 14
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      <span className="text-[#484848]">{child.diagnosis_date ?? '-'}</span>
      {needsRediag && <StatusBadge>재진단 필요</StatusBadge>}
    </div>
  )
}

function CustomStatus({ child, customAcked }: { child: Child; customAcked: boolean }) {
  const days = child.days_since_trained
  const text = child.current_sound
    ? `${child.current_sound}${days != null ? ` (${days}일 경과)` : ''}`
    : null
  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      <span className="text-[#484848] text-[13px]">{text ?? '-'}</span>
      {child.needs_custom_change && !customAcked && <StatusBadge>커스텀 변경 필요</StatusBadge>}
    </div>
  )
}

function Remark({ child }: { child: Child }) {
  if (child.today_accuracy != null) return <span className="text-[#A9A9A9]">-</span>
  const d = child.days_since_trained
  if (d != null && d > 0) return <span className="text-[#484848]">{d}일 미훈련</span>
  return <span className="text-[#A9A9A9]">-</span>
}

export default function Dashboard() {
  const { go } = useRouter()
  const { user } = useAuth()
  const isClinical = user?.institutionCode === 'HBD' || user?.institutionCode === 'TEST'
  const [data, setData] = useState<DashboardDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const children = data?.children ?? []
  const stats = data?.stats

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8 space-y-6">

          {/* 통계 카드 4개 */}
          <div className="flex gap-4">
            {loading ? (
              [0,1,2,3].map(i => (
                <div key={i} className="flex-1 border border-[#DEDEDE] rounded-[8px] bg-white h-[140px] animate-pulse" />
              ))
            ) : (
              <>
                <StatCard
                  label="등록 아동"
                  value={stats?.total_children ?? 0}
                  unit="명"
                  delta={stats?.total_delta ?? 0}
                  deltaLabel="지난달 대비"
                />
                <StatCard
                  label="오늘 훈련 완료"
                  value={stats?.trained_today ?? 0}
                  unit="명"
                  delta={stats?.trained_today_delta ?? 0}
                  deltaLabel="오늘 대비"
                />
                <StatCard
                  label="평균 훈련 진행률"
                  value={stats?.avg_accuracy != null ? stats.avg_accuracy : '-'}
                  unit={stats?.avg_accuracy != null ? '%' : undefined}
                  deltaLabel="오늘 대비"
                />
                <StatCard
                  label="커스텀 미등록 아동"
                  value={stats?.no_custom ?? 0}
                  unit="명"
                  deltaLabel=""
                />
              </>
            )}
          </div>

          {/* 아동 목록 테이블 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] font-semibold text-[#202020]">
                아동 목록{' '}
                {!loading && <span className="text-[#005744]">{children.length}</span>}
              </h2>
              <button
                type="button"
                onClick={() => go({ name: 'list' })}
                className="text-[12px] text-[#868686] hover:text-[#005744] transition-colors"
              >
                전체보기 &gt;
              </button>
            </div>

            <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="bg-[#EAEAEA] border-b border-[#DEDEDE]">
                    <th className="h-[44px] w-[60px] text-center font-medium text-[#202020]">순번</th>
                    <th className="h-[44px] text-center font-medium text-[#202020]">이름(나이)</th>
                    <th className="h-[44px] text-center font-medium text-[#202020]">식별코드</th>
                    <th className="h-[44px] text-center font-medium text-[#202020]">생년월일</th>
                    <th className="h-[44px] text-center font-medium text-[#202020]">진단일시</th>
                    <th className="h-[44px] text-center font-medium text-[#202020]">오늘 훈련 진행률</th>
                    <th className="h-[44px] text-center font-medium text-[#202020]">커스텀 상태</th>
                    <th className="h-[44px] text-center font-medium text-[#202020]">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEDEDE]">
                  {loading && [0,1,2,3,4].map(i => (
                    <tr key={i}>
                      <td colSpan={8} className="py-3 px-4">
                        <div className="h-4 rounded animate-pulse bg-[#EAEAEA]" />
                      </td>
                    </tr>
                  ))}
                  {!loading && children.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-16 text-center text-[#919191]">
                        배정된 아동이 없습니다.
                      </td>
                    </tr>
                  )}
                  {!loading && children.map((c, i) => {
                    const _acked = localStorage.getItem(`hbd_custom_ack_${c.id}`)
                    const customAcked = (() => {
                      if (!_acked) return false
                      const [ackedDiag, ackedAccStr] = _acked.split('|')
                      const diagKey = c.diagnosis_date ?? String(c.id)
                      if (ackedDiag !== diagKey) return false   // 새 진단 → 다시 표시
                      const ackedAcc = ackedAccStr !== undefined && ackedAccStr !== '' ? Number(ackedAccStr) : null
                      if (ackedAcc === null) return true
                      return (c.latest_training_acc ?? 0) < ackedAcc + 5  // 5% 더 오르면 다시 표시
                    })()
                    return (
                    <tr
                      key={c.id}
                      className="h-[48px] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                      onClick={() => go({ name: 'detail', id: c.id })}
                    >
                      <td className="text-center text-[#585858]">{i + 1}</td>
                      <td className="text-center text-[#484848]">
                        {c.name}{c.age_label ? `(${c.age_label})` : ''}
                      </td>
                      <td className="text-center text-[#484848]">{c.identifier}</td>
                      <td className="text-center text-[#484848]">{c.birth_date ?? '-'}</td>
                      <td className="text-center"><DiagnosisCell child={c} isClinical={isClinical} /></td>
                      <td className="text-center">
                        <ProgressBar pct={c.today_accuracy ?? 0} />
                      </td>
                      <td className="text-center">
                        <CustomStatus child={c} customAcked={customAcked} />
                      </td>
                      <td className="text-center">
                        <Remark child={c} />
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      </div>
    </div>
  )
}
