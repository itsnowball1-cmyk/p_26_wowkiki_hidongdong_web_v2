import { useRef, useState } from 'react'
import RestrictedLayout from '../components/RestrictedLayout'
import { useAuth } from '../lib/auth'
import { useRouter } from '../lib/router'
import { DupWarningModal } from './SignupFormPage'

const INST_TYPES = ['병원', '치료센터', '그 외 기관 (예: 보건소, 아동복지센터)'] as const
const SEAT_OPTIONS = ['사용안함', '1-10개', '11-20개', '21-30개', '31개 이상'] as const

export default function IadminSupplementPage() {
  const { user, logout } = useAuth()
  const { go } = useRouter()

  const [instType, setInstType] = useState(INST_TYPES[0])
  const [instName, setInstName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [showDupWarning, setShowDupWarning] = useState(false)
  const [doctorSeats, setDoctorSeats] = useState(SEAT_OPTIONS[0])
  const [therapistSeats, setTherapistSeats] = useState(SEAT_OPTIONS[0])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async () => {
    if (!user) return
    setSubmitting(true)
    setError('')
    try {
      let certNm: string | undefined
      let certData: string | undefined
      if (file) {
        const buf = await file.arrayBuffer()
        const bytes = new Uint8Array(buf)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
        certData = btoa(binary)
        certNm = file.name
      }
      const res = await fetch('/api/auth/iadmin-supplement', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: user.id,
          institutionType: instType,
          institutionName: instName || undefined,
          businessRegCertNm: certNm,
          businessRegCertData: certData,
          doctorSheets: doctorSeats,
          therapistSheets: therapistSeats,
        }),
      })
      const data = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(data.error ?? '제출에 실패했습니다.'); return }
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
          onClick={logout}
          className="mt-10 w-[158px] h-[58px] rounded-[10px] text-[18px] font-semibold bg-[#005744] text-white hover:opacity-90 transition"
        >
          확인
        </button>
      </div>
    )
  }

  return (
    <>
    <RestrictedLayout onBack={() => go({ name: 'list' })}>
      <div className="max-w-[960px] mx-auto">
        {/* 반려 사유 */}
        {(user?.rejectTitle || user?.rejectReason) && (
          <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-10">
            <div className="grid grid-cols-[170px_1fr] border-b border-[#DEDEDE]">
              <div className="bg-[#EAEAEA] px-5 py-4 text-[15px] font-medium text-[#333333] flex items-center">제목</div>
              <div className="bg-white px-5 py-4 text-[18px] text-[#040404]">{user?.rejectTitle || '-'}</div>
            </div>
            <div className="grid grid-cols-[170px_1fr]">
              <div className="bg-[#EAEAEA] px-5 py-4 text-[15px] font-medium text-[#333333] flex items-start">사유</div>
              <div className="bg-white px-5 py-4 text-[18px] text-[#040404] leading-relaxed">{user?.rejectReason || '-'}</div>
            </div>
          </div>
        )}

        {/* 기관 인증/가입 */}
        <h2 className="text-[20px] font-bold text-black mb-4">
          기관 인증/가입 <span className="text-[#FF5656]">*</span>
        </h2>
        <div className="border-t border-b border-[#C0C0C0]">
          {/* 기관 종류 */}
          <div className="grid grid-cols-[173px_1fr] border-b border-[#C0C0C0]">
            <div className="bg-[#EAEAEA] px-5 py-4 text-[15px] font-medium text-black flex items-center">기관종류</div>
            <div className="px-5 py-4 flex flex-col gap-2">
              {INST_TYPES.map(t => (
                <label key={t} className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setInstType(t)}
                    className={`w-[23px] h-[23px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                      instType === t ? 'border-[#005744] bg-[#005744]' : 'border-[#AEAEAE] bg-white'
                    }`}
                  >
                    {instType === t && <span className="w-[9px] h-[9px] rounded-full bg-white" />}
                  </button>
                  <span className="text-[15px] text-[#353535]">{t}</span>
                </label>
              ))}
            </div>
          </div>
          {/* 기관명 */}
          <div className="grid grid-cols-[173px_1fr] border-b border-[#C0C0C0]">
            <div className="bg-[#EAEAEA] px-5 py-4 text-[15px] font-medium text-black flex items-center">기관명</div>
            <div className="px-5 py-4">
              <input
                type="text"
                value={instName}
                onChange={e => setInstName(e.target.value)}
                placeholder="기관명을 입력해주세요."
                className="w-[308px] h-[42px] px-3 border border-[#B1B1B1] rounded-[7px] text-[15px] outline-none focus:border-[#005744] placeholder:text-[#AEAEAE]"
              />
            </div>
          </div>
          {/* 사업자등록증 */}
          <div className="grid grid-cols-[173px_1fr]">
            <div className="bg-[#EAEAEA] px-5 py-4 text-[15px] font-medium text-black flex items-center">사업자등록증 첨부</div>
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="h-[42px] px-4 border border-[#B1B1B1] rounded-[7px] text-[13px] text-[#535353] hover:bg-[#F5F5F5] shrink-0"
                >
                  내PC
                </button>
                <input ref={inputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); if (file) { setShowDupWarning(true); return } setFile(e.dataTransfer.files[0] ?? null) }}
                  onClick={() => inputRef.current?.click()}
                  className={`flex-1 min-h-[83px] border rounded-[7px] flex items-center justify-center text-[13px] cursor-pointer transition-colors ${
                    dragging ? 'border-[#005744] bg-[#005744]/5 text-[#005744]' : 'border-[#B1B1B1] text-[#AEAEAE]'
                  }`}
                >
                  {file ? file.name : '파일을 마우스로 끌어 오세요.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 활성화 시트 수 */}
        <h2 className="text-[20px] font-bold text-black mt-10 mb-1">
          활성화 시트 수 <span className="text-[#FF5656]">*</span>
          <span className="text-[14px] font-medium text-[#707070] ml-2">*회원가입 후 마이페이지에서 수정가능합니다.</span>
        </h2>
        <div className="border-t border-b border-[#C0C0C0] mt-4">
          {[
            { label: '의사 시트수 선택', value: doctorSeats, setter: setDoctorSeats },
            { label: '치료사 시트 수 선택', value: therapistSeats, setter: setTherapistSeats },
          ].map(({ label, value, setter }, idx) => (
            <div key={label} className={`grid grid-cols-[173px_1fr] ${idx === 0 ? 'border-b border-[#C0C0C0]' : ''}`}>
              <div className="bg-[#EAEAEA] px-5 py-4 text-[15px] font-medium text-black flex items-center">{label}</div>
              <div className="px-5 py-4 flex flex-wrap gap-4">
                {SEAT_OPTIONS.map(opt => (
                  <label key={opt} className="flex items-center gap-2 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => setter(opt)}
                      className={`w-[23px] h-[23px] rounded-full border-2 flex items-center justify-center shrink-0 ${
                        value === opt ? 'border-[#005744] bg-[#005744]' : 'border-[#AEAEAE] bg-white'
                      }`}
                    >
                      {value === opt && <span className="w-[9px] h-[9px] rounded-full bg-white" />}
                    </button>
                    <span className="text-[15px] text-[#353535]">{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="mt-4 text-center text-[13px] text-red-500">{error}</div>}

        <div className="flex justify-center mt-12">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className={`w-[220px] h-[58px] rounded-[10px] text-[18px] font-semibold transition-colors ${
              submitting
                ? 'bg-[#BFBFBF] text-white cursor-not-allowed'
                : 'bg-[#005744] text-white hover:bg-[#004535]'
            }`}
          >
            {submitting ? '제출 중…' : '제출하기'}
          </button>
        </div>
      </div>
    </RestrictedLayout>

    {showDupWarning && <DupWarningModal onClose={() => setShowDupWarning(false)} />}
    </>
  )
}
