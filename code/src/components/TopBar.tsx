import { useAuth } from '../lib/auth'

export default function TopBar() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <header className="h-[64px] bg-surface-card flex items-center justify-end pr-6 gap-4 border-b border-line sticky top-0 z-30">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-ink-400">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>

      <span className="text-[15px] font-medium text-ink-700">
        {user.name}
      </span>

      <button
        type="button"
        onClick={logout}
        className="h-9 px-4 border border-brand text-brand text-[15px] font-medium rounded-[5px] hover:bg-brand hover:text-white transition-colors"
      >
        로그아웃
      </button>
    </header>
  )
}
