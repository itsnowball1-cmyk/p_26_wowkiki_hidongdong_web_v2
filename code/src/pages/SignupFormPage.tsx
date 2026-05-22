import { useEffect, useMemo, useRef, useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import Stepper from '../components/Stepper'
import { useRouter } from '../lib/router'
import { type Role } from '../lib/auth'

type Props = { role: Role }

type FormState = {
  id: string
  password: string
  passwordConfirm: string
  name: string
  phone: string
  phoneCode: string
  email: string
  institutionCode: string
  department: string
}

const INITIAL: FormState = {
  id: '',
  password: '',
  passwordConfirm: '',
  name: '',
  phone: '',
  phoneCode: '',
  email: '',
  institutionCode: '',
  department: ''
}

type IdStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'
type InsttStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'error'

function validatePassword(pw: string): { valid: boolean; lengthOk: boolean; comboOk: boolean } {
  const lengthOk = pw.length >= 8 && pw.length <= 16
  const categories = [
    /[A-Z]/.test(pw),
    /[a-z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw)
  ].filter(Boolean).length
  const comboOk = categories >= 2
  return { valid: lengthOk && comboOk, lengthOk, comboOk }
}

export default function SignupFormPage({ role }: Props) {
  const { go } = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [idStatus, setIdStatus] = useState<IdStatus>('idle')
  const [insttStatus, setInsttStatus] = useState<InsttStatus>('idle')
  const [phoneSent, setPhoneSent] = useState(false)
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [timer, setTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [licenseFile, setLicenseFile] = useState<File | null>(null)
  const [licenseDragging, setLicenseDragging] = useState(false)
  const licenseInputRef = useRef<HTMLInputElement>(null)

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setForm((p) => ({ ...p, [k]: v }))
    if (k === 'id') setIdStatus('idle')
    if (k === 'institutionCode') setInsttStatus('idle')
    if (k === 'phone') {
      setPhoneSent(false); setPhoneVerified(false)
      setPhoneError(''); setTimer(0)
      if (timerRef.current) clearInterval(timerRef.current)
    }
    if (k === 'phoneCode') { setPhoneVerified(false); setPhoneError('') }
  }

  const pwValidation = validatePassword(form.password)
  const passwordMatch = form.password.length > 0 && form.password === form.passwordConfirm

  const canSubmit = useMemo(() => {
    const base = Boolean(
      form.id.trim() &&
      idStatus === 'available' &&
      pwValidation.valid &&
      passwordMatch &&
      form.name.trim() &&
      phoneVerified &&
      insttStatus === 'valid' &&
      form.department.trim()
    )
    if (role === 'therapist') return base && licenseFile !== null
    return base
  }, [form, idStatus, pwValidation.valid, passwordMatch, phoneVerified, insttStatus, licenseFile, role])

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setTimer(180)
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0 }
        return prev - 1
      })
    }, 1000)
  }

  const handleSendSms = async () => {
    const phone = form.phone.replace(/\D/g, '')
    if (!phone || phone.length < 10) return setPhoneError('휴대전화를 올바르게 입력해주세요.')
    setPhoneSending(true)
    setPhoneError('')
    try {
      const res = await fetch('/api/auth/send-sms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setPhoneError(data.error ?? 'SMS 발송에 실패했습니다.'); return }
      setPhoneSent(true)
      setPhoneVerified(false)
      startTimer()
    } catch {
      setPhoneError('서버 연결에 실패했습니다.')
    } finally {
      setPhoneSending(false)
    }
  }

  const handleVerifySms = async () => {
    const phone = form.phone.replace(/\D/g, '')
    const code  = form.phoneCode.trim()
    if (!code) return setPhoneError('인증번호를 입력해주세요.')
    setPhoneError('')
    try {
      const res = await fetch('/api/auth/verify-sms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, code })
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setPhoneError(data.error ?? '인증에 실패했습니다.'); return }
      setPhoneVerified(true)
      setTimer(0)
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    } catch {
      setPhoneError('서버 연결에 실패했습니다.')
    }
  }

  const fmtTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const handleCheckInstt = async () => {
    const code = form.institutionCode.trim()
    if (!code) return
    setInsttStatus('checking')
    try {
      const res = await fetch(`/api/auth/check-institution?code=${encodeURIComponent(code)}`)
      const data = await res.json() as { valid?: boolean }
      setInsttStatus(data.valid ? 'valid' : 'invalid')
    } catch {
      setInsttStatus('error')
    }
  }

  const handleCheckId = async () => {
    const id = form.id.trim()
    if (!id) return
    setIdStatus('checking')
    try {
      const res = await fetch(`/api/auth/check-id?id=${encodeURIComponent(id)}`)
      const data = await res.json() as { available?: boolean }
      setIdStatus(data.available ? 'available' : 'taken')
    } catch {
      setIdStatus('error')
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    try {
      let license_file_nm: string | null = null
      let license_file_data: string | null = null
      if (licenseFile) {
        license_file_nm = licenseFile.name
        const buf = await licenseFile.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        license_file_data = btoa(binary)
      }
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          role,
          id: form.id.trim(),
          pw: form.password,
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          instt_code: form.institutionCode.trim().toUpperCase(),
          depart_code: form.department.trim(),
          license_file_nm,
          license_file_data,
        })
      })
      const data = await res.json() as { ok?: boolean; code?: string; message?: string }
      if (!res.ok) {
        alert(data.message ?? '회원가입에 실패했습니다.')
        return
      }
      setSubmitted(true)
    } catch {
      alert('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  const insttStatusMsg =
    insttStatus === 'valid'   ? '확인된 기관코드입니다.' :
    insttStatus === 'invalid' ? '소속 병원 코드를 올바르게 입력해주세요.' :
    insttStatus === 'error'   ? '소속 병원 코드를 올바르게 입력해주세요.' : ''
  const insttStatusColor =
    insttStatus === 'valid' ? 'text-brand' :
    (insttStatus === 'invalid' || insttStatus === 'error') ? 'text-brand-danger' : ''

  const idStatusMsg =
    idStatus === 'available' ? '사용 가능한 아이디입니다.' :
    idStatus === 'taken'     ? '이미 사용 중인 아이디 입니다.' :
    idStatus === 'error'     ? '이미 사용 중인 아이디 입니다.' : ''
  const idStatusColor =
    idStatus === 'available' ? 'text-brand' :
    (idStatus === 'taken' || idStatus === 'error') ? 'text-brand-danger' : ''

  if (submitted) {
    const isDoctor = role === 'doctor'
    return (
      <div className="min-h-screen bg-white flex flex-col px-6 py-10">
        <div className="w-full max-w-[960px] mx-auto">
          <div className="mb-8">
            <BrandLogo size="md" />
          </div>
          <div className="mb-14">
            <Stepper current={3} />
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          {/* 체크 아이콘 */}
          <div className="w-[120px] h-[120px] mb-8">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="58" stroke="#005744" strokeWidth="4" fill="white" />
              <path d="M34 60l18 18 34-34" stroke="#005744" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {isDoctor ? (
            <>
              <h2 className="text-[35px] font-bold text-black mb-3 leading-[50px]">
                의사 회원가입 완료
              </h2>
              <p className="text-[15px] text-[#141414]">
                {form.name} 님의 회원가입이 성공적으로 완료 되었습니다.
              </p>
              <button
                type="button"
                onClick={() => go({ name: 'login' })}
                className="mt-10 w-[420px] h-[58px] rounded-[10px] text-[18px] font-semibold bg-[#005744] text-white hover:opacity-90 transition"
              >
                로그인 바로가기
              </button>
            </>
          ) : (
            <>
              <h2 className="text-[35px] font-bold leading-[50px] mb-6">
                <span className="text-black">치료사 회원가입 완료</span><br />
                <span className="text-[#005744]">하이동동 관리자 승인 후 서비스를 이용하실 수 있습니다.</span>
              </h2>
              <div className="w-[460px] rounded-[10px] bg-[#EAF3EA] px-8 py-6 text-[16px] text-[#141414] leading-[24px] text-center">
                등록하신 휴대폰번호로 승인 완료 알림을 보내드릴 예정입니다.<br />
                승인은 영업일 기준 1~2일정도 소요될 수 있습니다.
              </div>
              <button
                type="button"
                onClick={() => go({ name: 'login' })}
                className="mt-10 w-[158px] h-[58px] rounded-[10px] text-[18px] font-semibold bg-[#005744] text-white hover:opacity-90 transition"
              >
                확인
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="max-w-[960px] mx-auto">
        <div className="mb-8">
          <BrandLogo size="md" />
        </div>

        <h1 className="text-[30px] font-bold text-ink-850 mb-10">회원가입</h1>

        <div className="mb-14">
          <Stepper current={2} />
        </div>

        {/* 로그인 정보 */}
        <SectionHeader title="로그인 정보" />
        <FormTable>
          <FormRow label="아이디">
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  value={form.id}
                  onChange={update('id')}
                  placeholder="아이디를 입력해주세요."
                  className="w-full h-[42px] px-3 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand"
                />
                {idStatusMsg && (
                  <div className={`mt-1 text-[12px] ${idStatusColor}`}>{idStatusMsg}</div>
                )}
              </div>
              <OutlineButton
                onClick={handleCheckId}
                disabled={!form.id.trim() || idStatus === 'checking' || idStatus === 'available'}
                width={110}
              >
                {idStatus === 'checking' ? '확인 중…' : idStatus === 'available' ? '확인 완료' : '중복확인'}
              </OutlineButton>
            </div>
          </FormRow>

          <FormRow label="비밀번호">
            <div>
              <input
                type="password"
                value={form.password}
                onChange={update('password')}
                placeholder="비밀번호를 입력해주세요."
                className="w-full h-[42px] px-3 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand"
              />
              {form.password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <RuleRow pass={pwValidation.lengthOk} text="8~16자" />
                  <RuleRow pass={pwValidation.comboOk}  text="영문/숫자/특수문자 2가지 이상 조합" />
                </div>
              )}
              {form.password.length === 0 && (
                <div className="mt-1 text-[12px] text-ink-400">
                  8~16자의 영문/숫자/특수문자 2가지 이상으로 조합해주세요.
                </div>
              )}
            </div>
          </FormRow>

          <FormRow label="비밀번호 확인" last>
            <div>
              <input
                type="password"
                value={form.passwordConfirm}
                onChange={update('passwordConfirm')}
                placeholder="위와 동일하게 입력해주세요."
                className="w-full h-[42px] px-3 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand"
              />
              {form.passwordConfirm.length > 0 && (
                <div className={`mt-1 text-[12px] ${passwordMatch ? 'text-brand' : 'text-brand-danger'}`}>
                  {passwordMatch ? '비밀번호가 일치합니다.' : '새 비밀번호가 일치하지 않습니다.'}
                </div>
              )}
            </div>
          </FormRow>
        </FormTable>

        {/* 개인 정보 */}
        <div className="mt-12" />
        <SectionHeader title="개인 정보" />
        <FormTable>
          <FormRow label="이름">
            <Input
              value={form.name}
              onChange={update('name')}
              placeholder="이름을 입력해주세요."
            />
          </FormRow>

          <FormRow label="휴대전화">
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={form.phone}
                  onChange={update('phone')}
                  inputMode="numeric"
                  placeholder="'-' 제외하고 숫자만 입력해주세요."
                  className="flex-1"
                  disabled={phoneVerified}
                />
                <OutlineButton
                  onClick={handleSendSms}
                  disabled={!form.phone.trim() || phoneSending || phoneVerified}
                  width={123}
                >
                  {phoneSending ? '발송 중…' : phoneSent ? '재발송' : '인증번호 발송'}
                </OutlineButton>
              </div>
              {phoneSent && !phoneVerified && (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      value={form.phoneCode}
                      onChange={update('phoneCode')}
                      placeholder="인증번호 6자리 입력"
                      maxLength={6}
                      className="w-full h-[42px] px-3 pr-14 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand"
                    />
                    {timer > 0 && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-brand-danger tabular-nums">
                        {fmtTimer(timer)}
                      </span>
                    )}
                    {timer === 0 && phoneSent && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-400">
                        만료
                      </span>
                    )}
                  </div>
                  <OutlineButton
                    onClick={handleVerifySms}
                    disabled={!form.phoneCode.trim() || timer === 0}
                    width={104}
                  >
                    인증확인
                  </OutlineButton>
                </div>
              )}
              {phoneVerified && (
                <div className="text-[12px] text-brand">휴대전화 인증이 완료되었습니다.</div>
              )}
              {phoneError && (
                <div className="text-[12px] text-brand-danger">{phoneError}</div>
              )}
            </div>
          </FormRow>

          <FormRow label="이메일">
            <Input
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="이메일을 입력해주세요."
            />
          </FormRow>

          <FormRow label="기관코드">
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <div className="w-[308px]">
                  <input
                    value={form.institutionCode}
                    onChange={update('institutionCode')}
                    placeholder="소속 기관코드를 입력해주세요."
                    className="w-full h-[42px] px-3 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand"
                  />
                </div>
                <OutlineButton
                  onClick={handleCheckInstt}
                  disabled={!form.institutionCode.trim() || insttStatus === 'checking' || insttStatus === 'valid'}
                  width={110}
                >
                  {insttStatus === 'checking' ? '확인 중…' : insttStatus === 'valid' ? '확인 완료' : '기관코드 확인'}
                </OutlineButton>
              </div>
              {insttStatusMsg && (
                <div className={`text-[12px] ${insttStatusColor}`}>{insttStatusMsg}</div>
              )}
              <div className="text-[12px] text-[#717171]">
                * 소속 기관이 여러곳일 경우 각각 계정 가입을 해야합니다.
              </div>
            </div>
          </FormRow>

          <FormRow label="소속과" last>
            <Input
              value={form.department}
              onChange={update('department')}
              placeholder="예) 재활의학과"
              className="w-[308px]"
            />
          </FormRow>
        </FormTable>

        {/* 면허증 첨부 — 치료사만 */}
        {role === 'therapist' && (
          <>
            <div className="mt-12" />
            <SectionHeader title="치료사 면허증 첨부" />
            <FormTable>
              <FormRow label="치료사 자격 확인 파일" last>
                <div>
                  <FileDropRow
                    file={licenseFile}
                    dragging={licenseDragging}
                    inputRef={licenseInputRef}
                    onFile={setLicenseFile}
                    onDragging={setLicenseDragging}
                  />
                  <p className="mt-1 text-[12px] text-ink-400">* 치료사 자격을 증명할 수 있는 파일을 첨부해주세요.</p>
                </div>
              </FormRow>
            </FormTable>
          </>
        )}

        <div className="flex justify-center mt-12">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-[220px] h-[58px] rounded-[10px] text-[15px] font-semibold text-white transition ${
              canSubmit ? 'bg-brand hover:opacity-90' : 'bg-[#BFBFBF] cursor-not-allowed'
            }`}
          >
            회원가입 신청
          </button>
        </div>

        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={() => go({ name: 'signup-terms', role })}
            className="text-[12px] text-ink-500 hover:text-ink-900"
          >
            &lt; 이전으로
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------- */
/* Building blocks                    */
/* ---------------------------------- */

function RuleRow({ pass, text }: { pass: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-[12px] ${pass ? 'text-brand' : 'text-ink-400'}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        {pass ? (
          <>
            <circle cx="7" cy="7" r="7" fill="currentColor" opacity="0.15" />
            <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : (
          <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
        )}
      </svg>
      {text}
    </div>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-[20px] font-bold text-black mb-4">
      {title} <span className="text-[#FF5656]">*</span>
    </h2>
  )
}

function FormTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-b border-line">{children}</div>
  )
}

function FormRow({
  label,
  children,
  last = false
}: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={`grid grid-cols-[173px_1fr] items-center min-h-[88px] ${last ? '' : 'border-b border-line'}`}>
      <div className="bg-surface-chip h-full flex items-center px-5 text-[15px] font-medium text-black">
        {label}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function Input({
  className = '',
  error,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { error?: string }) {
  return (
    <div className={className}>
      <input
        {...rest}
        className="w-full h-[42px] px-3 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand"
      />
      {error && <div className="mt-1 text-[12px] text-brand-danger">{error}</div>}
    </div>
  )
}

function FileDropRow({
  file,
  dragging,
  inputRef,
  onFile,
  onDragging,
}: {
  file: File | null
  dragging: boolean
  inputRef: React.RefObject<HTMLInputElement>
  onFile: (f: File | null) => void
  onDragging: (v: boolean) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="h-[42px] px-4 flex items-center border border-line rounded-[7px] text-[13px] text-ink-600 hover:bg-surface-active cursor-pointer transition-colors shrink-0"
        >
          내PC
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={e => onFile(e.target.files?.[0] ?? null)}
        />
        <div
          onDragOver={e => { e.preventDefault(); onDragging(true) }}
          onDragLeave={() => onDragging(false)}
          onDrop={e => { e.preventDefault(); onDragging(false); onFile(e.dataTransfer.files[0] ?? null) }}
          onClick={() => inputRef.current?.click()}
          className={`flex-1 min-h-[64px] border border-dashed rounded-[7px] flex items-center justify-center text-[13px] transition-colors cursor-pointer ${
            dragging ? 'border-brand bg-brand/5 text-brand' : 'border-[#B1B1B1] text-ink-400'
          }`}
        >
          파일을 마우스로 끌어 오세요.
        </div>
      </div>
      {file && (
        <div className="flex items-center gap-2 text-[13px] text-ink-600">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2h5l3 3v6H2z" /><path d="M7 2v3h3" />
          </svg>
          <span className="flex-1 truncate">{file.name}</span>
          <span className="text-ink-300 shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
          <button
            type="button"
            onClick={() => onFile(null)}
            className="text-ink-300 hover:text-red-400 transition-colors shrink-0"
            aria-label="삭제"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

function OutlineButton({
  onClick,
  disabled,
  children,
  width
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
  width?: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={width ? { width } : undefined}
      className="h-[42px] px-3 rounded-[7px] border border-brand text-brand text-[15px] font-medium hover:bg-brand hover:text-white transition-colors disabled:border-ink-300 disabled:text-ink-300 disabled:hover:bg-transparent disabled:hover:text-ink-300 disabled:cursor-not-allowed shrink-0"
    >
      {children}
    </button>
  )
}
