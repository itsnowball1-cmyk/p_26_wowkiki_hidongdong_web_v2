import { useState, type FormEvent } from 'react'
import BrandLogo from '../components/BrandLogo'
import { useAuth, type Role } from '../lib/auth'
import { useRouter } from '../lib/router'

const TABS: { key: Role; label: string }[] = [
  { key: 'admin', label: '관리자' },
  { key: 'doctor', label: '의사' },
  { key: 'therapist', label: '치료사' }
]

function EyeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.4 18.4 0 0 1 4.06-5.06" />
      <path d="M9.9 4.24A10.95 10.95 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12A3 3 0 1 1 9.88 9.88" />
      <path d="M2 2l20 20" />
    </svg>
  )
}

export default function LoginPage() {
  const { login } = useAuth()
  const { go } = useRouter()
  const [role, setRole] = useState<Role>('admin')
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [autoLogin, setAutoLogin] = useState(() => localStorage.getItem('hbd_auto_login_pref') === 'true')

  const tabLabel = TABS.find((t) => t.key === role)!.label

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    localStorage.setItem('hbd_auto_login_pref', String(autoLogin))
    const result = await login(role, id, password, autoLogin)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? '로그인에 실패했습니다.')
      return
    }
    go(role === 'admin' ? { name: 'admin-dashboard' } : { name: 'dashboard' })
  }

  return (
    <div className="min-h-screen bg-white grid place-items-center px-4 py-10">
      <div className="w-full max-w-[670px]">
        {/* Logo */}
        <div className="flex justify-center mb-12">
          <BrandLogo size="lg" />
        </div>

        {/* Role tabs */}
        <div className="bg-line-soft rounded-[5px] p-1 flex gap-1 mb-10">
          {TABS.map((t) => {
            const active = role === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setRole(t.key)
                  setError(null)
                }}
                className={`flex-1 h-[34px] rounded-[5px] text-[15px] font-medium transition-colors ${
                  active ? 'bg-brand text-white' : 'bg-transparent text-ink-850 hover:bg-white'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 max-w-[420px] mx-auto">
          <div>
            <label htmlFor="login-id" className="block text-[15px] font-semibold text-ink-850 mb-2">
              아이디
            </label>
            <input
              id="login-id"
              type="text"
              autoComplete="username"
              value={id}
              onChange={(e) => {
                setId(e.target.value)
                setError(null)
              }}
              placeholder={`${tabLabel}의 아이디를 입력해주세요.`}
              className="w-full h-[42px] px-4 border border-[#9F9F9F] rounded-[5px] text-[14px] placeholder:text-[#C3C3C3] focus:outline-none focus:border-brand"
            />
          </div>

          <div>
            <label htmlFor="login-pw" className="block text-[15px] font-semibold text-ink-850 mb-2">
              비밀번호
            </label>
            <div className="relative">
              <input
                id="login-pw"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError(null)
                }}
                placeholder={`${tabLabel}의 비밀번호를 입력해주세요.`}
                className="w-full h-[42px] pl-4 pr-11 border border-[#9F9F9F] rounded-[5px] text-[14px] placeholder:text-[#C3C3C3] focus:outline-none focus:border-brand"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
                aria-pressed={showPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 grid place-items-center text-ink-500 hover:text-ink-700"
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setAutoLogin(p => !p)}
              className="flex items-center gap-2"
            >
              <span className={`w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-colors ${autoLogin ? 'bg-brand border-brand' : 'bg-white border-[#B2B2B2]'}`}>
                {autoLogin && (
                  <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                    <path d="M1 4.5L4 7.5L10 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
              <span className="text-[13px] text-[#666]">자동 로그인 (1주일)</span>
            </button>
            <div className="flex items-center gap-3 text-[12px] text-[#A6A6A6]">
              <button type="button" className="hover:text-ink-700">아이디찾기</button>
              <span className="text-[#A5A5A5]">|</span>
              <button type="button" className="hover:text-ink-700">비밀번호 찾기</button>
            </div>
          </div>

          {error && (
            <div className="text-[13px] text-brand-danger text-center whitespace-pre-line leading-relaxed">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-[58px] rounded-[5px] bg-brand text-white text-[18px] font-semibold hover:opacity-90 transition disabled:opacity-60"
          >
            {submitting ? '로그인 중…' : '로그인'}
          </button>

          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => go({ name: 'signup' })}
              className="text-[15px] text-ink-850 underline underline-offset-4 decoration-ink-850 hover:text-brand hover:decoration-brand transition-colors"
            >
              하이동동 가입하기
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
