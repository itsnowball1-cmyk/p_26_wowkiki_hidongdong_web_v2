import { useRef, useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../lib/auth'
import { useRouter } from '../lib/router'

type RejectedUser = { id: string; name: string; institutionCode: string }

function loadRejectedUser(): RejectedUser | null {
  try {
    const raw = sessionStorage.getItem('rejected_user')
    if (!raw) return null
    return JSON.parse(raw) as RejectedUser
  } catch {
    return null
  }
}

export default function SignupSupplementPage() {
  const { go } = useRouter()
  const { user: authUser, logout } = useAuth()

  // 로그인 상태면 auth에서, 비로그인(가입 직후 반려)이면 sessionStorage에서 가져옴
  const fromSession = loadRejectedUser()
  const resolvedUser: RejectedUser | null = authUser
    ? { id: authUser.id, name: authUser.name, institutionCode: authUser.institutionCode ?? '' }
    : fromSession
  const [user] = useState<RejectedUser | null>(resolvedUser)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!file || !user) return
    setSubmitting(true)
    setError('')
    try {
      const buf = await file.arrayBuffer()
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      const license_file_data = btoa(binary)

      const res = await fetch('/api/auth/supplement', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: user.id, license_file_nm: file.name, license_file_data })
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? '제출에 실패했습니다.'); return }
      sessionStorage.removeItem('rejected_user')
      if (authUser) logout()
      setSubmitted(true)
    } catch {
      setError('서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-10 text-center">
        <div className="mb-8">
          <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
            <circle cx="60" cy="60" r="58" stroke="#005744" strokeWidth="4" fill="white" />
            <path d="M34 60l18 18 34-34" stroke="#005744" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="text-[35px] font-bold leading-[50px] mb-6">
          <span className="text-black">보완 서류 제출 완료</span><br />
          <span className="text-[#005744]">하이동동 관리자 승인 후 서비스를 이용하실 수 있습니다.</span>
        </h2>
        <div className="w-[460px] rounded-[10px] bg-[#EAF3EA] px-8 py-6 text-[16px] text-[#141414] leading-[26px]">
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
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="max-w-[960px] mx-auto">
        <div className="mb-12">
          <BrandLogo size="md" />
        </div>

        <SectionHeader title="치료사 정보" />
        <FormTable>
          <FormRow label="이름">
            <input
              readOnly
              value={user?.name ?? ''}
              className="w-full h-[42px] px-3 border border-[#B1B1B1] rounded-[7px] text-[15px] bg-[#C8C8C8] text-[#787878] cursor-not-allowed"
            />
          </FormRow>
          <FormRow label="기관코드" last>
            <input
              readOnly
              value={user?.institutionCode ?? ''}
              className="w-[308px] h-[42px] px-3 border border-[#B1B1B1] rounded-[7px] text-[15px] bg-[#C8C8C8] text-[#787878] cursor-not-allowed"
            />
          </FormRow>
        </FormTable>

        <div className="mt-12" />
        <SectionHeader title="치료사 면허증 첨부" />
        <FormTable>
          <FormRow label="치료사 자격 확인 파일" last>
            <div>
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
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); setFile(e.dataTransfer.files[0] ?? null) }}
                  onClick={() => inputRef.current?.click()}
                  className={`flex-1 min-h-[64px] border border-dashed rounded-[7px] flex items-center justify-center text-[13px] transition-colors cursor-pointer ${
                    dragging ? 'border-brand bg-brand/5 text-brand' : 'border-[#B1B1B1] text-ink-400'
                  }`}
                >
                  파일을 마우스로 끌어 오세요.
                </div>
              </div>
              {file && (
                <div className="mt-2 flex items-center gap-2 text-[13px] text-ink-600">
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 2h5l3 3v6H2z" /><path d="M7 2v3h3" />
                  </svg>
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-ink-300 shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-ink-300 hover:text-red-400 transition-colors shrink-0"
                    aria-label="삭제"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M3 3l8 8M11 3l-8 8" />
                    </svg>
                  </button>
                </div>
              )}
              <p className="mt-1 text-[12px] text-ink-400">* 치료사 자격을 증명할 수 있는 파일을 첨부해주세요.</p>
            </div>
          </FormRow>
        </FormTable>

        {error && (
          <div className="mt-4 text-center text-[13px] text-brand-danger">{error}</div>
        )}

        <div className="flex justify-center mt-12">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!file || submitting || !user}
            className={`w-[158px] h-[58px] rounded-[10px] text-[18px] font-semibold border transition ${
              file && !submitting && user
                ? 'border-[#005744] text-[#005744] bg-white hover:bg-[#005744] hover:text-white'
                : 'border-[#BFBFBF] text-[#BFBFBF] bg-white cursor-not-allowed'
            }`}
          >
            {submitting ? '제출 중…' : '제출하기'}
          </button>
        </div>
      </div>
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
  return <div className="border-t border-b border-line">{children}</div>
}

function FormRow({ label, children, last = false }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`grid grid-cols-[173px_1fr] items-center min-h-[88px] ${last ? '' : 'border-b border-line'}`}>
      <div className="bg-surface-chip h-full flex items-center px-5 text-[15px] font-medium text-black">
        {label}
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}
