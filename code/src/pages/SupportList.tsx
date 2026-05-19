import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api, type SupportListItem } from '../lib/api'

const DATE_TABS = ['1주일', '1개월', '3개월', '기간선택'] as const
type DateTab = typeof DATE_TABS[number]

const INQUIRY_TYPE_LABEL: Record<string, string> = {
  '01': '아동관리',
  '02': '전체 내진 일정',
  '03': '아동별 커스텀',
  '04': '마이페이지',
  '05': '기타',
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getDateRange(tab: DateTab, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date()
  const todayStr = toDateStr(today)
  if (tab === '1주일') {
    const from = new Date(today); from.setDate(from.getDate() - 7)
    return { from: toDateStr(from), to: todayStr }
  }
  if (tab === '3개월') {
    const from = new Date(today); from.setMonth(from.getMonth() - 3)
    return { from: toDateStr(from), to: todayStr }
  }
  if (tab === '기간선택') {
    return { from: customFrom || todayStr, to: customTo || todayStr }
  }
  // 1개월 (default)
  const from = new Date(today); from.setMonth(from.getMonth() - 1)
  return { from: toDateStr(from), to: todayStr }
}

export default function SupportList() {
  const { go } = useRouter()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<DateTab>('1개월')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [items, setItems] = useState<SupportListItem[]>([])
  const [loading, setLoading] = useState(true)

  const { from, to } = getDateRange(activeTab, customFrom, customTo)

  useEffect(() => {
    if (activeTab === '기간선택' && (!customFrom || !customTo)) {
      setLoading(false)
      setItems([])
      return
    }
    let ignore = false
    setLoading(true)
    api.supportList(from, to)
      .then(data => { if (!ignore) setItems(data.items) })
      .catch(() => {})
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [from, to])

  return (
    <div className="min-h-screen flex bg-surface">
      {user?.role === 'admin' ? <AdminSidebar /> : <Sidebar />}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-[22px] font-bold">1:1 문의하기</h1>
            <button
              type="button"
              onClick={() => go({ name: 'support-new' })}
              className="h-10 px-5 bg-brand text-white text-[14px] font-medium rounded-[5px] hover:bg-brand/90 transition-colors"
            >
              1:1 문의하기
            </button>
          </div>

          {/* 날짜 필터 탭 */}
          <div className="flex items-center gap-1 mb-4 flex-wrap">
            {DATE_TABS.map(tab => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`h-9 px-4 text-[13px] font-medium rounded-[5px] transition-colors ${
                  activeTab === tab
                    ? 'bg-brand text-white'
                    : 'border border-line text-ink-500 hover:bg-surface-active'
                }`}
              >
                {tab}
              </button>
            ))}
            {activeTab === '기간선택' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="h-9 px-3 border border-line rounded-[5px] text-[13px] focus:outline-none focus:border-brand"
                />
                <span className="text-ink-400 text-[13px]">~</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  className="h-9 px-3 border border-line rounded-[5px] text-[13px] focus:outline-none focus:border-brand"
                />
              </div>
            )}
          </div>

          {/* 테이블 */}
          <div className="border border-line rounded-[5px] overflow-hidden bg-white">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="bg-surface border-b border-line">
                  <th className="py-3 px-4 text-left font-medium text-ink-700 w-16">No.</th>
                  <th className="py-3 px-4 text-left font-medium text-ink-700 w-32">문의날짜</th>
                  <th className="py-3 px-4 text-left font-medium text-ink-700 w-36">문의유형</th>
                  <th className="py-3 px-4 text-left font-medium text-ink-700">제목</th>
                  <th className="py-3 px-4 text-center font-medium text-ink-700 w-28">답변완료</th>
                  <th className="py-3 px-4 text-left font-medium text-ink-700 w-32">답변날짜</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading && Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="py-4 px-4">
                      <div className="h-4 rounded animate-pulse bg-line w-full" />
                    </td>
                  </tr>
                ))}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-ink-400">
                      등록된 문의가 없습니다.
                    </td>
                  </tr>
                )}
                {!loading && items.map((item, i) => (
                  <tr
                    key={item.cs_idx}
                    onClick={() => go({ name: 'support-detail', id: item.cs_idx })}
                    className="hover:bg-surface-active cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 text-ink-700">{items.length - i}</td>
                    <td className="py-3 px-4 text-ink-700">{item.regist_date}</td>
                    <td className="py-3 px-4 text-ink-700">{INQUIRY_TYPE_LABEL[item.s_type] ?? item.s_type}</td>
                    <td className="py-3 px-4 text-ink-700">{item.s_title}</td>
                    <td className="py-3 px-4 text-center">
                      {item.reply_yn === 'Y' ? (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-green-50 text-green-600">답변완료</span>
                      ) : (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[12px] font-medium bg-red-50 text-red-500">답변대기</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-ink-700">{item.reply_date ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>
      </div>
    </div>
  )
}
