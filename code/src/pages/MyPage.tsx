import { useRef, useState, useEffect, useCallback } from 'react'
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import Modal, { ModalCloseButton } from '../components/Modal'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

const DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const
type Day = (typeof DAYS)[number]

function parseDiagDays(raw: string | null): Set<Day> {
  if (!raw) return new Set()
  return new Set(raw.split(',').filter((d): d is Day => (DAYS as readonly string[]).includes(d)))
}

export default function MyPage() {
  const { user, refreshUser } = useAuth()
  const [qrOpen, setQrOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const qrCanvasRef = useRef<HTMLDivElement>(null)

  const [editingProfile, setEditingProfile] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [phoneVerifyOpen, setPhoneVerifyOpen] = useState(false)
  const [phoneChangeOpen, setPhoneChangeOpen] = useState(false)

  const [name, setName] = useState(user?.name ?? '')
  const [department, setDepartment] = useState(user?.department ?? '')
  const [phone, setPhone] = useState<string | null>(null)
  const [instName, setInstName] = useState<string | null>(null)
  const [lastEdited, setLastEdited] = useState<string | null>(null)
  const [workingDays, setWorkingDays] = useState<Set<Day>>(new Set())
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)

  const loadMypage = useCallback(async () => {
    try {
      const data = await api.mypage()
      setPhone(data.phone)
      setInstName(data.instName)
      setLastEdited(data.updateDate)
      setWorkingDays(parseDiagDays(data.diagDays))
    } catch {
      // 로드 실패 시 조용히 넘어감
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMypage()
  }, [loadMypage])

  // user 컨텍스트에서 최신 이름/소속 동기화
  useEffect(() => {
    if (user?.name) setName(user.name)
    if (user?.department !== undefined) setDepartment(user.department ?? '')
  }, [user?.name, user?.department])

  if (!user) return null

  const handleDownloadQr = () => {
    const canvas = qrCanvasRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `${user.name}_QR코드.png`
    a.click()
  }

  const toggleDay = (d: Day) => {
    if (!editingSchedule) return
    setWorkingDays((p) => {
      const next = new Set(p)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  const handleSaveProfile = async () => {
    if (!editingProfile) {
      setEditingProfile(true)
      return
    }
    setSavingProfile(true)
    try {
      await api.updateMyProfile({ name, department })
      await refreshUser()
      setEditingProfile(false)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSaveSchedule = async () => {
    if (!editingSchedule) {
      setEditingSchedule(true)
      return
    }
    setSavingSchedule(true)
    try {
      const diagDays = [...workingDays].join(',') || null
      await api.updateMySchedule(diagDays)
      setEditingSchedule(false)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSavingSchedule(false)
    }
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
              {lastEdited && (
                <span className="text-[12px] text-ink-200">최종 정보 수정일시 : {lastEdited}</span>
              )}
            </div>
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile || loading}
              className="h-10 px-5 rounded-[5px] bg-brand text-white text-[14px] font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {savingProfile ? '저장 중…' : editingProfile ? '저장' : '정보 변경'}
            </button>
          </div>

          {/* 내 정보 테이블 */}
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
                <span>{department || '-'}</span>
              )}
            </Cell>

            {/* Row 2 */}
            <Cell label="휴대전화">
              <div className="flex items-center justify-between w-full">
                <span>{phone ?? (loading ? '…' : '-')}</span>
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
              <span>{loading ? '…' : (instName ?? user.institutionCode)}</span>
            </Cell>

            {/* Row 3 */}
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
              onClick={handleSaveSchedule}
              disabled={savingSchedule || loading}
              className="h-10 px-5 rounded-[5px] bg-brand text-white text-[14px] font-medium hover:opacity-90 transition disabled:opacity-60"
            >
              {savingSchedule ? '저장 중…' : editingSchedule ? '저장' : '수정'}
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
      <PasswordChangeModal open={pwOpen} onClose={() => setPwOpen(false)} onChanged={() => setLastEdited(new Date().toISOString().slice(0, 19).replace('T', ' '))} />

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
          setLastEdited(new Date().toISOString().slice(0, 19).replace('T', ' '))
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
  const [error, setError] = useState('')

  const handleNext = async () => {
    if (!password) return
    setChecking(true)
    setError('')
    try {
      await api.verifyMyPassword({ current_pw: password })
      setPassword('')
      onVerified()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '비밀번호가 일치하지 않습니다.')
    } finally {
      setChecking(false)
    }
  }

  const handleClose = () => {
    setPassword('')
    setError('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-[512px]">
      <ModalCloseButton onClose={handleClose} />
      <div className="px-[35px] pt-[78px] pb-[42px] flex flex-col min-h-[420px]">
        <div>
          <h2 className="text-[20px] font-bold text-[#2F2E2E]">비밀번호 확인</h2>
          <p className="text-[15px] font-medium text-[#2F2E2E] mt-2">
            보안을 위해 비밀번호를 입력해주세요.
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && handleNext()}
            placeholder="비밀번호를 입력해주세요."
            className="w-full h-[42px] px-[17px] border border-[#B1B1B1] rounded-[7px] text-[15px] mt-6 focus:outline-none focus:border-brand placeholder-[#C0C0C0]"
          />
          {error && <p className="text-red-500 text-[13px] mt-2">{error}</p>}
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
            onClick={handleNext}
            disabled={checking || !password}
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
  const [smsError, setSmsError] = useState('')
  const [verifyError, setVerifyError] = useState('')

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
    setSmsError('')
    try {
      await api.authSendSms(phoneInput)
      setCodeSent(true)
      setTimeLeft(300)
      setCodeInput('')
      setCodeVerified(false)
    } catch (e: unknown) {
      setSmsError(e instanceof Error ? e.message : 'SMS 발송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!codeInput) return
    setVerifying(true)
    setVerifyError('')
    try {
      await api.authVerifySms(phoneInput, codeInput)
      setCodeVerified(true)
    } catch (e: unknown) {
      setVerifyError(e instanceof Error ? e.message : '인증번호가 일치하지 않습니다.')
    } finally {
      setVerifying(false)
    }
  }

  const handleChange = async () => {
    if (!codeVerified) return
    setSaving(true)
    try {
      await api.changeMyPhone(phoneInput)
      onChanged(phoneInput)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : '전화번호 변경에 실패했습니다.')
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
    setSmsError('')
    setVerifyError('')
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
              onChange={(e) => { setPhoneInput(e.target.value); setSmsError('') }}
              placeholder="'-' 제외하고 숫자만 입력해주세요."
              className="w-[308px] h-[42px] px-[17px] border border-[#B1B1B1] rounded-[7px] text-[15px] focus:outline-none focus:border-brand placeholder-[#C0C0C0]"
            />
            <button
              type="button"
              onClick={handleSendCode}
              disabled={sending || !phoneInput}
              className="flex-1 h-[42px] border border-[#005744] text-[#005744] rounded-[7px] text-[15px] font-medium hover:bg-surface-active transition disabled:opacity-60"
            >
              {sending ? '발송 중…' : codeSent ? '재발송' : '인증번호 발송'}
            </button>
          </div>
          {smsError && <p className="text-red-500 text-[13px] mt-1">{smsError}</p>}

          {/* 인증번호 입력 + 인증확인 */}
          <div className="flex gap-[12px] mt-[14px]">
            <input
              type="text"
              value={codeInput}
              onChange={(e) => { setCodeInput(e.target.value); setVerifyError('') }}
              placeholder="인증번호를 입력해주세요."
              disabled={!codeSent || codeVerified}
              className="w-[192px] h-[42px] px-[17px] border border-[#B1B1B1] rounded-[7px] text-[15px] focus:outline-none focus:border-brand placeholder-[#C0C0C0] disabled:bg-[#F5F5F5]"
            />
            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={!codeSent || verifying || codeVerified || !codeInput}
              className="w-[104px] h-[42px] border border-[#005744] text-[#005744] rounded-[7px] text-[15px] font-medium hover:bg-surface-active transition disabled:opacity-40"
            >
              {codeVerified ? '확인됨' : verifying ? '확인 중…' : '인증확인'}
            </button>
          </div>
          {verifyError && <p className="text-red-500 text-[13px] mt-1">{verifyError}</p>}

          {/* 타이머 */}
          {codeSent && !codeVerified && (
            <div className="mt-[18px]">
              <div className="flex items-center gap-4 text-[15px] font-medium text-[#979797]">
                <span className={timeLeft <= 60 ? 'text-red-500' : ''}>남은 시간 {formatTime(timeLeft)}</span>
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={sending}
                  className="hover:text-[#555] transition disabled:opacity-60"
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

function PasswordChangeModal({ open, onClose, onChanged }: { open: boolean; onClose: () => void; onChanged: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    setError('')
    if (!current || !next || !confirm) {
      setError('모든 항목을 입력해주세요.')
      return
    }
    if (next !== confirm) {
      setError('새 비밀번호가 일치하지 않습니다.')
      return
    }
    setSaving(true)
    try {
      await api.changeMyPassword({ current_pw: current, pw: next })
      setCurrent('')
      setNext('')
      setConfirm('')
      onChanged()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '비밀번호 변경에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setCurrent('')
    setNext('')
    setConfirm('')
    setError('')
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose} className="w-[535px]">
      <ModalCloseButton onClose={handleClose} />
      <div className="px-[42px] pt-[37px] pb-8">
        <h2 className="text-[18px] font-semibold text-ink-900 mb-10">비밀번호 변경</h2>

        <div className="flex items-center">
          <span className="w-[123px] shrink-0 text-[15px] font-medium text-ink-900">현재 비밀번호</span>
          <input
            type="password"
            value={current}
            onChange={(e) => { setCurrent(e.target.value); setError('') }}
            className="w-[318px] h-10 px-3 border border-[#4C4C4C] rounded-[5px] text-[15px] focus:outline-none focus:border-brand"
          />
        </div>

        <div className="flex items-center mt-4">
          <span className="w-[123px] shrink-0 text-[15px] font-medium text-ink-900">새 비밀번호</span>
          <input
            type="password"
            value={next}
            onChange={(e) => { setNext(e.target.value); setError('') }}
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
            onChange={(e) => { setConfirm(e.target.value); setError('') }}
            className="w-[318px] h-10 px-3 border border-[#4C4C4C] rounded-[5px] text-[15px] focus:outline-none focus:border-brand"
          />
        </div>

        {error && <p className="text-red-500 text-[13px] mt-3 ml-[123px]">{error}</p>}

        <div className="mt-8 flex justify-center gap-4">
          <button
            type="button"
            onClick={handleClose}
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
