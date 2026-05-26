import { type ReactNode } from 'react'
import BrandLogo from './BrandLogo'
import { useAuth } from '../lib/auth'

export default function RestrictedLayout({ children, backLabel, onBack }: {
  children: ReactNode
  backLabel?: string
  onBack?: () => void
}) {
  const { logout } = useAuth()

  return (
    <div className="flex h-screen overflow-hidden bg-[#FAFAFA]">
      {/* 사이드바 — 문의만 표시 */}
      <aside className="w-[240px] shrink-0 bg-white flex flex-col" style={{ boxShadow: '0px 0px 5px 0px rgba(0,0,0,0.25)' }}>
        <div className="h-[64px] flex items-center px-5">
          <BrandLogo size="sm" />
        </div>
      </aside>

      {/* 오른쪽 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <header className="h-[64px] bg-white border-b border-[#DEDEDE] flex items-center justify-between px-8 shrink-0">
          <div>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="text-[12px] text-[#000000] hover:text-[#005744] transition"
              >
                {backLabel ?? '기관 인증 페이지로 돌아가기'}&gt;
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={logout}
            className="h-[36px] px-4 rounded-[5px] border border-[#005744] text-[14px] font-medium text-[#005744] hover:bg-[#005744] hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
