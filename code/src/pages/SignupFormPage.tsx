import { useMemo, useState } from 'react'
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

export default function SignupFormPage({ role }: Props) {
  const { go } = useRouter()
  const [form, setForm] = useState<FormState>(INITIAL)
  const [idChecked, setIdChecked] = useState(false)
  const [phoneSent, setPhoneSent] = useState(false)
  const [phoneVerified, setPhoneVerified] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)

  const update = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    setForm((p) => ({ ...p, [k]: v }))
    // 값이 바뀌면 검증 상태 초기화
    if (k === 'id') setIdChecked(false)
    if (k === 'phone') {
      setPhoneSent(false)
      setPhoneVerified(false)
    }
    if (k === 'phoneCode') setPhoneVerified(false)
    if (k === 'email') setEmailVerified(false)
  }

  const passwordMatch = form.password.length > 0 && form.password === form.passwordConfirm

  const canSubmit = useMemo(() => {
    return (
      form.id.trim() &&
      idChecked &&
      passwordMatch &&
      form.name.trim() &&
      phoneVerified &&
      emailVerified &&
      form.institutionCode.trim() &&
      form.department.trim()
    )
  }, [form, idChecked, phoneVerified, emailVerified, passwordMatch])

  const handleSubmit = async () => {
    if (!canSubmit) return
    try {
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
          instt_code: form.institutionCode.trim(),
          depart_code: form.department.trim()
        })
      })
      const data = await res.json() as { ok?: boolean; code?: string; message?: string }
      if (!res.ok) {
        alert(data.message ?? '회원가입에 실패했습니다.')
        return
      }
      alert(`회원가입이 완료되었습니다.\n배정 코드: ${data.code}`)
      go({ name: 'login' })
    } catch {
      alert('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="max-w-[960px] mx-auto">
        {/* Logo */}
        <div className="mb-8">
          <BrandLogo size="md" />
        </div>

        {/* Title */}
        <h1 className="text-[30px] font-bold text-ink-850 mb-10">회원가입</h1>

        {/* Stepper */}
        <div className="mb-14">
          <Stepper current={2} />
        </div>

        {/* 로그인 정보 */}
        <SectionHeader title="로그인 정보" />
        <FormTable>
          <FormRow label="아이디">
            <div className="flex gap-2">
              <Input
                value={form.id}
                onChange={update('id')}
                placeholder="아이디를 입력해주세요."
                className="flex-1"
              />
              <OutlineButton
                onClick={() => {
                  if (!form.id.trim()) return alert('아이디를 입력해주세요.')
                  setIdChecked(true)
                  alert('사용 가능한 아이디입니다.')
                }}
                disabled={!form.id.trim() || idChecked}
                width={110}
              >
                {idChecked ? '확인 완료' : '중복확인'}
              </OutlineButton>
            </div>
          </FormRow>
          <FormRow label="비밀번호">
            <Input
              type="password"
              value={form.password}
              onChange={update('password')}
              placeholder="비밀번호를 입력해주세요."
            />
          </FormRow>
          <FormRow label="비밀번호 확인" last>
            <Input
              type="password"
              value={form.passwordConfirm}
              onChange={update('passwordConfirm')}
              placeholder="위와 동일하게 입력해주세요."
              error={form.passwordConfirm.length > 0 && !passwordMatch ? '비밀번호가 일치하지 않습니다.' : undefined}
            />
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
                />
                <OutlineButton
                  onClick={() => {
                    if (!form.phone.trim()) return alert('휴대전화 번호를 입력해주세요.')
                    setPhoneSent(true)
                    alert('인증번호가 발송되었습니다. (개발 모드: 아무 값이나 입력 후 인증확인)')
                  }}
                  disabled={!form.phone.trim()}
                  width={123}
                >
                  인증번호 발송
                </OutlineButton>
              </div>
              {phoneSent && (
                <div className="flex gap-2">
                  <Input
                    value={form.phoneCode}
                    onChange={update('phoneCode')}
                    placeholder="인증번호 입력"
                    className="flex-1"
                  />
                  <OutlineButton
                    onClick={() => {
                      if (!form.phoneCode.trim()) return alert('인증번호를 입력해주세요.')
                      setPhoneVerified(true)
                    }}
                    disabled={!form.phoneCode.trim() || phoneVerified}
                    width={104}
                  >
                    {phoneVerified ? '인증 완료' : '인증확인'}
                  </OutlineButton>
                </div>
              )}
            </div>
          </FormRow>

          <FormRow label="이메일">
            <div className="flex gap-2">
              <Input
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="이메일을 입력해주세요."
                className="flex-1"
              />
              <OutlineButton
                onClick={() => {
                  if (!form.email.includes('@')) return alert('올바른 이메일을 입력해주세요.')
                  setEmailVerified(true)
                  alert('이메일이 확인되었습니다.')
                }}
                disabled={!form.email.trim() || emailVerified}
                width={123}
              >
                {emailVerified ? '확인 완료' : '확인'}
              </OutlineButton>
            </div>
          </FormRow>

          <FormRow label="기관코드">
            <div className="flex items-center gap-4">
              <Input
                value={form.institutionCode}
                onChange={update('institutionCode')}
                placeholder="소속 기관코드를 입력해주세요."
                className="w-[308px]"
              />
              <span className="text-[12px] text-[#717171]">
                * 소속 기관이 여러곳일 경우 각각 계정 가입을 해야합니다.
              </span>
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

        {/* Next button */}
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
