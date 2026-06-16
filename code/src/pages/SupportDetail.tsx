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

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp',
    pdf: 'application/pdf',
    txt: 'text/plain',
    mp4: 'video/mp4', mp3: 'audio/mpeg',
  }
  return map[ext] ?? 'application/octet-stream'
}

type PreviewState = { url: string; name: string; mimeType: string }

export default function SupportDetail({ id }: { id: number }) {
  const { go } = useRouter()
  const { user } = useAuth()
  const [support, setSupport] = useState<SupportDetailDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    api.supportDetail(id)
      .then(data => { if (!ignore) setSupport(data) })
      .catch(() => {})
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [id])

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview.url) }
  }, [preview])

  const fetchFileBlob = async (sfIdx: number, filename: string): Promise<PreviewState> => {
    const res = await fetch(`/api/support/files/${sfIdx}`, {
      headers: { 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }
    })
    if (!res.ok) throw new Error('파일을 불러올 수 없습니다.')
    const d = await res.json() as { file_data?: string; source_file_nm?: string }
    if (!d.file_data) throw new Error('파일 데이터가 없습니다.')
    const name = d.source_file_nm ?? filename
    const mimeType = getMimeType(name)
    const binary = atob(d.file_data)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }))
    return { url, name, mimeType }
  }

  const openPreview = async (sfIdx: number, filename: string) => {
    setPreviewLoading(true)
    try {
      const p = await fetchFileBlob(sfIdx, filename)
      if (preview) URL.revokeObjectURL(preview.url)
      setPreview(p)
    } catch (e) {
      alert(e instanceof Error ? e.message : '파일을 불러오는 중 오류가 발생했습니다.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const downloadFromPreview = () => {
    if (!preview) return
    const a = document.createElement('a')
    a.href = preview.url
    a.download = preview.name
    a.click()
  }

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

  const fileItem = (sfIdx: number, name: string) => (
    <div key={sfIdx} className="flex items-center gap-2 text-ink-600">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2h5l3 3v7H3z" /><path d="M8 2v3h3" />
      </svg>
      <button
        type="button"
        onClick={() => openPreview(sfIdx, name)}
        disabled={previewLoading}
        className="text-[13px] text-brand hover:underline text-left truncate max-w-[280px] disabled:opacity-60"
      >
        {name}
      </button>
    </div>
  )

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
          <div className="w-full border border-line rounded-[5px] bg-white overflow-hidden">
            <table className="w-full text-[14px]">
              <tbody>
                <tr className="border-b border-line">
                  <td className="py-3 px-4 bg-surface font-medium text-ink-700 w-28 whitespace-nowrap">이름</td>
                  <td className="py-3 px-4 text-ink-700">{support.name}</td>
                  <td className="py-3 px-4 bg-surface font-medium text-ink-700 w-28 whitespace-nowrap border-l border-line">문의유형</td>
                  <td className="py-3 px-4 text-ink-700">{INQUIRY_TYPE_LABEL[support.s_type] ?? support.s_type}</td>
                </tr>
                <DetailRow label="문의날짜">{support.regist_date}</DetailRow>
                <DetailRow label="제목">{support.s_title}</DetailRow>
                <DetailRow label="내용">
                  <span className="whitespace-pre-wrap leading-relaxed">{support.memo}</span>
                </DetailRow>
                {support.question_files.length > 0 && (
                  <DetailRow label="첨부파일">
                    <div className="space-y-1.5">
                      {support.question_files.map(f => fileItem(f.sf_idx, f.source_file_nm))}
                    </div>
                  </DetailRow>
                )}
              </tbody>
            </table>
          </div>

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
                        {support.answer_files.map(f => fileItem(f.sf_idx, f.source_file_nm))}
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

      {/* 파일 미리보기 모달 */}
      {preview && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={closePreview}
        >
          <div
            className="bg-white rounded-[12px] flex flex-col overflow-hidden shadow-2xl"
            style={{ maxWidth: '90vw', maxHeight: '90vh', minWidth: 320 }}
            onClick={e => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
              <span className="text-[14px] font-medium text-ink-800 truncate max-w-[60vw]">
                {preview.name}
              </span>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <button
                  type="button"
                  onClick={downloadFromPreview}
                  className="h-8 px-3 flex items-center gap-1.5 border border-brand text-brand text-[13px] rounded-[5px] hover:bg-brand hover:text-white transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.5 1v7M4 5.5l2.5 2.5 2.5-2.5M1 11h11" />
                  </svg>
                  다운로드
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="w-8 h-8 flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-surface-active rounded-[5px] transition-colors"
                  aria-label="닫기"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 3l10 10M13 3 3 13" />
                  </svg>
                </button>
              </div>
            </div>

            {/* 본문 */}
            <div className="overflow-auto flex-1 flex items-center justify-center p-4 bg-[#F7F7F7]">
              {preview.mimeType.startsWith('image/') ? (
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="max-w-full max-h-[75vh] object-contain rounded shadow"
                />
              ) : preview.mimeType === 'application/pdf' ? (
                <iframe
                  src={preview.url}
                  title={preview.name}
                  className="w-[75vw] h-[75vh] rounded shadow border-0"
                />
              ) : preview.mimeType === 'text/plain' ? (
                <TextPreview url={preview.url} />
              ) : (
                <div className="text-center py-12 space-y-4">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#B1B1B1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <path d="M14 2v6h6" /><path d="M12 18v-6" /><path d="M9 15l3 3 3-3" />
                  </svg>
                  <p className="text-[14px] text-ink-400">이 파일 형식은 미리보기를 지원하지 않습니다.</p>
                  <button
                    type="button"
                    onClick={downloadFromPreview}
                    className="h-10 px-6 bg-brand text-white text-[14px] font-medium rounded-[5px] hover:bg-brand/90 transition-colors"
                  >
                    파일 다운로드
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    fetch(url).then(r => r.text()).then(setText).catch(() => setText('파일을 읽을 수 없습니다.'))
  }, [url])
  if (text === null) return <div className="text-ink-400 text-[14px]">불러오는 중...</div>
  return (
    <pre className="w-[70vw] max-h-[70vh] overflow-auto text-[13px] text-ink-700 whitespace-pre-wrap bg-white rounded shadow p-4 border border-line">
      {text}
    </pre>
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
