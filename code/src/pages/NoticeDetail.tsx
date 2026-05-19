import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api, type NoticeDetailDto } from '../lib/api'

export default function NoticeDetail({ id }: { id: number }) {
  const { go } = useRouter()
  const { user } = useAuth()
  const [notice, setNotice] = useState<NoticeDetailDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    api.noticeDetail(id)
      .then(data => {
        if (ignore) return
        setNotice({ ...data, BOARD_READ_COUNT: data.BOARD_READ_COUNT + 1 })
        api.recordNoticeView(id).catch(() => {})
      })
      .catch(() => {})
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [id])

  return (
    <div className="min-h-screen flex bg-surface">
      {user?.role === 'admin' ? <AdminSidebar /> : <Sidebar />}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8">
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => go({ name: 'notice-list' })}
              className="text-[14px] text-ink-500 hover:text-brand transition-colors"
            >
              목록으로 돌아가기 &gt;
            </button>
          </div>

          {loading && (
            <div className="space-y-4">
              <div className="h-7 w-64 rounded animate-pulse bg-line" />
              <div className="h-12 rounded animate-pulse bg-line" />
              <div className="h-48 rounded animate-pulse bg-line" />
            </div>
          )}

          {!loading && !notice && (
            <div className="text-center text-ink-400 py-20">게시글을 찾을 수 없습니다.</div>
          )}

          {!loading && notice && (
            <div className="max-w-4xl">
              <h1 className="text-[20px] font-bold mb-4 text-ink-900">{notice.BOARD_TITLE}</h1>

              <div className="border border-line rounded-[5px] px-6 py-3 mb-3 flex items-center gap-8 text-[14px] text-ink-600 bg-surface-card">
                <span>유형 <span className="ml-2 font-medium text-ink-800">{notice.GUBUN || '-'}</span></span>
                <span>등록일 <span className="ml-2 font-medium text-ink-800">{notice.reg_date}</span></span>
                <span>조회수 <span className="ml-2 font-medium text-ink-800">{notice.BOARD_READ_COUNT}</span></span>
              </div>

              <div className="border border-line rounded-[5px] p-6 mb-3 min-h-[200px] bg-white whitespace-pre-wrap text-[15px] text-ink-700 leading-relaxed">
                {notice.BOARD_CONTENT || ''}
              </div>

              <div className="border border-line rounded-[5px] px-6 py-3 flex items-start gap-4 text-[14px]">
                <span className="font-medium text-ink-800 shrink-0">첨부파일</span>
                {notice.attachments.length === 0 ? (
                  <span className="text-ink-400">등록된 첨부파일이 없습니다.</span>
                ) : (
                  <div className="flex flex-col gap-1">
                    {notice.attachments.map(f => (
                      <span key={f.BF_IDX} className="text-ink-700">{f.FILE_NM}</span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-center mt-8">
                <button
                  type="button"
                  onClick={() => go({ name: 'notice-list' })}
                  className="w-48 h-12 rounded-[5px] border border-ink-300 text-[15px] text-ink-700 hover:bg-surface-active transition-colors"
                >
                  목록으로
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
