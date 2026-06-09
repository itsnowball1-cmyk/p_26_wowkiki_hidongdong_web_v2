import { useEffect, useMemo, useRef, useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import Stepper from '../components/Stepper'
import { useRouter } from '../lib/router'
import { DupWarningModal } from './SignupFormPage'

declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: { roadAddress: string; jibunAddress: string; zonecode: string }) => void
      }) => { open: () => void }
    }
  }
}

type FormState = {
  institutionType: string
  institutionName: string
  businessRegNumber: string
  name: string
  phone: string
  phoneCode: string
  id: string
  password: string
  passwordConfirm: string
  address: string
  addressDetail: string
  directorName: string
  otherRequests: string
  doctorSheets: string
  therapistSheets: string
}

const INITIAL: FormState = {
  institutionType: '', institutionName: '', businessRegNumber: '',
  name: '', phone: '', phoneCode: '', id: '', password: '', passwordConfirm: '',
  address: '', addressDetail: '', directorName: '', otherRequests: '',
  doctorSheets: '', therapistSheets: '',
}

const INST_TYPES = ['병원', '치료센터', '그 외 기관'] as const
const SHEET_OPTIONS = ['1-10개', '11-20개', '21-30개', '31개 이상', '사용안함'] as const

type IdStatus = 'idle' | 'checking' | 'available' | 'taken' | 'error'

function validatePassword(pw: string) {
  const lengthOk = pw.length >= 8 && pw.length <= 16
  const categories = [/[A-Z]/.test(pw), /[a-z]/.test(pw), /[0-9]/.test(pw), /[^A-Za-z0-9]/.test(pw)].filter(Boolean).length
  return { valid: lengthOk && categories >= 2, lengthOk, comboOk: categories >= 2 }
}

export default function AdminSignupFormPage() {
  const { go } = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [idStatus, setIdStatus] = useState<IdStatus>('idle')
  const [phoneSent, setPhoneSent] = useState(false)
  const [phoneSending, setPhoneSending] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [timer, setTimer] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [certFile, setCertFile] = useState<File | null>(null)
  const [certDragging, setCertDragging] = useState(false)
  const certInputRef = useRef<HTMLInputElement>(null)
  const [showDupWarning, setShowDupWarning] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState('')

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current) }, [])

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const v = e.target.value
    setForm(p => ({ ...p, [k]: v }))
    if (k === 'id') setIdStatus('idle')
    if (k === 'phone') {
      setPhoneSent(false); setPhoneVerified(false); setPhoneError(''); setTimer(0)
      if (timerRef.current) clearInterval(timerRef.current)
    }
    if (k === 'phoneCode') { setPhoneVerified(false); setPhoneError('') }
  }

  const pwValidation = validatePassword(form.password)
  const passwordMatch = form.password.length > 0 && form.password === form.passwordConfirm

  const canSubmit = useMemo(() => Boolean(
    form.institutionType &&
    form.institutionName.trim() &&
    certFile !== null &&
    form.businessRegNumber.trim() &&
    form.name.trim() &&
    phoneVerified &&
    idStatus === 'available' &&
    pwValidation.valid &&
    passwordMatch &&
    form.address.trim() &&
    form.directorName.trim() &&
    form.doctorSheets &&
    form.therapistSheets
  ), [form, phoneVerified, idStatus, pwValidation.valid, passwordMatch, certFile])

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
    setPhoneSending(true); setPhoneError('')
    try {
      const res = await fetch('/api/auth/send-sms', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone })
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setPhoneError(data.error ?? 'SMS 발송에 실패했습니다.'); return }
      setPhoneSent(true); setPhoneVerified(false); startTimer()
    } catch { setPhoneError('서버 연결에 실패했습니다.') }
    finally { setPhoneSending(false) }
  }

  const handleVerifySms = async () => {
    const phone = form.phone.replace(/\D/g, '')
    const code = form.phoneCode.trim()
    if (!code) return setPhoneError('인증번호를 입력해주세요.')
    setPhoneError('')
    try {
      const res = await fetch('/api/auth/verify-sms', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, code })
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) { setPhoneError(data.error ?? '인증에 실패했습니다.'); return }
      setPhoneVerified(true); setTimer(0)
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    } catch { setPhoneError('서버 연결에 실패했습니다.') }
  }

  const handleCheckId = async () => {
    const id = form.id.trim()
    if (!id) return
    setIdStatus('checking')
    try {
      const res = await fetch(`/api/auth/check-id?id=${encodeURIComponent(id)}`)
      const data = await res.json() as { available?: boolean }
      setIdStatus(data.available ? 'available' : 'taken')
    } catch { setIdStatus('error') }
  }

  const openAddressSearch = () => {
    const launch = () => {
      new window.daum.Postcode({
        oncomplete: (data) => {
          setForm(p => ({ ...p, address: data.roadAddress || data.jibunAddress }))
        }
      }).open()
    }
    if (window.daum?.Postcode) {
      launch()
    } else {
      const script = document.createElement('script')
      script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
      script.onload = launch
      document.head.appendChild(script)
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitError('')
    try {
      let businessRegCertNm: string | null = null
      let businessRegCertData: string | null = null
      if (certFile) {
        businessRegCertNm = certFile.name
        const buf = await certFile.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        businessRegCertData = btoa(binary)
      }
      const res = await fetch('/api/auth/signup-admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          institutionType: form.institutionType,
          institutionName: form.institutionName.trim(),
          businessRegNumber: form.businessRegNumber.trim(),
          businessRegCertNm, businessRegCertData,
          name: form.name.trim(),
          phone: form.phone.trim(),
          id: form.id.trim(),
          pw: form.password,
          address: form.address.trim(),
          addressDetail: form.addressDetail.trim() || null,
          directorName: form.directorName.trim(),
          otherRequests: form.otherRequests.trim() || null,
          doctorSheets: form.doctorSheets,
          therapistSheets: form.therapistSheets,
        })
      })
      const data = await res.json() as { ok?: boolean; instt_code?: string; error?: string }
      if (!res.ok) { setSubmitError(data.error ?? '회원가입에 실패했습니다.'); return }
      setSubmitted(true)
    } catch { setSubmitError('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.') }
  }

  const fmtTimer = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const idStatusMsg =
    idStatus === 'available' ? '사용 가능한 아이디입니다.' :
    idStatus === 'taken' || idStatus === 'error' ? '이미 사용 중인 아이디 입니다.' : ''
  const idStatusColor = idStatus === 'available' ? 'text-brand' : 'text-brand-danger'

  if (submitted) {
    return (
      <>
      <div className="min-h-screen bg-white flex flex-col px-6 py-10">
        <div className="w-full max-w-[960px] mx-auto">
          <div className="mb-8"><BrandLogo size="md" /></div>
          <div className="mb-14"><Stepper current={3} /></div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-[120px] h-[120px] mb-8">
            <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
              <circle cx="60" cy="60" r="58" stroke="#005744" strokeWidth="4" fill="white" />
              <path d="M34 60l18 18 34-34" stroke="#005744" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h2 className="text-[35px] font-bold text-black mb-6 leading-[50px]">
            관리자 회원가입 완료
          </h2>
          <p className="text-[15px] text-[#141414] leading-[22px] mb-8 text-center">
            기관 인증 절차가 진행됩니다.<br />
            절차 완료 후 담당자에게 메시지를 통해 별도로 안내드릴 예정입니다.
          </p>
          <button
            type="button"
            onClick={() => go({ name: 'login' })}
            className="w-[420px] h-[58px] rounded-[10px] text-[18px] font-semibold bg-[#005744] text-white hover:opacity-90 transition"
          >
            로그인 바로가기
          </button>
        </div>
      </div>

      {showDupWarning && <DupWarningModal onClose={() => setShowDupWarning(false)} />}
      </>
    )
  }

  return (
    <>
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="max-w-[960px] mx-auto">
        <div className="mb-8"><BrandLogo size="md" /></div>
        <h1 className="text-[30px] font-bold text-ink-850 mb-10">회원가입</h1>
        <div className="mb-14"><Stepper current={2} /></div>

        {/* ── 기관 인증/가입 ────────────────────────── */}
        <SectionHeader title="기관 인증/가입" />
        <FormTable>
          <FormRow label="기관종류">
            <div className="flex gap-3 flex-wrap">
              {INST_TYPES.map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="institutionType"
                    value={t}
                    checked={form.institutionType === t}
                    onChange={() => setForm(p => ({ ...p, institutionType: t }))}
                    className="w-4 h-4 accent-brand"
                  />
                  <span className="text-[15px] text-ink-850">{t === '그 외 기관' ? '그 외 기관 (예: 보건소, 아동복지센터)' : t}</span>
                </label>
              ))}
            </div>
          </FormRow>

          <FormRow label="기관명">
            <TextInput
              value={form.institutionName}
              onChange={update('institutionName')}
              placeholder="기관명을 입력해주세요."
            />
          </FormRow>

          <FormRow label="사업자등록증 첨부">
            <div>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => certInputRef.current?.click()}
                  className="h-[42px] px-4 flex items-center border border-line rounded-[7px] text-[13px] text-ink-600 hover:bg-surface-active cursor-pointer transition-colors shrink-0"
                >
                  내PC
                </button>
                <input
                  ref={certInputRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => setCertFile(e.target.files?.[0] ?? null)}
                />
                <div
                  onDragOver={e => { e.preventDefault(); setCertDragging(true) }}
                  onDragLeave={() => setCertDragging(false)}
                  onDrop={e => { e.preventDefault(); setCertDragging(false); if (certFile) { setShowDupWarning(true); return } setCertFile(e.dataTransfer.files[0] ?? null) }}
                  onClick={() => certInputRef.current?.click()}
                  className={`flex-1 min-h-[64px] border border-dashed rounded-[7px] flex items-center justify-center text-[13px] transition-colors cursor-pointer ${
                    certDragging ? 'border-brand bg-brand/5 text-brand' : 'border-[#B1B1B1] text-ink-400'
                  }`}
                >
                  파일을 마우스로 끌어 오세요.
                </div>
              </div>
              {certFile && (
                <div className="mt-2 flex items-center gap-2 text-[13px] text-ink-600">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 2h5l3 3v6H2z" /><path d="M7 2v3h3" />
                  </svg>
                  <span className="flex-1 truncate">{certFile.name}</span>
                  <span className="text-ink-300 shrink-0">({(certFile.size / 1024).toFixed(1)} KB)</span>
                  <button type="button" onClick={() => setCertFile(null)} className="text-ink-300 hover:text-red-400 shrink-0" aria-label="삭제">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M3 3l8 8M11 3l-8 8" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </FormRow>

          <FormRow label="사업자등록번호" last>
            <TextInput
              value={form.businessRegNumber}
              onChange={update('businessRegNumber')}
              placeholder="000-00-00000"
              className="w-[308px]"
            />
          </FormRow>
        </FormTable>

        {/* ── 담당자 정보 입력 ────────────────────────── */}
        <div className="mt-12" />
        <SectionHeader title="담당자 정보 입력" />
        <FormTable>
          <FormRow label="이름">
            <TextInput value={form.name} onChange={update('name')} placeholder="이름을 입력해주세요." />
          </FormRow>

          <FormRow label="휴대전화">
            <div className="space-y-2">
              <div className="flex gap-2">
                <TextInput
                  value={form.phone}
                  onChange={update('phone')}
                  inputMode="numeric"
                  placeholder="'-' 제외하고 숫자만 입력해주세요."
                  className="flex-1"
                  disabled={phoneVerified}
                />
                <OutlineButton onClick={handleSendSms} disabled={!form.phone.trim() || phoneSending || phoneVerified} width={123}>
                  {phoneSending ? '발송 중…' : phoneSent ? '재발송' : '인증번호 발송'}
                </OutlineButton>
              </div>
              {phoneSent && !phoneVerified && (
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      value={form.phoneCode} onChange={update('phoneCode')} placeholder="인증번호 6자리 입력" maxLength={6}
                      className="w-full h-[42px] px-3 pr-14 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand"
                    />
                    {timer > 0 && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-brand-danger tabular-nums">{fmtTimer(timer)}</span>}
                    {timer === 0 && phoneSent && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-400">만료</span>}
                  </div>
                  <OutlineButton onClick={handleVerifySms} disabled={!form.phoneCode.trim() || timer === 0} width={104}>인증확인</OutlineButton>
                </div>
              )}
              {phoneVerified && <div className="text-[12px] text-brand">휴대전화 인증이 완료되었습니다.</div>}
              {phoneError && <div className="text-[12px] text-brand-danger">{phoneError}</div>}
            </div>
          </FormRow>

          <FormRow label="아이디">
            <div className="flex gap-2">
              <div className="flex-1">
                <TextInput value={form.id} onChange={update('id')} placeholder="아이디를 입력해주세요." />
                {idStatusMsg && <div className={`mt-1 text-[12px] ${idStatusColor}`}>{idStatusMsg}</div>}
              </div>
              <OutlineButton onClick={handleCheckId} disabled={!form.id.trim() || idStatus === 'checking' || idStatus === 'available'} width={110}>
                {idStatus === 'checking' ? '확인 중…' : idStatus === 'available' ? '확인 완료' : '중복확인'}
              </OutlineButton>
            </div>
          </FormRow>

          <FormRow label="비밀번호">
            <div>
              <input
                type="password" value={form.password} onChange={update('password')} placeholder="비밀번호를 입력해주세요."
                className="w-full h-[42px] px-3 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand"
              />
              {form.password.length > 0 ? (
                <div className="mt-2 space-y-1">
                  <RuleRow pass={pwValidation.lengthOk} text="8~16자" />
                  <RuleRow pass={pwValidation.comboOk} text="영문/숫자/특수문자 2가지 이상 조합" />
                </div>
              ) : (
                <div className="mt-1 text-[12px] text-ink-400">8~16자의 영문/숫자/특수문자 2가지 이상으로 조합해주세요.</div>
              )}
            </div>
          </FormRow>

          <FormRow label="비밀번호 확인">
            <div>
              <input
                type="password" value={form.passwordConfirm} onChange={update('passwordConfirm')} placeholder="위와 동일하게 입력해주세요."
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

        {/* ── 병원 정보 입력 ────────────────────────── */}
        <div className="mt-12" />
        <SectionHeader title="병원 정보 입력" />
        <FormTable>
          <FormRow label="기관 주소">
            <div className="space-y-2">
              <div className="flex gap-2">
                <TextInput value={form.address} onChange={update('address')} placeholder="주소를 입력해주세요." className="flex-1" />
                <OutlineButton onClick={openAddressSearch} width={104}>주소확인</OutlineButton>
              </div>
              <TextInput value={form.addressDetail} onChange={update('addressDetail')} placeholder="상세주소를 입력해주세요." />
            </div>
          </FormRow>

          <FormRow label="기관장 성함">
            <TextInput value={form.directorName} onChange={update('directorName')} placeholder="기관장 성함을 입력해주세요." />
          </FormRow>

          <FormRow label="기타 요청사항(선택)" last>
            <textarea
              value={form.otherRequests}
              onChange={update('otherRequests')}
              placeholder="기타 요청사항을 입력해주세요."
              rows={3}
              className="w-full px-3 py-2 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand resize-none"
            />
          </FormRow>
        </FormTable>

        {/* ── 활성화 시트 수 ────────────────────────── */}
        <div className="mt-12" />
        <SectionHeader title="활성화 시트 수" note="*회원가입 후 마이페이지에서 수정가능합니다." />
        <FormTable>
          <FormRow label="의사 시트수 선택">
            <SheetSelect value={form.doctorSheets} onChange={v => setForm(p => ({ ...p, doctorSheets: v }))} />
          </FormRow>
          <FormRow label="치료사 시트 수 선택" last>
            <SheetSelect value={form.therapistSheets} onChange={v => setForm(p => ({ ...p, therapistSheets: v }))} />
          </FormRow>
        </FormTable>

        {submitError && (
          <div className="mt-4 text-center text-[13px] text-brand-danger">{submitError}</div>
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
            다음단계
          </button>
        </div>

        <div className="flex justify-center mt-4">
          <button type="button" onClick={() => go({ name: 'signup-terms', role: 'admin' })} className="text-[12px] text-ink-500 hover:text-ink-900">
            &lt; 이전으로
          </button>
        </div>
      </div>
    </div>

    {showDupWarning && <DupWarningModal onClose={() => setShowDupWarning(false)} />}
    </>
  )
}

/* ── Building blocks ───────────────────────────────── */

function SheetSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {SHEET_OPTIONS.map(opt => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={`h-[38px] px-4 rounded-[7px] border text-[14px] font-medium transition-colors ${
            value === opt
              ? 'border-brand bg-brand text-white'
              : 'border-[#B1B1B1] text-ink-600 hover:border-brand hover:text-brand'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

function RuleRow({ pass, text }: { pass: boolean; text: string }) {
  return (
    <div className={`flex items-center gap-1.5 text-[12px] ${pass ? 'text-brand' : 'text-ink-400'}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        {pass ? (
          <><circle cx="7" cy="7" r="7" fill="currentColor" opacity="0.15" />
            <path d="M4 7l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>
        ) : <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />}
      </svg>
      {text}
    </div>
  )
}

function SectionHeader({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-[20px] font-bold text-black">
        {title} <span className="text-[#FF5656]">*</span>
        {note && <span className="ml-2 text-[13px] font-normal text-ink-400">{note}</span>}
      </h2>
    </div>
  )
}

function FormTable({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-b border-line">{children}</div>
}

function FormRow({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`grid grid-cols-[173px_1fr] items-start min-h-[88px] ${last ? '' : 'border-b border-line'}`}>
      <div className="bg-surface-chip h-full flex items-center px-5 text-[15px] font-medium text-black min-h-[88px]">
        {label}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function TextInput({
  className = '',
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      {...rest}
      className={`h-[42px] px-3 border border-[#B1B1B1] rounded-[7px] text-[15px] placeholder:text-[#C0C0C0] focus:outline-none focus:border-brand disabled:bg-[#F5F5F5] disabled:text-ink-400 ${className || 'w-full'}`}
    />
  )
}

function OutlineButton({ onClick, disabled, children, width }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; width?: number
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={width ? { width } : undefined}
      className="h-[42px] px-3 rounded-[7px] border border-brand text-brand text-[15px] font-medium hover:bg-brand hover:text-white transition-colors disabled:border-ink-300 disabled:text-ink-300 disabled:hover:bg-transparent disabled:hover:text-ink-300 disabled:cursor-not-allowed shrink-0"
    >
      {children}
    </button>
  )
}
