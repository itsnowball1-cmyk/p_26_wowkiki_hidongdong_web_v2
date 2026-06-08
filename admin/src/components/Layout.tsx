import { type ReactNode, useState, useEffect, useCallback } from 'react'
import { useRouter, type RouteName } from '../lib/router'
import { useAuth } from '../lib/auth'
import {
  IconDashboard, IconMembers, IconChild,
  IconMyPage, IconInquiry, IconNotice, IconFAQ, IconChat,
  IconStats, IconSecurity, IconContent, IconVersion, IconBuilding,
  IconPush, IconIAdmin, IconDoctor, IconTherapist,
} from './SidebarIcons'
import type { SVGProps } from 'react'

type IconComp = (p: SVGProps<SVGSVGElement>) => JSX.Element

type SubItem = { label: string; route?: RouteName; badgeKey?: string; icon?: IconComp }
type MenuItem =
  | { type: 'link';  label: string; route: RouteName; icon?: IconComp }
  | { type: 'group'; label: string; firstRoute?: RouteName; children: SubItem[]; icon?: IconComp }

const MENU: MenuItem[] = [
  { type: 'link',  label: '대시보드', route: 'dashboard', icon: IconDashboard },
  {
    type: 'group', label: '회원 관리', firstRoute: 'institutions', icon: IconMembers,
    children: [
      { label: '기관',        route: 'institutions',      badgeKey: 'institutions', icon: IconBuilding },
      { label: '기관 관리자', route: 'institution-admins', icon: IconIAdmin },
      { label: '의사',        route: 'doctors',            icon: IconDoctor },
      { label: '치료사',      route: 'therapists',        badgeKey: 'therapists',   icon: IconTherapist },
      { label: '아동',        route: 'children',           icon: IconChild },
    ],
  },
  { type: 'link',  label: '통계/로그', route: 'stats', icon: IconStats },
  {
    type: 'group', label: '고객센터', firstRoute: 'notices', icon: IconInquiry,
    children: [
      { label: '공지사항',    route: 'notices',       icon: IconNotice },
      { label: 'FAQ',         route: 'faq',           icon: IconFAQ },
      { label: '1:1 문의사항', route: 'cs',           icon: IconChat },
      { label: '앱 푸시',                             icon: IconPush },
      { label: '문자 설정',   route: 'sms-settings',  icon: IconInquiry },
    ],
  },
  {
    type: 'group', label: '보안', firstRoute: 'security-iadmin', icon: IconSecurity,
    children: [
      { label: '아동',       route: 'security-child',     icon: IconChild },
      { label: '기관 관리자', route: 'security-iadmin',   icon: IconIAdmin },
      { label: '의사',       route: 'security-doctor',    icon: IconDoctor },
      { label: '치료사',     route: 'security-therapist', icon: IconTherapist },
    ],
  },
  { type: 'link',  label: '콘텐츠',   route: 'content',  icon: IconContent },
  { type: 'link',  label: '버전관리', route: 'versions',  icon: IconVersion },
  { type: 'link',  label: '마이페이지', route: 'mypage',  icon: IconMyPage },
]


type BadgeCounts = { institutions: number; therapists: number }

function groupContains(group: Extract<MenuItem, { type: 'group' }>, routeName: string) {
  return group.children.some(c => c.route === routeName)
}

function SidebarIcon({ icon: Icon, active }: { icon?: IconComp; active: boolean }) {
  const cls = `flex-shrink-0 w-5 h-5 ${active ? 'text-[#005744]' : 'text-[#B5B5B5]'}`
  if (!Icon) return <span className={`w-[20px] h-[20px] rounded-[3px] ${active ? 'bg-[#005744]' : 'bg-[#B5B5B5]'} flex-shrink-0`} />
  return <Icon className={cls} />
}

export default function Layout({ children, title }: { children: ReactNode; title?: string }) {
  const { route, go } = useRouter()
  const { user, logout } = useAuth()
  const activeRoute = route.name

  const [badges, setBadges] = useState<BadgeCounts>({ institutions: 0, therapists: 0 })

  const fetchBadges = useCallback(() => {
    const userId = localStorage.getItem('hbd_user_id') ?? ''
    if (!userId) return
    fetch('/api/admin/badge-counts', {
      headers: { 'content-type': 'application/json', 'x-user-id': userId }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setBadges(d as BadgeCounts) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchBadges()
    const timer = setInterval(fetchBadges, 60_000)
    return () => clearInterval(timer)
  }, [fetchBadges])

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    MENU.forEach(item => {
      if (item.type === 'group' && groupContains(item, activeRoute)) {
        initial.add(item.label)
      }
    })
    return initial
  })

  useEffect(() => {
    MENU.forEach(item => {
      if (item.type === 'group' && groupContains(item, activeRoute)) {
        setOpenGroups(prev => new Set([...prev, item.label]))
      }
    })
  }, [activeRoute])

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(label)) next.delete(label)
      else next.add(label)
      return next
    })
  }

  const navTo = (r: RouteName) => go({ name: r } as Parameters<typeof go>[0])

  return (
    <div className="flex h-screen bg-[#FAFAFA] overflow-hidden">
      {/* ── 사이드바 ── */}
      <aside className="w-[240px] flex-shrink-0 bg-white flex flex-col" style={{ boxShadow: '0px 0px 5px 0px rgba(0,0,0,0.25)' }}>
        {/* 로고 */}
        <div className="h-[64px] flex items-center px-5 border-b border-[#DEDEDE]">
          <span className="text-[20px] font-extrabold" style={{ color: '#7CBE26' }}>하이동동</span>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {MENU.map(item => {
            if (item.type === 'link') {
              const active = activeRoute === item.route
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => navTo(item.route)}
                  className={`w-full h-[48px] flex items-center gap-[14px] pl-[18px] pr-3 text-[15px] font-medium transition-colors ${
                    active ? 'bg-[#F3F3F3] text-[#000000]' : 'text-[#B5B5B5] hover:bg-[#F9F9F9] hover:text-[#555]'
                  }`}
                >
                  <SidebarIcon icon={item.icon} active={active} />
                  <span className="flex-1 text-left">{item.label}</span>
                </button>
              )
            }

            /* ── 그룹 ── */
            const isOpen = openGroups.has(item.label)
            const childActive = groupContains(item, activeRoute)

            return (
              <div key={item.label}>
                {/* 그룹 헤더 */}
                <div className={`w-full h-[48px] flex items-center gap-[14px] pl-[18px] pr-3 text-[15px] font-medium transition-colors ${
                  childActive ? 'text-[#000000]' : 'text-[#B5B5B5]'
                }`}>
                  <SidebarIcon icon={item.icon} active={childActive} />
                  {/* 그룹명 클릭 → 첫 자식으로 이동 */}
                  <button
                    type="button"
                    onClick={() => item.firstRoute && navTo(item.firstRoute)}
                    className="flex-1 text-left hover:text-[#555] transition-colors"
                  >
                    {item.label}
                  </button>
                  {/* 화살표 클릭 → 드롭다운만 토글 */}
                  <button
                    type="button"
                    onClick={() => toggleGroup(item.label)}
                    className="p-1 hover:text-[#555] transition-colors"
                    aria-label={isOpen ? '닫기' : '열기'}
                  >
                    <svg
                      width="12" height="8" viewBox="0 0 12 8" fill="none"
                      className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                    >
                      <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                {/* 자식 항목 */}
                {isOpen && item.children.map(child => {
                  const active = !!child.route && activeRoute === child.route
                  const clickable = !!child.route
                  const badgeCount = child.badgeKey ? badges[child.badgeKey as keyof BadgeCounts] : 0
                  if (active) {
                    return (
                      <div key={child.label} className="px-[5px] py-[5px]">
                        <button
                          type="button"
                          onClick={() => child.route && navTo(child.route)}
                          className="w-full h-[38px] flex items-center gap-[14px] pl-[26px] bg-[#F1F1F1] rounded-[5px]"
                        >
                          <SidebarIcon icon={child.icon} active={true} />
                          <span className="flex-1 text-left text-[15px] font-medium text-[#343A40]">{child.label}</span>
                          {badgeCount > 0 && (
                            <span className="mr-2 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF4646] text-white text-[11px] font-bold flex items-center justify-center">
                              {badgeCount}
                            </span>
                          )}
                        </button>
                      </div>
                    )
                  }
                  return (
                    <button
                      key={child.label}
                      type="button"
                      onClick={() => clickable && navTo(child.route!)}
                      className={`w-full h-[48px] flex items-center gap-[14px] pl-9 text-[15px] font-medium text-[#B5B5B5] transition-colors ${
                        clickable ? 'hover:bg-[#F9F9F9] hover:text-[#555]' : 'cursor-default'
                      }`}
                    >
                      <SidebarIcon icon={child.icon} active={false} />
                      <span className="flex-1 text-left">{child.label}</span>
                      {badgeCount > 0 && (
                        <span className="mr-3 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF4646] text-white text-[11px] font-bold flex items-center justify-center">
                          {badgeCount}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </nav>
      </aside>

      {/* ── 오른쪽 전체 ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <header className="h-[64px] bg-white border-b border-[#DEDEDE] flex items-center justify-between px-8 flex-shrink-0">
          <span className="text-[15px] font-semibold text-[#202020]">{title ?? '대시보드'}</span>
          <div className="flex items-center gap-4">
            <span className="text-[14px] text-[#727272]">{user?.name} 님</span>
            <span className="text-[13px] text-[#727272]">와우키키 admin</span>
            <button
              type="button"
              onClick={logout}
              className="h-[36px] px-4 rounded-[5px] border border-[#005744] text-[14px] font-medium text-[#005744] hover:bg-[#005744] hover:text-white transition-colors"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
