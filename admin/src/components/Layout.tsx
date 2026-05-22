import { type ReactNode } from 'react'
import { useRouter, type RouteName } from '../lib/router'
import { useAuth } from '../lib/auth'

type MenuItem = { label: string; route: RouteName }

const MENU: MenuItem[] = [
  { label: '대시보드',  route: 'dashboard' },
  { label: '기관/계정', route: 'institutions' },
  { label: '아동관리',  route: 'children' },
  { label: '통계/로그', route: 'stats' },
  { label: '공지/FAQ',  route: 'notices' },
  { label: '보안',      route: 'security' },
  { label: '콘텐츠',    route: 'content' },
  { label: '버전관리',  route: 'versions' },
  { label: '데이터',    route: 'data' },
  { label: '마이페이지',route: 'mypage' },
]

export default function Layout({ children, title }: { children: ReactNode; title?: string }) {
  const { route, go } = useRouter()
  const { user, logout } = useAuth()

  return (
    <div className="flex h-screen bg-[#FAFAFA] overflow-hidden">
      {/* ── 사이드바 ── */}
      <aside className="w-[240px] flex-shrink-0 bg-white flex flex-col" style={{ boxShadow: '2px 0 8px rgba(0,0,0,0.08)' }}>
        {/* 로고 */}
        <div className="h-[64px] flex items-center px-6 border-b border-[#DEDEDE]">
          <span className="text-[22px] font-extrabold" style={{ fontFamily: 'Pretendard', color: '#7CBE26' }}>
            하이동동
          </span>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {MENU.map(item => {
            const active = route.name === item.route
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => go({ name: item.route } as Parameters<typeof go>[0])}
                className={`w-full flex items-center gap-3 px-6 py-[14px] text-[15px] font-medium text-left transition-colors ${
                  active
                    ? 'bg-[#F3F3F3] text-[#000000] font-semibold'
                    : 'text-[#B5B5B5] hover:bg-[#F9F9F9] hover:text-[#555]'
                }`}
              >
                <MenuIcon active={active} />
                {item.label}
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
            <span className="text-[14px] text-[#727272]">
              {user?.name} 님
            </span>
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

function MenuIcon({ active }: { active: boolean }) {
  return (
    <span className={`w-[6px] h-[6px] rounded-full flex-shrink-0 ${active ? 'bg-[#005744]' : 'bg-[#DEDEDE]'}`} />
  )
}
