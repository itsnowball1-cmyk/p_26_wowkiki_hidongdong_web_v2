import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import Modal, { ModalCloseButton } from '../components/Modal'
import { useAuth, roleLabel } from '../lib/auth'

const DAYS = ['월', '화', '수', '목', '금', '토', '일'] as const
type Day = (typeof DAYS)[number]

export default function MyPage() {
  const { user } = useAuth()
  const [qrOpen, setQrOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(false)

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
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-10 py-8 max-w-[1640px]">
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
              {editingProfile ? (
                <InlineInput value={phone} onChange={setPhone} />
              ) : (
                <span>{phone}</span>
              )}
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
      <Modal open={qrOpen} onClose={() => setQrOpen(false)} className="w-[380px]">
        <ModalCloseButton onClose={() => setQrOpen(false)} />
        <div className="px-8 py-10 text-center">
          <h2 className="text-[18px] font-semibold text-ink-900 mb-1">
            {user.name} {roleLabel(user.role)}
          </h2>
          <div className="text-[13px] text-ink-500 mb-6">
            식별 코드: <span className="font-medium text-ink-900">{user.id}</span>
          </div>

          <div className="inline-block p-4 bg-white border border-line rounded-[10px]">
            <QRCodeSVG
              value={`hidongdong://assign?${user.role}=${user.id}&inst=${user.institutionCode}`}
              size={224}
              level="M"
              includeMargin={false}
            />
          </div>

          <p className="mt-6 text-[12px] text-ink-500 leading-relaxed">
            앱에서 회원가입 시 이 QR을 스캔하면<br />
            아동이 자동으로 본 계정에 배정됩니다.
          </p>

          <button
            type="button"
            onClick={() => setQrOpen(false)}
            className="mt-6 w-full h-10 rounded-[5px] bg-brand text-white text-[14px] font-medium hover:opacity-90 transition"
          >
            확인
          </button>
        </div>
      </Modal>

      {/* 비밀번호 변경 모달 */}
      <PasswordChangeModal open={pwOpen} onClose={() => setPwOpen(false)} />
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
    <Modal open={open} onClose={onClose} className="w-[420px]">
      <ModalCloseButton onClose={onClose} />
      <div className="px-8 py-8">
        <h2 className="text-[18px] font-semibold text-ink-900 mb-5 text-center">비밀번호 변경</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-[13px] font-medium text-ink-900 mb-1">현재 비밀번호</label>
            <input
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="w-full h-10 px-3 border border-line rounded-[5px] text-[14px] focus:outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-ink-900 mb-1">새 비밀번호</label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="w-full h-10 px-3 border border-line rounded-[5px] text-[14px] focus:outline-none focus:border-brand"
            />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-ink-900 mb-1">새 비밀번호 확인</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-10 px-3 border border-line rounded-[5px] text-[14px] focus:outline-none focus:border-brand"
            />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-10 rounded-[5px] border border-line text-ink-700 text-[14px] font-medium hover:border-ink-500"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 h-10 rounded-[5px] bg-brand text-white text-[14px] font-medium hover:opacity-90 transition disabled:opacity-60"
          >
            {saving ? '변경 중…' : '변경하기'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
