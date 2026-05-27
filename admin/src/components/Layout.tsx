import { type ReactNode } from 'react'
import { useRouter, type RouteName } from '../lib/router'
import { useAuth } from '../lib/auth'

type MenuItemDef = {
  label: string
  route?: RouteName
  level: 0 | 1
  hasChevron?: boolean
}

const MENU: MenuItemDef[] = [
  { label: '대시보드',      route: 'dashboard',    level: 0 },
  { label: '회원 관리',                                      level: 0, hasChevron: true },
  { label: '기관',          route: 'institutions',          level: 1 },
  { label: '기관 관리자',  route: 'institution-admins',   level: 1 },
  { label: '의사',          route: 'doctors',      level: 1 },
  { label: '치료사',        route: 'therapists',   level: 1 },
  { label: '아동',          route: 'children',     level: 1 },
  { label: '통계/로그',     route: 'stats',        level: 0, hasChevron: true },
  { label: '고객센터',                             level: 0, hasChevron: true },
  { label: '공지사항',      route: 'notices',      level: 1 },
  { label: 'FAQ',           route: 'faq',          level: 1 },
  { label: '1:1 문의사항',  route: 'cs',           level: 1 },
  { label: '앱 푸시',                              level: 1 },
  { label: '문자 설정',     route: 'sms-settings', level: 1 },
  { label: '보안',          route: 'security',     level: 0, hasChevron: true },
  { label: '콘텐츠',        route: 'content',      level: 0, hasChevron: true },
  { label: '버전관리',      route: 'versions',     level: 0, hasChevron: true },
  { label: '마이페이지',    route: 'mypage',       level: 0, hasChevron: true },
]

export default function Layout({ children, title }: { children: ReactNode; title?: string }) {
  const { route, go } = useRouter()
  const { user, logout } = useAuth()

  const activeRoute = route.name

  return (
    <div className="flex h-screen bg-[#FAFAFA] overflow-hidden">
      {/* ── 사이드바 ── */}
      <aside className="w-[240px] flex-shrink-0 bg-white flex flex-col" style={{ boxShadow: '0px 0px 5px 0px rgba(0,0,0,0.25)' }}>
        {/* 로고 */}
        <div className="h-[64px] flex items-center px-5 border-b border-[#DEDEDE]">
          <span className="text-[20px] font-extrabold" style={{ color: '#7CBE26' }}>
            하이동동
          </span>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 py-2 overflow-y-auto">
          {MENU.map((item, idx) => {
            const active = !!item.route && activeRoute === item.route
            const clickable = !!item.route

            if (item.level === 1) {
              /* ── 서브 아이템 ── */
              if (active) {
                return (
                  <div key={idx} className="px-[5px] py-[5px]">
                    <button
                      type="button"
                      onClick={() => item.route && go({ name: item.route } as Parameters<typeof go>[0])}
                      className="w-full h-[38px] flex items-center gap-[14px] pl-[26px] bg-[#F1F1F1] rounded-[5px]"
                    >
                      <span className="w-[20px] h-[20px] rounded-[3px] bg-[#005744] flex-shrink-0" />
                      <span className="text-[15px] font-medium text-[#343A40]">{item.label}</span>
                    </button>
                  </div>
                )
              }
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => clickable && go({ name: item.route! } as Parameters<typeof go>[0])}
                  className={`w-full h-[48px] flex items-center gap-[14px] pl-9 text-[15px] font-medium text-[#B5B5B5] ${clickable ? 'hover:bg-[#F9F9F9] hover:text-[#555]' : 'cursor-default'} transition-colors`}
                >
                  <span className="w-[20px] h-[20px] rounded-[3px] bg-[#B5B5B5] flex-shrink-0" />
                  {item.label}
                </button>
              )
            }

            /* ── 최상위 아이템 ── */
            return (
              <button
                key={idx}
                type="button"
                onClick={() => clickable && go({ name: item.route! } as Parameters<typeof go>[0])}
                className={`w-full h-[48px] flex items-center gap-[14px] pl-[18px] pr-3 text-[15px] font-medium transition-colors ${
                  active
                    ? 'bg-[#F3F3F3] text-[#000000]'
                    : `text-[#B5B5B5] ${clickable ? 'hover:bg-[#F9F9F9] hover:text-[#555]' : 'cursor-default'}`
                }`}
              >
                <span className={`w-[20px] h-[20px] rounded-[3px] flex-shrink-0 ${active ? 'bg-[#B4B4B4]' : 'bg-[#B5B5B5]'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {item.hasChevron && (
                  <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="flex-shrink-0">
                    <path d="M1 1L6 6L11 1" stroke="#919191" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* ── 오른쪽 전체 ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <header className="h-[64px] bg-white border-b border-[#DEDEDE] flex items-center justify-between px-8 flex-shrink-0">
          <span className="text-[15px] font-semibold text-[#202020]">
            {title ?? '대시보드'}
          </span>
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
