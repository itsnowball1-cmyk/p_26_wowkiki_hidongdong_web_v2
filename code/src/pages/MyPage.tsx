import { useRef, useState, useEffect } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import Modal, { ModalCloseButton } from '../components/Modal'
import { useAuth } from '../lib/auth'

const DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const
type Day = (typeof DAYS)[number]

export default function MyPage() {
  const { user } = useAuth()
  const [qrOpen, setQrOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const qrCanvasRef = useRef<HTMLDivElement>(null)

  const handleDownloadQr = () => {
    const canvas = qrCanvasRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${user?.name ?? ''}\_QR코드.png`
    a.click()
  }
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [phoneVerifyOpen, setPhoneVerifyOpen] = useState(false)
  const [phoneChangeOpen, setPhoneChangeOpen] = useState(false)

  // 임시 사용자 데이터 — 실제로는 API/auth에서 가져옴
  const [name, setName] = useState(user?.name ?? '김아무개')
  const [phone, setPhone] = useState('010-1234-5678')
  const [email, setEmail] = useState('rlaclfy@dkssud.com')
  const [department, setDepartment] = useState(user?.department ?? '재활의학과')
  const [institutionName] = useState('OOOO병원')
  const [workingDays, setWorkingDays] = useState<Set<Day>>(new Set(['월', '수']))

  if (!user) return null

  const lastEdited = '2026-10-10 15:30'

  const toggleDay = (d: Day) => {
    if (!editingSchedule) return
    setWorkingDays((p) => {
      const next = new Set(p)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {user?.role === 'admin' ? <AdminSidebar /> : <Sidebar />}

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-10 py-8">
          {/* 내 정보 헤더 */}
          <div className="flex items-end justify-between mb-4">
            <div className="flex items-baseline gap-4">
              <h2 className="text-[18px] font-semibold text-ink-900">내 정보</h2>
              <span className="text-[12px] text-ink-200">최종 정보 수정일시 : {lastEdited}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (editingProfile) {
                  alert('변경 내용이 저장되었습니다.')
                }
                setEditingProfile((v) => !v)
              }}
              className="h-10 px-5 rounded-[5px] bg-brand text-white text-[14px] font-medium hover:opacity-90 transition"
            >
              {editingProfile ? '저장' : '정보 변경'}
            </button>
          </div>

          {/* 내 정보 테이블 — 4행 × 2 컬럼쌍 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 border border-line bg-surface-card overflow-hidden rounded-md">
            {/* Row 1 */}
            <Cell label="이름">
              {editingProfile ? (
                <InlineInput value={name} onChange={setName} />
              ) : (
                <span>{name}</span>
              )}
            </Cell>
            <Cell label="소속">
              {editingProfile ? (
                <InlineInput value={department} onChange={setDepartment} />
              ) : (
                <span>{department}</span>
              )}
            </Cell>

            {/* Row 2 */}
            <Cell label="휴대전화">
              <div className="flex items-center justify-between w-full">
                <span>{phone}</span>
                <button
                  type="button"
                  onClick={() => setPhoneVerifyOpen(true)}
                  className="h-[34px] px-4 rounded-[5px] border border-brand text-brand text-[13px] font-medium hover:bg-brand hover:text-white transition-colors"
                >
                  변경
                </button>
              </div>
            </Cell>
            <Cell label="기관정보">
              <span>{institutionName}</span>
            </Cell>

            {/* Row 3 */}
            <Cell label="이메일">
              {editingProfile ? (
                <InlineInput value={email} onChange={setEmail} type="email" />
              ) : (
                <span>{email}</span>
              )}
            </Cell>
            <Cell label="내 식별 코드 확인">
              <div className="flex items-center justify-between gap-3 w-full">
                <span className="text-ink-900">{user.id}</span>
                <button
                  type="button"
                  onClick={() => setQrOpen(true)}
                  className="h-10 px-4 rounded-[5px] border border-brand text-brand text-[14px] font-medium hover:bg-brand hover:text-white transition-colors whitespace-nowrap"
                >
                  QR 발급 받기
                </button>
              </div>
            </Cell>

            {/* Row 4 */}
            <Cell label="비밀번호">
              <div className="flex items-center gap-2">
                <span className="text-ink-700 tracking-widest">••••••••</span>
                <button
                  type="button"
                  onClick={() => setPwOpen(true)}
                  className="h-[34px] px-4 rounded-[5px] border border-brand text-brand text-[13px] font-medium hover:bg-brand hover:text-white transition-colors"
                >
                  변경
                </button>
              </div>
            </Cell>
            <Cell label="" empty />
          </div>

          {/* 근무 일정 헤더 */}
          <div className="flex items-end justify-between mt-12 mb-4">
            <h2 className="text-[18px] font-semibold text-ink-900">근무 일정</h2>
            <button
              type="button"
              onClick={() => {
                if (editingSchedule) {
                  alert('근무 일정이 저장되었습니다.')
                }
                setEditingSchedule((v) => !v)
              }}
              className="h-10 px-5 rounded-[5px] bg-brand text-white text-[14px] font-medium hover:opacity-90 transition"
            >
              {editingSchedule ? '저장' : '수정'}
            </button>
          </div>

          {/* 근무 일정 카드 */}
          <div className="bg-[#EAEAEA] border border-line rounded-[10px] h-[89px] flex items-center px-10">
            <div className="flex items-center gap-[33px]">
              {DAYS.map((d) => {
                const active = workingDays.has(d)
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    disabled={!editingSchedule}
                    className={`w-[45px] h-[45px] rounded-[5px] grid place-items-center text-[15px] transition-colors ${
                      active
                        ? 'bg-[#57987E] text-white'
                        : 'bg-white text-[#B2B2B2]'
                    } ${editingSchedule ? 'cursor-pointer hover:opacity-90' : 'cursor-default'}`}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="pb-12" />
        </main>
      </div>

      {/* QR 모달 */}
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} className="w-[360px]">
        <ModalCloseButton onClose={() => setQrOpen(false)} />
        <div className="px-10 pt-10 pb-8 text-center">
          <h2 className="text-[20px] font-semibold text-ink-900 mb-8">
            {user.name} 님 QR코드
          </h2>

          <div className="flex justify-center mb-8">
            <QRCodeSVG
              value={`hidongdong://assign?${user.role}=${user.id}&inst=${user.institutionCode}`}
              size={200}
              level="M"
            />
          </div>

          {/* PNG 다운로드용 숨김 캔버스 */}
          <div ref={qrCanvasRef} className="hidden">
            <QRCodeCanvas
              value={`hidongdong://assign?${user.role}=${user.id}&inst=${user.institutionCode}`}
              size={400}
              level="M"
            />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={handleDownloadQr}
              className="w-full h-[52px] rounded-[8px] bg-[#005744] text-white text-[16px] font-medium hover:opacity-90 transition"
            >
              PNG로 다운받기
            </button>
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              className="w-full h-[52px] rounded-[8px] border border-[#CCCCCC] text-ink-900 text-[16px] font-medium hover:bg-surface-active transition"
            >
              확인
            </button>
          </div>
        </div>
      </Modal>

      {/* 비밀번호 변경 모달 */}
      <PasswordChangeModal open={pwOpen} onClose={() => setPwOpen(false)} />

      {/* 휴대전화 변경 - 1단계: 비밀번호 확인 */}
      <PhoneVerifyPasswordModal
        open={phoneVerifyOpen}
        onClose={() => setPhoneVerifyOpen(false)}
        onVerified={() => {
          setPhoneVerifyOpen(false)
          setPhoneChangeOpen(true)
        }}
      />

      {/* 휴대전화 변경 - 2단계: 새 번호 + 인증 */}
      <PhoneChangeModal
        open={phoneChangeOpen}
        onClose={() => setPhoneChangeOpen(false)}
        onChanged={(newPhone) => {
          setPhone(newPhone)
          setPhoneChangeOpen(false)
        }}
      />
    </div>
  )
}

function Cell({
  label,
  children,
  empty = false
}: {
  label: string
  children?: React.ReactNode
  empty?: boolean
}) {
  return (
    <div className="grid grid-cols-[297px_1fr] border-b border-line last:border-b-0 lg:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-child(odd)]:border-r lg:border-line">
      <div className="bg-line-soft min-h-[52px] flex items-center justify-center text-[15px] font-medium text-ink-900">
        {label}
      </div>
      <div className="bg-surface-card min-h-[52px] flex items-center px-6 text-[15px] text-ink-900">
        {empty ? <span className="text-transparent select-none">-</span> : children}
      </div>
    </div>
  )
}

function InlineInput({
  value,
  onChange,
  type = 'text'
}: {
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-9 px-3 border border-line rounded-[5px] text-[15px] focus:outline-none focus:border-brand"
    />
  )
}

function PhoneVerifyPasswordModal({
  open,
  onClose,
  onVerified,
}: {
  open: boolean
  onClose: () => void
  onVerified: () => void
}) {
  const [password, setPassword] = useState('')
  const [checking, setChecking] = useState(false)

  const handleNext = async () => {
    if (!password) return
    setChecking(true)
    try {
      await new Promise((r) => setTimeout(r, 400))
      setPassword('')
      onVerified()
    } finally {
      setChecking(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} className="w-[512px]">
      <ModalCloseButton onClose={onClose} />
      <div className="px-[35px] pt-[78px] pb-[42px] flex flex-col min-h-[420px]">
        <div>
          <h2 className="text-[20px] font-bold text-[#2F2E2E]">비밀번호 확인</h2>
          <p className="text-[15px] font-medium text-[#2F2E2E] mt-2">
            보안을 위해 비밀번호를 입력해주세요.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            placeholder="비밀번호를 입력해주세요."
            className="w-full h-[42px] px-[17px] border border-[#B1B1B1] rounded-[7px] text-[15px] mt-6 focus:outline-none focus:border-brand placeholder-[#C0C0C0]"
          />
        </div>
        <div className="mt-auto flex justify-center gap-[14px]">
          <button
            type="button"
            onClick={onClose}
            className="w-[125px] h-10 rounded-[5px] border border-[#005744] text-[#005744] text-[15px] font-medium hover:bg-surface-active transition"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={checking}
            className="w-[125px] h-10 rounded-[5px] bg-[#005744] text-white text-[15px] font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {checking ? '확인 중…' : '다음'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function PhoneChangeModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  onChanged: (newPhone: string) => void
}) {
  const [phoneInput, setPhoneInput] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [codeVerified, setCodeVerified] = useState(false)
  const [timeLeft, setTimeLeft] = useState(300)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!codeSent || codeVerified || timeLeft <= 0) return
    const t = setTimeout(() => setTimeLeft((n) => n - 1), 1000)
    return () => clearTimeout(t)
  }, [codeSent, codeVerified, timeLeft])

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleSendCode = async () => {
    if (!phoneInput) return
    setSending(true)
    try {
      await new Promise((r) => setTimeout(r, 400))
      setCodeSent(true)
      setTimeLeft(300)
    } finally {
      setSending(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!codeInput) return
    setVerifying(true)
    try {
      await new Promise((r) => setTimeout(r, 400))
      setCodeVerified(true)
    } finally {
      setVerifying(false)
    }
  }

  const handleChange = async () => {
    if (!codeVerified) return
    setSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 400))
      onChanged(phoneInput)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setPhoneInput('')
    setCodeInput('')
    setCodeSent(false)
    setCodeVerified(false)
    setTimeLeft(300)
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-[512px]">
      <ModalCloseButton onClose={handleClose} />
      <div className="px-[35px] pt-[78px] pb-[42px] flex flex-col min-h-[420px]">
        <div>
          <h2 className="text-[20px] font-bold text-[#2F2E2E]">휴대전화 변경</h2>

          {/* 전화번호 입력 + 인증번호 발송 */}
          <div className="flex gap-[11px] mt-[25px]">
            <input
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="'-' 제외하고 숫자만 입력해주세요."
              className="w-[308px] h-[42px] px-[17px] border border-[#B1B1B1] rounded-[7px] text-[15px] focus:outline-none focus:border-brand placeholder-[#C0C0C0]"
            />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sending}
              className="flex-1 h-[42px] border border-[#005744] text-[#005744] rounded-[7px] text-[15px] font-medium hover:bg-surface-active transition disabled:opacity-60"
            >
              {sending ? '발송 중…' : '인증번호 발송'}
            </button>
          </div>

          {/* 인증번호 입력 + 인증확인 */}
          <div className="flex gap-[12px] mt-[14px]">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="인증번호를 입력해주세요."
              disabled={!codeSent}
              className="w-[192px] h-[42px] px-[17px] border border-[#B1B1B1] rounded-[7px] text-[15px] focus:outline-none focus:border-brand placeholder-[#C0C0C0] disabled:bg-[#F5F5F5]"
            />
            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={!codeSent || verifying || codeVerified}
              className="w-[104px] h-[42px] border border-[#005744] text-[#005744] rounded-[7px] text-[15px] font-medium hover:bg-surface-active transition disabled:opacity-40"
            >
              {codeVerified ? '확인됨' : verifying ? '확인 중…' : '인증확인'}
            </button>
          </div>

          {/* 타이머 */}
          {codeSent && (
            <div className="mt-[18px]">
              <div className="flex items-center gap-4 text-[15px] font-medium text-[#979797]">
                <span>남은 시간 {formatTime(timeLeft)}</span>
                <button
                  type="button"
                  onClick={() => setTimeLeft(300)}
                  className="hover:text-[#555] transition"
                >
                  시간연장
                </button>
              </div>
              <div className="mt-[27px] border-t border-[#979797] w-[48px]" />
            </div>
          )}
        </div>

        <div className="mt-auto flex justify-center gap-[14px]">
          <button
            type="button"
            onClick={handleClose}
            className="w-[125px] h-10 rounded-[5px] border border-[#005744] text-[#005744] text-[15px] font-medium hover:bg-surface-active transition"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleChange}
            disabled={!codeVerified || saving}
            className="w-[125px] h-10 rounded-[5px] bg-[#005744] text-white text-[15px] font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {saving ? '변경 중…' : '변경'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function PasswordChangeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!current || !next || !confirm) {
      alert('모든 항목을 입력해주세요.')
      return
    }
    if (next !== confirm) {
      alert('새 비밀번호가 일치하지 않습니다.')
      return
    }
    setSaving(true)
    try {
      await new Promise((r) => setTimeout(r, 400))
      alert('비밀번호가 변경되었습니다.')
      setCurrent('')
      setNext('')
      setConfirm('')
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} className="w-[535px]">
      <ModalCloseButton onClose={onClose} />
      <div className="px-[42px] pt-[37px] pb-8">
        <h2 className="text-[18px] font-semibold text-ink-900 mb-10">비밀번호 변경</h2>

        <div className="flex items-center">
          <span className="w-[123px] shrink-0 text-[15px] font-medium text-ink-900">현재 비밀번호</span>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-[318px] h-10 px-3 border border-[#4C4C4C] rounded-[5px] text-[15px] focus:outline-none focus:border-brand"
          />
        </div>

        <div className="flex items-center mt-4">
          <span className="w-[123px] shrink-0 text-[15px] font-medium text-ink-900">새 비밀번호</span>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            className="w-[318px] h-10 px-3 border border-[#4C4C4C] rounded-[5px] text-[15px] focus:outline-none focus:border-brand"
          />
        </div>

        <div className="flex mt-[7px]">
          <div className="w-[123px] shrink-0" />
          <p className="text-[10px] font-medium text-[#B1B1B1]">
            (영문 대소문자/숫자/특수문자 중 2가지 이상 조합, 10자~16자 사이)
          </p>
        </div>

        <div className="flex items-center mt-[13px]">
          <span className="w-[123px] shrink-0 text-[15px] font-medium text-ink-900">새 비밀번호 확인</span>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-[318px] h-10 px-3 border border-[#4C4C4C] rounded-[5px] text-[15px] focus:outline-none focus:border-brand"
          />
        </div>

        <div className="mt-8 flex justify-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="w-[125px] h-[34px] rounded-[5px] border border-[#005744] text-[#005744] text-[15px] font-medium hover:bg-surface-active transition"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-[125px] h-[34px] rounded-[5px] bg-[#005744] text-white text-[15px] font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {saving ? '변경 중…' : '변경'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
