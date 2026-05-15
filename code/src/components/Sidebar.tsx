import { useState } from 'react'
import BrandLogo from './BrandLogo'
import { useRouter } from '../lib/router'

type MenuKey = 'children' | 'schedule' | 'custom' | 'mypage'

const items: { key: MenuKey; label: string }[] = [
  { key: 'children', label: '아동관리' },
  { key: 'schedule', label: '전체 내진 일정' },
  { key: 'custom', label: '아동별 커스텀' },
  { key: 'mypage', label: '마이페이지' },
]

const inquiryItems = ['공지사항', 'FAQ', '1:1 문의하기']

export default function Sidebar() {
  const { route, go } = useRouter()
  const [inquiryOpen, setInquiryOpen] = useState(false)

  const active: MenuKey =
    route.name === 'schedule-list' || route.name === 'schedule-new'
      ? 'schedule'
      : route.name === 'custom-list' || route.name === 'custom-detail'
      ? 'custom'
      : route.name === 'mypage'
      ? 'mypage'
      : 'children'

  const handleClick = (key: MenuKey) => {
    if (key === 'schedule' && route.name !== 'schedule-list') go({ name: 'schedule-list' })
    if (key === 'children' && route.name !== 'list') go({ name: 'list' })
    if (key === 'custom' && route.name !== 'custom-list') go({ name: 'custom-list' })
    if (key === 'mypage' && route.name !== 'mypage') go({ name: 'mypage' })
  }

  return (
    <aside className="hidden md:flex md:w-[240px] lg:w-[240px] shrink-0 flex-col bg-surface-card shadow-sidebar">
      <div className="h-[64px] flex items-center px-5">
        <BrandLogo size="sm" />
      </div>

      <nav className="mt-2 px-[5px]">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = item.key === active
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => handleClick(item.key)}
                  className={`group w-full h-[44px] flex items-center px-[13px] gap-3 rounded-[5px] text-left transition-colors ${
                    isActive
                      ? 'bg-surface-active text-ink-850'
                      : 'text-ink-300 hover:text-ink-700 hover:bg-surface-active/60'
                  }`}
                >
                  <span
                    className={`inline-block w-5 h-5 rounded-[3px] ${
                      isActive ? 'bg-brand' : 'bg-[#B4B4B4] group-hover:bg-brand'
                    }`}
                    aria-hidden
                  />
                  <span className="text-[15px] font-medium">{item.label}</span>
                </button>
              </li>
            )
          })}

          {/* 문의하기 */}
          <li>
            <button
              type="button"
              onClick={() => setInquiryOpen(o => !o)}
              className="group w-full h-[44px] flex items-center px-[13px] gap-3 rounded-[5px] text-left transition-colors text-ink-300 hover:text-ink-700 hover:bg-surface-active/60"
            >
              <span className="inline-block w-5 h-5 rounded-[3px] bg-[#B4B4B4] group-hover:bg-brand" aria-hidden />
              <span className="text-[15px] font-medium flex-1">문의하기</span>
              <svg
                width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
                className={`transition-transform ${inquiryOpen ? 'rotate-180' : ''}`}
              >
                <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {inquiryOpen && (
              <ul className="mt-1 space-y-0.5 pl-[13px]">
                {inquiryItems.map((label) => (
                  <li key={label}>
                    <button
                      type="button"
                      disabled
                      className="w-full h-[40px] flex items-center gap-3 px-[13px] rounded-[5px] text-left text-ink-300 cursor-not-allowed"
                    >
                      <span className="inline-block w-5 h-5 rounded-[3px] bg-[#B4B4B4]" aria-hidden />
                      <span className="text-[15px] font-medium">{label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        </ul>
      </nav>
    </aside>
  )
}
