import { type ReactNode, useState, useEffect, useCallback } from 'react'
import { useRouter, type RouteName } from '../lib/router'
import { useAuth } from '../lib/auth'

type SubItem = { label: string; route?: RouteName; badgeKey?: string }
type MenuItem =
  | { type: 'link';  label: string; route: RouteName }
  | { type: 'group'; label: string; firstRoute?: RouteName; children: SubItem[] }

const MENU: MenuItem[] = [
  { type: 'link',  label: '대시보드', route: 'dashboard' },
  {
    type: 'group', label: '회원 관리', firstRoute: 'institutions',
    children: [
      { label: '기관',        route: 'institutions',      badgeKey: 'institutions' },
      { label: '기관 관리자', route: 'institution-admins' },
      { label: '의사',        route: 'doctors' },
      { label: '치료사',      route: 'therapists',        badgeKey: 'therapists' },
      { label: '아동',        route: 'children' },
    ],
  },
  { type: 'link',  label: '통계/로그', route: 'stats' },
  {
    type: 'group', label: '고객센터', firstRoute: 'notices',
    children: [
      { label: '공지사항',    route: 'notices' },
      { label: 'FAQ',         route: 'faq' },
      { label: '1:1 문의사항', route: 'cs' },
      { label: '앱 푸시' },
      { label: '문자 설정',   route: 'sms-settings' },
    ],
  },
  { type: 'link',  label: '보안',     route: 'security' },
  { type: 'link',  label: '콘텐츠',   route: 'content' },
  { type: 'link',  label: '버전관리', route: 'versions' },
  { type: 'link',  label: '마이페이지', route: 'mypage' },
]

type BadgeCounts = { institutions: number; therapists: number }

function groupContains(group: Extract<MenuItem, { type: 'group' }>, routeName: string) {
  return group.children.some(c => c.route === routeName)
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

  // 열린 그룹 상태 — 현재 라우트가 속한 그룹은 초기에 열려 있음
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    MENU.forEach(item => {
      if (item.type === 'group' && groupContains(item, activeRoute)) {
        initial.add(item.label)
      }
    })
    return initial
  })

  // 라우트 바뀌면 해당 그룹 자동 열기
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
                  <span className={`w-[20px] h-[20px] rounded-[3px] flex-shrink-0 ${active ? 'bg-[#B4B4B4]' : 'bg-[#B5B5B5]'}`} />
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
                  <span className={`w-[20px] h-[20px] rounded-[3px] flex-shrink-0 ${childActive ? 'bg-[#B4B4B4]' : 'bg-[#B5B5B5]'}`} />
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
                          <span className="w-[20px] h-[20px] rounded-[3px] bg-[#005744] flex-shrink-0" />
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
                      <span className="w-[20px] h-[20px] rounded-[3px] bg-[#B5B5B5] flex-shrink-0" />
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
