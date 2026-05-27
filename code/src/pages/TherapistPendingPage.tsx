import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../lib/auth'
import { useRouter } from '../lib/router'

export default function TherapistPendingPage() {
  const { logout } = useAuth()
  const { go } = useRouter()

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-[240px] shrink-0 bg-white flex flex-col" style={{ boxShadow: '0px 0px 5px 0px rgba(0,0,0,0.25)' }}>
        <div className="h-[64px] flex items-center px-5">
          <BrandLogo size="sm" />
        </div>
      </aside>

      <div className="flex-1 flex flex-col relative">
        <header className="h-[64px] bg-white border-b border-[#DEDEDE] flex items-center justify-end px-8 shrink-0 z-10">
          <button
            type="button"
            onClick={logout}
            className="h-[36px] px-4 rounded-[5px] border border-[#005744] text-[14px] font-medium text-[#005744] hover:bg-[#005744] hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </header>

        <div className="flex-1 bg-[#252525]/50 flex flex-col items-center justify-center text-center px-4">
          <div className="w-[100px] h-[100px] rounded-full bg-[#D9D9D9] mb-8" />

          <h2 className="text-[35px] font-bold text-white leading-[50px] mb-3">
            치료사 인증 진행 중 입니다.
          </h2>
          <p className="text-[15px] text-white leading-[25px] mb-10">
            하이동동 관리자가 제출하신 자격 정보를 검토 중입니다.<br />
            승인이 완료되면 등록하신 휴대폰으로 안내드릴 예정입니다.
          </p>

          <button
            type="button"
            onClick={() => go({ name: 'support-list' })}
            className="w-[220px] h-[58px] rounded-[10px] border border-white text-white text-[18px] font-semibold hover:bg-white hover:text-[#252525] transition-colors"
          >
            1:1 문의함
          </button>
        </div>
      </div>
    </div>
  )
}
