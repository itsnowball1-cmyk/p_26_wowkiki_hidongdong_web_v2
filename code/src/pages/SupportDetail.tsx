import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import RestrictedLayout from '../components/RestrictedLayout'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api, type SupportDetailDto } from '../lib/api'

const INQUIRY_TYPE_LABEL: Record<string, string> = {
  '01': '아동관리',
  '02': '전체 내진 일정',
  '03': '아동별 커스텀',
  '04': '마이페이지',
  '05': '기타',
}

export default function SupportDetail({ id }: { id: number }) {
  const { go } = useRouter()
  const { user } = useAuth()
  const [support, setSupport] = useState<SupportDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    api.supportDetail(id)
      .then(data => { if (!ignore) setSupport(data) })
      .catch(() => {})
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [id])

  const handleCancel = async () => {
    if (!window.confirm('문의를 취소하시겠습니까?')) return
    setCancelling(true)
    try {
      await api.supportCancel(id)
      go({ name: 'support-list' })
    } catch {
      window.alert('취소에 실패했습니다.')
      setCancelling(false)
    }
  }

  const isRestricted = user?.approvalStatus === 'pending' || user?.approvalStatus === 'rejected'

  const content = (
    <>
      <h1 className="text-[22px] font-bold mb-6">1:1 문의하기</h1>

      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded animate-pulse bg-line" />
          ))}
        </div>
      )}

      {!loading && !support && (
        <div className="text-center text-ink-400 py-20">문의를 찾을 수 없습니다.</div>
      )}

      {!loading && support && (
        <>
          {/* 문의 내용 */}
          <div className="w-full border border-line rounded-[5px] bg-white overflow-hidden">
            <table className="w-full text-[14px]">
              <tbody>
                {/* 이름 + 문의유형 (2열) */}
                <tr className="border-b border-line">
                  <td className="py-3 px-4 bg-surface font-medium text-ink-700 w-28 whitespace-nowrap">이름</td>
                  <td className="py-3 px-4 text-ink-700">{support.name}</td>
                  <td className="py-3 px-4 bg-surface font-medium text-ink-700 w-28 whitespace-nowrap border-l border-line">문의유형</td>
                  <td className="py-3 px-4 text-ink-700">{INQUIRY_TYPE_LABEL[support.s_type] ?? support.s_type}</td>
                </tr>
                <DetailRow label="이메일">{support.email || '-'}</DetailRow>
                <DetailRow label="문의날짜">{support.regist_date}</DetailRow>
                <DetailRow label="제목">{support.s_title}</DetailRow>
                <DetailRow label="내용">
                  <span className="whitespace-pre-wrap leading-relaxed">{support.memo}</span>
                </DetailRow>
                {support.question_files.length > 0 && (
                  <DetailRow label="첨부파일">
                    <div className="space-y-1.5">
                      {support.question_files.map(f => (
                        <div key={f.sf_idx} className="flex items-center gap-2 text-ink-600">
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M7 1v8M4 6l3 3 3-3M2 11h10" />
                          </svg>
                          <span className="text-[13px]">{f.source_file_nm}</span>
                        </div>
                      ))}
                    </div>
                  </DetailRow>
                )}
              </tbody>
            </table>
          </div>

          {/* 답변 내용 (answered) */}
          {support.reply_yn === 'Y' && (
            <div className="w-full mt-4 border border-line rounded-[5px] bg-white overflow-hidden">
              <div className="px-4 py-3 bg-surface border-b border-line">
                <span className="text-[15px] font-semibold text-ink-800">와우키키 답변 내용</span>
              </div>
              <table className="w-full text-[14px]">
                <tbody>
                  {support.answer_files.length > 0 && (
                    <DetailRow label="첨부파일">
                      <div className="space-y-1.5">
                        {support.answer_files.map(f => (
                          <div key={f.sf_idx} className="flex items-center gap-2 text-ink-600">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" />
                            </svg>
                            <span className="text-[13px]">{f.source_file_nm}</span>
                          </div>
                        ))}
                      </div>
                    </DetailRow>
                  )}
                  <DetailRow label="답변내용">
                    <span className="whitespace-pre-wrap leading-relaxed">{support.reply_memo}</span>
                  </DetailRow>
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex justify-center gap-3">
            {support.reply_yn !== 'Y' && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="w-36 h-11 border border-red-400 text-red-500 text-[15px] rounded-[5px] hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                {cancelling ? '처리 중...' : '문의취소'}
              </button>
            )}
            <button
              type="button"
              onClick={() => go({ name: 'support-list' })}
              className="w-36 h-11 border border-line text-[15px] text-ink-700 rounded-[5px] hover:bg-surface-active transition-colors"
            >
              목록으로
            </button>
          </div>
        </>
      )}
    </>
  )

  if (isRestricted) {
    return (
      <RestrictedLayout onBack={() => go({ name: 'support-list' })} backLabel="1:1 문의함으로 돌아가기">
        {content}
      </RestrictedLayout>
    )
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {user?.role === 'admin' ? <AdminSidebar /> : <Sidebar />}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8">{content}</main>
      </div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-3 px-4 bg-surface font-medium text-ink-700 w-28 align-top whitespace-nowrap">{label}</td>
      <td className="py-3 px-4 text-ink-700" colSpan={3}>{children}</td>
    </tr>
  )
}
