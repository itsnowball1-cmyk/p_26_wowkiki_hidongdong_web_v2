import { createContext, useContext, useState, type ReactNode } from 'react'

export type AdminUser = {
  id: string
  name: string
  role: 'sadmin' | 'wadmin'
}

type AuthValue = {
  user: AdminUser | null
  login: (id: string, password: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)
const STORAGE_KEY = 'wk_admin_user'

function loadUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AdminUser) : null
  } catch { return null }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(loadUser)

  const login = async (id: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role: 'admin', id, password })
      })
      if (res.ok) {
        const dto = await res.json() as { id: string; name: string; role: string }
        if (dto.role !== 'admin') return { ok: false, error: '관리자 계정이 아닙니다.' }
        const u: AdminUser = { id: dto.id, name: dto.name, role: 'wadmin' }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
        localStorage.setItem('hbd_user_id', u.id)
        setUser(u)
        return { ok: true }
      }
      const data = await res.json().catch(() => ({})) as { error?: string }
      return { ok: false, error: data.error ?? '로그인에 실패했습니다.' }
    } catch {
      return { ok: false, error: '서버에 연결할 수 없습니다.' }
    }
  }

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem('hbd_user_id')
    setUser(null)
    window.location.hash = '#/login'
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
