import { type FormEvent, useState } from 'react'
import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const { login } = useAuth()
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    const result = await login(id, password)
    setSubmitting(false)
    if (!result.ok) setError(result.error ?? '로그인에 실패했습니다.')
  }

  return (
    <div className="min-h-screen bg-white grid place-items-center px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-10 text-center">
          <p className="text-[13px] text-ink-400 mb-1">와우키키</p>
          <h1 className="text-[28px] font-bold text-ink-900">관리자 로그인</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[14px] font-medium text-ink-850 mb-1.5">아이디</label>
            <input
              type="text"
              value={id}
              onChange={e => { setId(e.target.value); setError('') }}
              placeholder="아이디를 입력해주세요."
              className="w-full h-[44px] px-4 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-[14px] font-medium text-ink-850 mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="비밀번호를 입력해주세요."
              className="w-full h-[44px] px-4 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand"
            />
          </div>

          {error && (
            <p className="text-[13px] text-brand-danger text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !id || !password}
            className="w-full h-[52px] rounded-[7px] bg-brand text-white text-[16px] font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {submitting ? '로그인 중…' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}
