import BrandLogo from '../components/BrandLogo'
import { useRouter } from '../lib/router'
import type { Role } from '../lib/auth'

type Card = {
  role: Role
  title: string
  description: string
  Icon: () => JSX.Element
}

const CARDS: Card[] = [
  {
    role: 'admin',
    title: '관리자 회원',
    description: '병원당 하나의 계정만 보유 가능합니다.',
    Icon: AdminIcon
  },
  {
    role: 'doctor',
    title: '의사 회원',
    description: '의사 면허를 소지해야합니다.',
    Icon: DoctorIcon
  },
  {
    role: 'therapist',
    title: '치료사 회원',
    description: '치료사 면허를 소지해야합니다.',
    Icon: TherapistIcon
  }
]

export default function SignupPage() {
  const { go } = useRouter()

  const handlePick = (role: Role) => {
    go({ name: 'signup-terms', role })
  }

  return (
    <div className="min-h-screen bg-white relative px-6 py-8">
      {/* Top-right back link */}
      <button
        type="button"
        onClick={() => go({ name: 'login' })}
        className="absolute top-7 right-8 text-[12px] text-ink-900 hover:text-brand transition-colors"
      >
        이전으로 &gt;
      </button>

      <div className="max-w-[1640px] mx-auto">
        {/* Logo */}
        <div className="flex justify-center pt-6">
          <BrandLogo size="lg" />
        </div>

        {/* Heading */}
        <div className="text-center mt-12 space-y-2">
          <div className="text-[20px] font-medium text-ink-850">회원가입</div>
          <h1 className="text-[35px] font-bold text-ink-850 tracking-tight">가입 유형 선택</h1>
        </div>

        {/* Cards */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1100px] mx-auto">
          {CARDS.map((card) => (
            <button
              key={card.role}
              type="button"
              onClick={() => handlePick(card.role)}
              className="group bg-white border-2 border-brand rounded-[10px] h-[425px] flex flex-col items-center justify-center text-center px-6 transition-all hover:shadow-lg hover:-translate-y-1"
            >
              <div className="w-[162px] h-[162px] rounded-full bg-[#CFE4CE] flex items-center justify-center mb-8 transition-colors group-hover:bg-brand/20">
                <card.Icon />
              </div>
              <div className="text-[25px] font-semibold text-ink-850 mb-2">{card.title}</div>
              <div className="text-[15px] text-ink-700">{card.description}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function AdminIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <path
        d="M40 8 14 18v18c0 16 11.5 30.5 26 36 14.5-5.5 26-20 26-36V18L40 8Z"
        fill="#005744"
        opacity="0.92"
      />
      <path d="M30 40l8 8 14-16" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DoctorIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="28" r="12" fill="#005744" />
      <path
        d="M16 70c0-13 11-22 24-22s24 9 24 22"
        fill="#005744"
      />
      <rect x="36" y="46" width="8" height="20" fill="#FFFFFF" />
      <rect x="30" y="52" width="20" height="8" fill="#FFFFFF" />
    </svg>
  )
}

function TherapistIcon() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <path
        d="M14 22c0-4.4 3.6-8 8-8h36c4.4 0 8 3.6 8 8v22c0 4.4-3.6 8-8 8H38l-12 12V52h-4c-4.4 0-8-3.6-8-8V22Z"
        fill="#005744"
      />
      <circle cx="28" cy="33" r="3" fill="#FFFFFF" />
      <circle cx="40" cy="33" r="3" fill="#FFFFFF" />
      <circle cx="52" cy="33" r="3" fill="#FFFFFF" />
    </svg>
  )
}
