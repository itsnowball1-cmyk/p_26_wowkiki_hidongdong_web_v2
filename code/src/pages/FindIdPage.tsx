import { useEffect, useRef, useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import { api } from '../lib/api'
import type { Role } from '../lib/auth'
import { useRouter } from '../lib/router'

const TABS: { key: Role; label: string }[] = [
  { key: 'admin', label: '관리자' },
  { key: 'doctor', label: '의사' },
  { key: 'therapist', label: '치료사' },
]

function extractError(e: unknown): string {
  if (!(e instanceof Error)) return '오류가 발생했습니다.'
  const match = e.message.match(/^API \d+: (.+)/)
  if (!match) return e.message
  try {
    const body = JSON.parse(match[1]) as { error?: string }
    return body.error ?? match[1]
  } catch {
    return match[1]
  }
}

export default function FindIdPage() {
  const { go } = useRouter()
  const [step, setStep] = useState<'form' | 'otp' | 'result'>('form')
  const [role, setRole] = useState<Role>('admin')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', ''])
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [maskedId, setMaskedId] = useState('')
  const [timer, setTimer] = useState(300)
  const digitRefs = useRef<(HTMLInputElement | null)[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (step !== 'otp') return
    setTimer(300)
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0 }
        return t - 1
      })
    }, 1000)
    return () => { clearInterval(timerRef.current!) }
  }, [step])

  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => digitRefs.current[0]?.focus(), 50)
    }
  }, [step])

  function startTimer() {
    clearInterval(timerRef.current!)
    setTimer(300)
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) { clearInterval(timerRef.current!); return 0 }
        return t - 1
      })
    }, 1000)
  }

  function formatTimer(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  async function handleFormSubmit() {
    const cleanPhone = phone.replace(/\D/g, '')
    if (!name.trim()) { setError('이름을 입력해주세요.'); return }
    if (!cleanPhone || cleanPhone.length < 10) { setError('올바른 전화번호를 입력해주세요.'); return }
    setError(null)
    setSubmitting(true)
    try {
      await api.findIdCheck(role, name.trim(), cleanPhone)
      setStep('otp')
    } catch (e) {
      setError(extractError(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleOtpSubmit() {
    const code = digits.join('')
    if (code.length < 6) { setError('인증번호 6자리를 입력해주세요.'); return }
    setError(null)
    setSubmitting(true)
    try {
      const cleanPhone = phone.replace(/\D/g, '')
      const result = await api.findIdVerify(role, name.trim(), cleanPhone, code)
      setMaskedId(result.maskedId)
      setStep('result')
    } catch (e) {
      setError(extractError(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    setError(null)
    setDigits(['', '', '', '', '', ''])
    const cleanPhone = phone.replace(/\D/g, '')
    try {
      await api.findIdCheck(role, name.trim(), cleanPhone)
      startTimer()
      setTimeout(() => digitRefs.current[0]?.focus(), 50)
    } catch (e) {
      setError(extractError(e))
    }
  }

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = digit
    setDigits(next)
    setError(null)
    if (digit && index < 5) {
      digitRefs.current[index + 1]?.focus()
    }
  }

  function handleDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!text) return
    const next = Array(6).fill('')
    for (let i = 0; i < 6; i++) next[i] = text[i] ?? ''
    setDigits(next)
    digitRefs.current[Math.min(text.length, 5)]?.focus()
  }

  const title = step === 'result' ? '아이디를 찾았어요' : '아이디 찾기'

  return (
    <div className="min-h-screen bg-white grid place-items-center px-4 py-10">
      <div className="w-full max-w-[670px]">
        <div className="flex justify-center mb-10">
          <BrandLogo size="lg" />
        </div>

        <h1 className="text-[35px] font-bold text-[#343A40] text-center tracking-tight mb-8">
          {title}
        </h1>

        {/* Step: form */}
        {step === 'form' && (
          <>
            <div className="bg-[#EAEAEA] rounded-[5px] p-[5px] flex gap-1 mb-8">
              {TABS.map(t => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setRole(t.key); setError(null) }}
                  className={`flex-1 h-[34px] rounded-[5px] text-[15px] font-medium transition-colors ${
                    role === t.key
                      ? 'bg-white border border-[#005744] text-[#005744]'
                      : 'bg-transparent text-[#484848] hover:bg-white/50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="max-w-[420px] mx-auto space-y-5">
              <div>
                <label className="block text-[15px] font-semibold text-[#343A40] mb-2">이름</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => { setName(e.target.value); setError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') handleFormSubmit() }}
                  placeholder="이름을 입력해주세요."
                  className="w-full h-[42px] px-4 border border-[#9F9F9F] rounded-[5px] text-[14px] placeholder:text-[#C3C3C3] focus:outline-none focus:border-[#005744]"
                />
              </div>
              <div>
                <label className="block text-[15px] font-semibold text-[#343A40] mb-2">휴대전화</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value); setError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter') handleFormSubmit() }}
                  placeholder="휴대전화 번호를 입력해주세요."
                  className="w-full h-[42px] px-4 border border-[#9F9F9F] rounded-[5px] text-[14px] placeholder:text-[#C3C3C3] focus:outline-none focus:border-[#005744]"
                />
              </div>
              {error && <p className="text-[12px] text-[#FF4242]">{error}</p>}
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={handleFormSubmit}
                  disabled={submitting}
                  className="w-[125px] h-[45px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:opacity-90 transition disabled:opacity-60"
                >
                  {submitting ? '확인 중…' : '다음'}
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step: otp */}
        {step === 'otp' && (
          <div>
            <p className="text-[15px] font-medium text-[#343A40] text-center mb-8">
              문자를 발송했어요. 인증번호를 입력해 주세요.
            </p>

            <div className="flex justify-center gap-5 mb-5">
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={el => { digitRefs.current[i] = el }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleDigitKeyDown(i, e)}
                  onFocus={() => setFocusedIndex(i)}
                  onBlur={() => setFocusedIndex(null)}
                  onPaste={i === 0 ? handlePaste : undefined}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                  className={`w-[77px] h-[87px] text-center text-[30px] font-normal rounded-[10px] focus:outline-none transition-colors ${
                    d || focusedIndex === i
                      ? 'border-[3px] border-[#005744]'
                      : 'border-2 border-[#C3C3C3]'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-3">
                <span className="text-[15px] font-medium text-[#979797]">
                  남은 시간 {formatTimer(timer)}
                </span>
                <button
                  type="button"
                  onClick={startTimer}
                  className="text-[15px] font-medium text-[#979797] underline underline-offset-2 hover:text-[#005744] transition-colors"
                >
                  시간연장
                </button>
              </div>
              <button
                type="button"
                onClick={handleResend}
                className="text-[15px] font-medium text-[#979797] underline underline-offset-2 hover:text-[#005744] transition-colors"
              >
                재전송
              </button>
            </div>

            {error && <p className="text-[12px] text-[#FF4242] mb-4 text-center">{error}</p>}

            <div className="flex justify-center mt-6">
              <button
                type="button"
                onClick={handleOtpSubmit}
                disabled={submitting}
                className="w-[125px] h-[45px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:opacity-90 transition disabled:opacity-60"
              >
                {submitting ? '확인 중…' : '다음'}
              </button>
            </div>
          </div>
        )}

        {/* Step: result */}
        {step === 'result' && (
          <div className="max-w-[420px] mx-auto">
            <div className="w-full border border-[#9F9F9F] rounded-[5px] h-[70px] flex items-center px-6 mb-14">
              <span className="text-[20px] font-medium text-[#343A40]">{maskedId}</span>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                type="button"
                className="w-[195px] h-[45px] border border-[#005744] text-[#005744] text-[15px] font-medium rounded-[5px] hover:bg-[#005744]/5 transition-colors"
              >
                비밀번호 찾기
              </button>
              <button
                type="button"
                onClick={() => go({ name: 'login' })}
                className="w-[195px] h-[45px] bg-[#005744] text-white text-[15px] font-medium rounded-[5px] hover:opacity-90 transition"
              >
                로그인 바로가기
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-center mt-10">
          <button
            type="button"
            onClick={() => go({ name: 'login' })}
            className="text-[13px] text-[#A6A6A6] hover:text-[#343A40] transition-colors"
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  )
}
