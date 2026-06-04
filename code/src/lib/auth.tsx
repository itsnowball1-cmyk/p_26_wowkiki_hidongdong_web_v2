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
  approvalStatus?: 'pending' | 'rejected'
  rejectTitle?: string
  rejectReason?: string
}

type AuthValue = {
  user: CurrentUser | null
  login: (role: Role, id: string, password: string, autoLogin?: boolean) => Promise<{ ok: boolean; error?: string }>
  logout: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

const LOGIN_FAIL_MSG =
  '아이디(로그인 전화번호, 로그인 전용 아이디) 또는 비밀번호가 잘못 되었습니다.\n아이디와 비밀번호를 정확히 입력해 주세요.'

const STORAGE_KEY = 'hbd_user'
const AUTO_LOGIN_KEY = 'hbd_auto_login_expiry'
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

function loadUser(): CurrentUser | null {
  try {
    // 자동 로그인: localStorage + 만료 체크
    const expiry = localStorage.getItem(AUTO_LOGIN_KEY)
    if (expiry) {
      if (Date.now() > Number(expiry)) {
        // 만료됨 → 전부 초기화
        localStorage.removeItem(STORAGE_KEY)
        localStorage.removeItem(AUTO_LOGIN_KEY)
        localStorage.removeItem('hbd_user_id')
        return null
      }
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) return JSON.parse(raw) as CurrentUser
    }
    // 자동 로그인 미체크: sessionStorage
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) as CurrentUser : null
  } catch {
    return null
  }
}

function saveUser(u: CurrentUser, autoLogin: boolean) {
  if (autoLogin) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    localStorage.setItem(AUTO_LOGIN_KEY, String(Date.now() + ONE_WEEK_MS))
    localStorage.setItem('hbd_user_id', u.id)
    sessionStorage.removeItem(STORAGE_KEY)
  } else {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(u))
    sessionStorage.setItem('hbd_user_id', u.id)
    localStorage.setItem('hbd_user_id', u.id)
    localStorage.removeItem(AUTO_LOGIN_KEY)
  }
}

function clearUser() {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(AUTO_LOGIN_KEY)
  localStorage.removeItem('hbd_user_id')
  sessionStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem('hbd_user_id')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(loadUser)

  useEffect(() => {
    if (!user) return
    api.me()
      .then((dto) => {
        const fresh = dto as typeof dto & { approvalStatus?: 'pending' | 'rejected'; rejectTitle?: string; rejectReason?: string }
        setUser(prev => {
          if (
            prev &&
            prev.id === fresh.id &&
            prev.code === fresh.code &&
            prev.name === fresh.name &&
            prev.role === fresh.role &&
            prev.institutionCode === fresh.institutionCode &&
            prev.approvalStatus === fresh.approvalStatus
          ) return prev
          const updated: CurrentUser = {
            id: fresh.id, code: fresh.code, name: fresh.name, role: fresh.role,
            institutionCode: fresh.institutionCode,
            department: fresh.department, schedule: fresh.schedule,
            approvalStatus: fresh.approvalStatus,
            rejectTitle: fresh.rejectTitle,
            rejectReason: fresh.rejectReason,
          }
          // 자동 로그인 상태 유지 (기존 만료 여부로 판단)
          const isAutoLogin = !!localStorage.getItem(AUTO_LOGIN_KEY)
          saveUser(updated, isAutoLogin)
          return updated
        })
      })
      .catch(() => {})
  }, [user?.id])

  const login = async (role: Role, id: string, password: string, autoLogin = false) => {
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
          approvalStatus?: 'pending' | 'rejected'; rejectTitle?: string; rejectReason?: string
        }
        const u: CurrentUser = {
          id: dto.id, code: dto.code, name: dto.name, role: dto.role,
          institutionCode: dto.institutionCode,
          department: dto.department, schedule: dto.schedule,
          approvalStatus: dto.approvalStatus,
          rejectTitle: dto.rejectTitle, rejectReason: dto.rejectReason,
        }
        saveUser(u, autoLogin)
        setUser(u)
        return { ok: true }
      }
      const data = await res.json().catch(() => ({})) as { error?: string }
      if (res.status === 401 || res.status === 403) {
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
