import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'

export type Role = 'admin' | 'doctor' | 'therapist'

export type CurrentUser = {
  id: string
  code?: string | null
  name: string
  role: Role
  institutionCode: string
  department?: string | null
  schedule?: string | null
}

type AuthValue = {
  user: CurrentUser | null
  login: (role: Role, id: string, password: string) => Promise<{ ok: boolean; error?: string; rejected?: boolean }>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

const LOGIN_FAIL_MSG =
  '아이디(로그인 전화번호, 로그인 전용 아이디) 또는 비밀번호가 잘못 되었습니다.\n아이디와 비밀번호를 정확히 입력해 주세요.'

const STORAGE_KEY = 'hbd_user'

function loadUser(): CurrentUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CurrentUser
  } catch {
    return null
  }
}

function saveUser(u: CurrentUser) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
  localStorage.setItem('hbd_user_id', u.id)
}

function clearUser() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem('hbd_user_id')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(loadUser)

  useEffect(() => {
    if (!user) return
    api.me()
      .then((dto) => {
        setUser(prev => {
          if (
            prev &&
            prev.id === dto.id &&
            prev.code === dto.code &&
            prev.name === dto.name &&
            prev.role === dto.role &&
            prev.institutionCode === dto.institutionCode
          ) return prev  // 변경 없으면 리렌더링 방지
          const updated: CurrentUser = {
            id: dto.id, code: dto.code, name: dto.name, role: dto.role,
            institutionCode: dto.institutionCode,
            department: dto.department, schedule: dto.schedule
          }
          saveUser(updated)
          return updated
        })
      })
      .catch(() => {})
  }, [user?.id])

  const login = async (role: Role, id: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ role, id, password })
      })
      if (res.ok) {
        const dto = (await res.json()) as {
          id: string; code: string | null; name: string; role: Role
          institutionCode: string; department: string | null; schedule: string | null
        }
        const u: CurrentUser = {
          id: dto.id, code: dto.code, name: dto.name, role: dto.role,
          institutionCode: dto.institutionCode,
          department: dto.department, schedule: dto.schedule
        }
        saveUser(u)
        setUser(u)
        return { ok: true }
      }
      const data = await res.json().catch(() => ({})) as { error?: string; id?: string; name?: string; instt_code?: string }
      if (res.status === 403) {
        if (data.error === '반려') {
          sessionStorage.setItem('rejected_user', JSON.stringify({ id: data.id, name: data.name, institutionCode: data.instt_code }))
          return { ok: false, rejected: true }
        }
        return { ok: false, error: data.error ?? LOGIN_FAIL_MSG }
      }
      if (res.status === 401) {
        return { ok: false, error: data.error ?? LOGIN_FAIL_MSG }
      }
      return { ok: false, error: LOGIN_FAIL_MSG }
    } catch {
      return { ok: false, error: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.' }
    }
  }

  const logout = () => {
    clearUser()
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

export function roleLabel(role: Role): string {
  return role === 'admin' ? '관리자' : role === 'doctor' ? '의사' : '치료사'
}
