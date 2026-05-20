import { useState } from 'react'
import BrandLogo from './BrandLogo'
import { useRouter } from '../lib/router'

export default function AdminSidebar() {
  const { route, go } = useRouter()

  const isOnDashboard = route.name === 'admin-dashboard'
  const isOnChildren =
    route.name === 'admin-children' || route.name === 'admin-child-detail' ||
    route.name === 'admin-child-history' || route.name === 'admin-child-history-detail' ||
    route.name === 'admin-deleted-children'
  const isOnMembers = route.name === 'admin-members' || route.name === 'admin-member-detail' || route.name === 'admin-member-deleted'
  const isOnSchedule = route.name === 'schedule-list' || route.name === 'schedule-new'
  const isOnMyPage   = route.name === 'mypage'
  const isOnNotice   = route.name === 'notice-list' || route.name === 'notice-detail'
  const isOnFaq      = route.name === 'faq-list'    || route.name === 'faq-detail'
  const isOnSupport  = route.name === 'support-list' || route.name === 'support-new' || route.name === 'support-detail'

  const [childrenOpen, setChildrenOpen] = useState(isOnChildren)
  const [membersOpen, setMembersOpen] = useState(isOnMembers)
  const [inquiryOpen, setInquiryOpen] = useState(isOnNotice || isOnFaq || isOnSupport)

  const NavBtn = ({
    active, onClick, children,
  }: { active?: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full h-[48px] flex items-center px-[18px] gap-[14px] text-left transition-colors ${
        active ? 'text-[#005744]' : 'text-[#B5B5B5] hover:text-ink-700'
      }`}
    >
      <span className={`inline-block w-5 h-5 rounded-[3px] shrink-0 ${active ? 'bg-[#005744]' : 'bg-[#B5B5B5] group-hover:bg-[#005744]/60'}`} aria-hidden />
      {children}
    </button>
  )

  const SubBtn = ({
    active, onClick, label,
  }: { active: boolean; onClick: () => void; label: string }) => (
    <button
      type="button"
      onClick={onClick}
      className={`w-full h-[48px] flex items-center gap-[14px] pl-[36px] pr-[18px] text-left transition-colors ${
        active ? 'text-black' : 'text-[#B5B5B5] hover:text-ink-700'
      }`}
    >
      <span className={`inline-block w-5 h-5 rounded-[3px] ${active ? 'bg-[#B4B4B4]' : 'bg-[#B5B5B5]'}`} aria-hidden />
      <span className="text-[15px] font-medium">{label}</span>
    </button>
  )

  const ChevronIcon = ({ open }: { open: boolean }) => (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"
      className={`transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}>
      <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )

  return (
    <aside className="hidden md:flex md:w-[240px] lg:w-[240px] shrink-0 flex-col bg-surface-card shadow-sidebar sticky top-0 h-screen overflow-y-auto">
      <div className="h-[64px] flex items-center px-5">
        <BrandLogo size="sm" />
      </div>

      <nav className="mt-2 px-[5px]">
        <ul className="space-y-1">
          {/* 대시보드 */}
          <li>
            <NavBtn active={isOnDashboard} onClick={() => go({ name: 'admin-dashboard' })}>
              <span className="text-[15px] font-medium">대시보드</span>
            </NavBtn>
          </li>

          {/* 아동관리 */}
          <li>
            <button
              type="button"
              onClick={() => setChildrenOpen(o => !o)}
              className={`group w-full h-[48px] flex items-center px-[18px] gap-[14px] text-left transition-colors ${
                isOnChildren ? 'text-[#005744]' : 'text-[#B5B5B5] hover:text-ink-700'
              }`}
            >
              <span className={`inline-block w-5 h-5 rounded-[3px] shrink-0 ${isOnChildren ? 'bg-[#005744]' : 'bg-[#B5B5B5] group-hover:bg-[#005744]/60'}`} aria-hidden />
              <span className="text-[15px] font-medium flex-1">아동관리</span>
              <ChevronIcon open={childrenOpen || isOnChildren} />
            </button>
            {(childrenOpen || isOnChildren) && (
              <ul className="mt-1 space-y-0.5 pl-[13px]">
                <li><SubBtn active={route.name === 'admin-children' || route.name === 'admin-child-detail'} onClick={() => go({ name: 'admin-children' })} label="아동 정보" /></li>
                <li><SubBtn active={route.name === 'admin-child-history' || route.name === 'admin-child-history-detail'} onClick={() => go({ name: 'admin-child-history' })} label="아동 이력 조회/다운" /></li>
                <li><SubBtn active={route.name === 'admin-deleted-children'} onClick={() => go({ name: 'admin-deleted-children' })} label="아동 삭제 이력" /></li>
              </ul>
            )}
          </li>

          {/* 회원관리 */}
          <li>
            <button
              type="button"
              onClick={() => setMembersOpen(o => !o)}
              className={`group w-full h-[48px] flex items-center px-[18px] gap-[14px] text-left transition-colors ${
                isOnMembers ? 'text-[#005744]' : 'text-[#B5B5B5] hover:text-ink-700'
              }`}
            >
              <span className={`inline-block w-5 h-5 rounded-[3px] shrink-0 ${isOnMembers ? 'bg-[#005744]' : 'bg-[#B5B5B5] group-hover:bg-[#005744]/60'}`} aria-hidden />
              <span className="text-[15px] font-medium flex-1">회원관리</span>
              <ChevronIcon open={membersOpen || isOnMembers} />
            </button>
            {(membersOpen || isOnMembers) && (
              <ul className="mt-1 space-y-0.5 pl-[13px]">
                <li><SubBtn active={route.name === 'admin-members' || route.name === 'admin-member-detail'} onClick={() => go({ name: 'admin-members' })} label="의사/치료사 목록" /></li>
                <li><SubBtn active={route.name === 'admin-member-deleted'} onClick={() => go({ name: 'admin-member-deleted' })} label="삭제 목록" /></li>
              </ul>
            )}
          </li>

          {/* 일정관리 */}
          <li>
            <NavBtn active={isOnSchedule} onClick={() => go({ name: 'schedule-list' })}>
              <span className="text-[15px] font-medium">일정관리</span>
            </NavBtn>
          </li>

          {/* 마이페이지 */}
          <li>
            <NavBtn active={isOnMyPage} onClick={() => go({ name: 'mypage' })}>
              <span className="text-[15px] font-medium">마이페이지</span>
            </NavBtn>
          </li>

          {/* 문의하기 */}
          <li>
            <button
              type="button"
              onClick={() => setInquiryOpen(o => !o)}
              className={`group w-full h-[48px] flex items-center px-[18px] gap-[14px] text-left transition-colors ${
                isOnNotice || isOnFaq || isOnSupport ? 'text-[#005744]' : 'text-[#B5B5B5] hover:text-ink-700'
              }`}
            >
              <span className={`inline-block w-5 h-5 rounded-[3px] shrink-0 ${isOnNotice || isOnFaq || isOnSupport ? 'bg-[#005744]' : 'bg-[#B5B5B5] group-hover:bg-[#005744]/60'}`} aria-hidden />
              <span className="text-[15px] font-medium flex-1">문의하기</span>
              <ChevronIcon open={inquiryOpen || isOnNotice || isOnFaq || isOnSupport} />
            </button>
            {(inquiryOpen || isOnNotice || isOnFaq || isOnSupport) && (
              <ul className="mt-1 space-y-0.5 pl-[13px]">
                <li><SubBtn active={isOnNotice} onClick={() => go({ name: 'notice-list' })} label="공지사항" /></li>
                <li><SubBtn active={isOnFaq} onClick={() => go({ name: 'faq-list' })} label="FAQ" /></li>
                <li><SubBtn active={isOnSupport} onClick={() => go({ name: 'support-list' })} label="1:1 문의하기" /></li>
              </ul>
            )}
          </li>
        </ul>
      </nav>
    </aside>
  )
}
