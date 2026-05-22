import BrandLogo from '../components/BrandLogo'
import Stepper from '../components/Stepper'
import { useRouter } from '../lib/router'

export default function SignupRejectedPage() {
  const { go } = useRouter()

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
        {/* 경고 삼각형 아이콘 */}
        <div className="relative flex items-center justify-center w-[135px] h-[135px] mb-8">
          <svg width="135" height="135" viewBox="0 0 135 135" fill="none" className="absolute inset-0">
            <path
              d="M67.5 14L123 119H12L67.5 14Z"
              fill="white"
              stroke="#FF7070"
              strokeWidth="5.5"
              strokeLinejoin="round"
            />
          </svg>
          <span className="relative mt-8 text-[54px] font-bold text-[#FF7070] leading-none select-none">!</span>
        </div>

        <h2 className="text-[35px] font-bold text-black leading-[50px] mb-6">
          치료사 인증이 <span className="text-[#FF7070]">반려</span> 되었습니다.
        </h2>

        <div className="w-[460px] rounded-[10px] bg-[#EAF3EA] px-8 py-6 text-[16px] text-[#141414] leading-[26px] text-center">
          제출하신 자격 정보를 확인할 수 없어 인증이 반려되었습니다.<br />
          정보를 다시 확인 후 재등록해주세요.
        </div>

        <button
          type="button"
          onClick={() => go({ name: 'signup-supplement' })}
          className="mt-10 w-[158px] h-[58px] rounded-[10px] text-[18px] font-semibold bg-[#005744] text-white hover:opacity-90 transition"
        >
          보완하기
        </button>
      </div>
    </div>
  )
}
