import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../lib/auth'
import { useRouter } from '../lib/router'

export default function InstitutionRejectedPage() {
  const { user, logout } = useAuth()
  const { go } = useRouter()

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 사이드바 */}
      <aside className="w-[240px] shrink-0 bg-white flex flex-col" style={{ boxShadow: '0px 0px 5px 0px rgba(0,0,0,0.25)' }}>
        <div className="h-[64px] flex items-center px-5">
          <BrandLogo size="sm" />
        </div>
      </aside>

      {/* 오른쪽 */}
      <div className="flex-1 flex flex-col relative">
        {/* 헤더 */}
        <header className="h-[64px] bg-white border-b border-[#DEDEDE] flex items-center justify-end px-8 shrink-0 z-10">
          <button
            type="button"
            onClick={logout}
            className="h-[36px] px-4 rounded-[5px] border border-[#005744] text-[14px] font-medium text-[#005744] hover:bg-[#005744] hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </header>

        {/* 다크 오버레이 */}
        <div className="flex-1 bg-[#252525]/50 flex flex-col items-center justify-center text-center px-4">
          {/* 아이콘 */}
          <div className="w-[100px] h-[100px] rounded-full bg-[#D9D9D9] mb-8" />

          <h2 className="text-[35px] font-bold text-white leading-[50px] mb-6">
            기관 인증이 <span className="text-[#FF9E9E]">반려</span> 되었습니다.
          </h2>

          {/* 반려 사유 테이블 */}
          {(user?.rejectTitle || user?.rejectReason) && (
            <div className="w-[647px] border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-8 text-left">
              <div className="grid grid-cols-[170px_1fr] border-b border-[#DEDEDE]">
                <div className="bg-[#EAEAEA] px-5 py-4 text-[18px] font-medium text-[#242424] flex items-center">제목</div>
                <div className="bg-white px-5 py-4 text-[18px] text-[#040404] flex items-center">{user?.rejectTitle || '-'}</div>
              </div>
              <div className="grid grid-cols-[170px_1fr]">
                <div className="bg-[#EAEAEA] px-5 py-4 text-[18px] font-medium text-[#242424] flex items-start">사유</div>
                <div className="bg-white px-5 py-4 text-[18px] text-[#040404] leading-relaxed">{user?.rejectReason || '-'}</div>
              </div>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex items-center gap-6 mb-6">
            <button
              type="button"
              onClick={() => go({ name: 'support-list' })}
              className="w-[220px] h-[58px] rounded-[10px] border border-white text-white text-[18px] font-semibold hover:bg-white/10 transition-colors"
            >
              문의하기
            </button>
            <button
              type="button"
              onClick={() => go({ name: 'iadmin-supplement' })}
              className="w-[220px] h-[58px] rounded-[10px] bg-[#005744] text-white text-[18px] font-semibold hover:bg-[#004535] transition-colors"
            >
              보완하기
            </button>
          </div>

          <button
            type="button"
            onClick={() => go({ name: 'support-list' })}
            className="text-white text-[18px] font-semibold underline underline-offset-4"
          >
            1:1 문의함
          </button>
        </div>
      </div>
    </div>
  )
}
