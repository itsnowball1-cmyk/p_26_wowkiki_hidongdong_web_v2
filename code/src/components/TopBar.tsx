import { useAuth, roleLabel } from '../lib/auth'

export default function TopBar() {
  const { user, logout } = useAuth()
  if (!user) return null

  return (
    <header className="h-[64px] bg-surface-card flex items-center justify-end pr-6 gap-4 border-b border-line">
      <button
        type="button"
        onClick={logout}
        className="h-9 px-3 border border-brand text-brand text-[15px] font-medium rounded-[5px] hover:bg-brand hover:text-white transition-colors"
      >
        로그아웃
      </button>

      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full bg-[#E9E9E9] grid place-items-center"
          aria-label="user avatar"
        >
          <span className="block w-2 h-2 rounded-full bg-[#A3A3A3]" />
        </div>
        <span className="text-[15px] font-medium">
          {user.name} {roleLabel(user.role)}
        </span>
      </div>
    </header>
  )
}
