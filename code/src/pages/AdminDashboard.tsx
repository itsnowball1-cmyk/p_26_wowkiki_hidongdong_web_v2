import { useEffect, useState } from 'react'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { api, type AdminDashboardDto } from '../lib/api'
import { useRouter } from '../lib/router'

type Stat = { total: number; delta: number; new_count: number }

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) return (
    <span className="inline-flex items-center justify-center px-3 h-[21px] rounded-[4px] text-[13px] font-semibold bg-[#FFE2E2] text-[#FF5151]">
      + {delta}
    </span>
  )
  if (delta < 0) return (
    <span className="inline-flex items-center justify-center px-3 h-[21px] rounded-[4px] text-[13px] font-semibold bg-[#D5DCFF] text-[#4656AA]">
      - {Math.abs(delta)}
    </span>
  )
  return (
    <span className="inline-flex items-center justify-center px-3 h-[21px] rounded-[4px] text-[13px] font-semibold bg-[#BEBEBE] text-[#3F3F3F]">
      -
    </span>
  )
}

function StatCard({ label, stat }: { label: string; stat: Stat }) {
  return (
    <div className="flex-1 min-w-0 border border-[#DEDEDE] rounded-[5px] bg-white px-6 pt-5 pb-5">
      <div className="inline-flex items-center justify-center h-[33px] px-4 rounded-[8px] bg-[#EAEAEA] text-[15px] font-medium text-black tracking-[-0.03em] mb-4">
        {label}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-[45px] font-normal leading-none text-black tracking-[-0.05em]">{stat.total}</span>
            <span className="text-[25px] font-normal text-black">명</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-[10px] font-medium text-[#B3B3B3]">지난달 대비</span>
            <DeltaBadge delta={stat.delta} />
          </div>
        </div>
      </div>
    </div>
  )
}

function NewMemberTable({
  title,
  newCount,
  onViewAll,
  children,
}: {
  title: string
  newCount: number
  onViewAll: () => void
  children: React.ReactNode
}) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[15px] font-medium text-[#202020]">
          {title}{' '}
          <span className="text-[#005744] font-medium">{newCount}명</span>
        </span>
        <button type="button" onClick={onViewAll} className="text-[12px] font-medium text-[#868686] hover:text-[#005744] transition-colors">
          전체보기 &gt;
        </button>
      </div>
      <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden bg-white">
        {children}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { go } = useRouter()
  const [data, setData] = useState<AdminDashboardDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.adminDashboard()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const skeleton = (
    <tr><td colSpan={4} className="py-3 px-4"><div className="h-4 rounded animate-pulse bg-[#EAEAEA]" /></td></tr>
  )

  return (
    <div className="min-h-screen flex bg-[#FAFAFA]">
      <AdminSidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8 space-y-6">

          {/* 통계 카드 */}
          <div className="flex gap-5">
            {loading ? (
              <>
                {[0, 1, 2].map(i => (
                  <div key={i} className="flex-1 border border-[#DEDEDE] rounded-[5px] bg-white h-[155px] animate-pulse" />
                ))}
              </>
            ) : data ? (
              <>
                <StatCard label="등록 의사"   stat={data.stats.doctors} />
                <StatCard label="등록 치료사" stat={data.stats.therapists} />
                <StatCard label="등록 아동"   stat={data.stats.children} />
              </>
            ) : null}
          </div>

          {/* 신규 등록 테이블 3개 */}
          <div className="flex gap-5 items-start">

            {/* 신규 등록 의사 */}
            <NewMemberTable
              title="신규 등록 의사"
              newCount={data?.stats.doctors.new_count ?? 0}
              onViewAll={() => go({ name: 'admin-members' })}
            >
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="bg-[#EAEAEA] border-b border-[#DEDEDE]">
                    <th className="h-[42px] text-center font-medium text-[#202020]">가입일시</th>
                    <th className="h-[42px] text-center font-medium text-[#202020]">소속과</th>
                    <th className="h-[42px] text-center font-medium text-[#202020]">이름</th>
                    <th className="h-[42px] text-center font-medium text-[#202020]">식별코드</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEDEDE]">
                  {loading && [0,1,2,3,4].map(i => <tr key={i}>{skeleton}</tr>)}
                  {!loading && (!data?.new_doctors.length) && (
                    <tr><td colSpan={4} className="py-8 text-center text-[#919191] text-[13px]">등록된 의사가 없습니다.</td></tr>
                  )}
                  {!loading && data?.new_doctors.map(m => (
                    <tr
                      key={m.id}
                      className="h-[42px] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                      onClick={() => go({ name: 'admin-member-detail', id: m.id })}
                    >
                      <td className="text-center text-[#202020]">{m.regist_date ?? '-'}</td>
                      <td className="text-center text-[#202020]">{m.depart_code ?? '-'}</td>
                      <td className="text-center text-[#202020]">{m.name}</td>
                      <td className="text-center text-[#202020]">{m.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </NewMemberTable>

            {/* 신규 등록 치료사 */}
            <NewMemberTable
              title="신규 등록 치료사"
              newCount={data?.stats.therapists.new_count ?? 0}
              onViewAll={() => go({ name: 'admin-members' })}
            >
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="bg-[#EAEAEA] border-b border-[#DEDEDE]">
                    <th className="h-[42px] text-center font-medium text-[#202020]">가입일시</th>
                    <th className="h-[42px] text-center font-medium text-[#202020]">소속과</th>
                    <th className="h-[42px] text-center font-medium text-[#202020]">이름</th>
                    <th className="h-[42px] text-center font-medium text-[#202020]">식별코드</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEDEDE]">
                  {loading && [0,1,2,3,4].map(i => <tr key={i}>{skeleton}</tr>)}
                  {!loading && (!data?.new_therapists.length) && (
                    <tr><td colSpan={4} className="py-8 text-center text-[#919191] text-[13px]">등록된 치료사가 없습니다.</td></tr>
                  )}
                  {!loading && data?.new_therapists.map(m => (
                    <tr
                      key={m.id}
                      className="h-[42px] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                      onClick={() => go({ name: 'admin-member-detail', id: m.id })}
                    >
                      <td className="text-center text-[#202020]">{m.regist_date ?? '-'}</td>
                      <td className="text-center text-[#202020]">{m.depart_code ?? '-'}</td>
                      <td className="text-center text-[#202020]">{m.name}</td>
                      <td className="text-center text-[#202020]">{m.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </NewMemberTable>

            {/* 신규 등록 아동 */}
            <NewMemberTable
              title="신규 등록 아동"
              newCount={data?.stats.children.new_count ?? 0}
              onViewAll={() => go({ name: 'admin-children' })}
            >
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="bg-[#EAEAEA] border-b border-[#DEDEDE]">
                    <th className="h-[42px] text-center font-medium text-[#202020]">가입일시</th>
                    <th className="h-[42px] text-center font-medium text-[#202020]">이름(식별코드)</th>
                    <th className="h-[42px] text-center font-medium text-[#202020]">배정 여부</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DEDEDE]">
                  {loading && [0,1,2,3,4].map(i => (
                    <tr key={i}><td colSpan={3} className="py-3 px-4"><div className="h-4 rounded animate-pulse bg-[#EAEAEA]" /></td></tr>
                  ))}
                  {!loading && (!data?.new_children.length) && (
                    <tr><td colSpan={3} className="py-8 text-center text-[#919191] text-[13px]">등록된 아동이 없습니다.</td></tr>
                  )}
                  {!loading && data?.new_children.map(c => (
                    <tr
                      key={c.id}
                      className="h-[42px] hover:bg-[#FAFAFA] cursor-pointer transition-colors"
                      onClick={() => go({ name: 'admin-child-detail', id: c.id })}
                    >
                      <td className="text-center text-[#202020]">{c.regist_date ?? '-'}</td>
                      <td className="text-center text-[#202020]">{c.name}({c.identifier})</td>
                      <td className="text-center">
                        {c.has_doctor
                          ? <span className="text-[#202020]">배정 완료</span>
                          : <span className="text-[#FF5151] font-medium">배정 필요</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </NewMemberTable>

          </div>
        </main>
      </div>
    </div>
  )
}
