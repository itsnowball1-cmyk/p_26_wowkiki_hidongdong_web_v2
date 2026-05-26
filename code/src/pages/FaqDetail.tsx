import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api, type FaqDetailDto, type FaqImage } from '../lib/api'

function parseFaqContent(dto: FaqDetailDto): { detail: string; answer: string } {
  // 관리자 작성 FAQ: BOARD_CONTENT = JSON({ detail, answer })
  // 구버전 FAQ: BOARD_CONTENT = 질문 상세, REPLY_MEMO = 답변
  try {
    const parsed = JSON.parse(dto.BOARD_CONTENT ?? '{}')
    if (parsed.answer !== undefined) {
      return { detail: parsed.detail ?? '', answer: parsed.answer ?? '' }
    }
  } catch { /* 구버전 */ }
  return { detail: dto.BOARD_CONTENT ?? '', answer: dto.REPLY_MEMO ?? '' }
}

export default function FaqDetail({ id }: { id: number }) {
  const { go } = useRouter()
  const { user } = useAuth()
  const [faq, setFaq] = useState<FaqDetailDto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    api.faqDetail(id)
      .then(data => { if (!ignore) setFaq(data) })
      .catch(() => {})
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [id])

  const parsed = faq ? parseFaqContent(faq) : null

  return (
    <div className="min-h-screen flex bg-surface">
      {user?.role === 'admin' ? <AdminSidebar /> : <Sidebar />}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />
        <main className="flex-1 px-6 lg:px-10 py-8">
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => go({ name: 'faq-list' })}
              className="text-[12px] text-[#000000] hover:text-brand transition-colors"
            >
              목록으로 돌아가기 &gt;
            </button>
          </div>

          {loading && (
            <div className="space-y-4">
              <div className="h-6 w-80 rounded animate-pulse bg-line" />
              <div className="h-32 rounded animate-pulse bg-line" />
              <div className="h-40 rounded animate-pulse bg-line" />
            </div>
          )}

          {!loading && !faq && (
            <div className="text-center text-ink-400 py-20">FAQ를 찾을 수 없습니다.</div>
          )}

          {!loading && faq && parsed && (
            <div className="max-w-4xl">
              {/* 제목 */}
              <h1 className="text-[20px] font-bold text-[#404040] mb-4">
                Q. {faq.BOARD_TITLE}
              </h1>

              <hr className="border-t border-[#DEDEDE] mb-4" />

              {/* Q 박스 */}
              <div className="border border-[#DEDEDE] rounded-[5px] p-6 bg-white mb-3">
                {parsed.detail && (
                  <p className="text-[15px] text-[#404040] whitespace-pre-wrap leading-relaxed mb-4">
                    Q. {parsed.detail}
                  </p>
                )}
                {faq.question_images.length > 0 && (
                  <ImageCarousel images={faq.question_images} />
                )}
              </div>

              {/* A 박스 */}
              {(parsed.answer || faq.answer_images.length > 0) && (
                <div className="border border-[#DEDEDE] rounded-[5px] p-6 bg-white mb-8">
                  {parsed.answer && (
                    <p className="text-[15px] text-[#404040] whitespace-pre-wrap leading-relaxed mb-4">
                      A. {parsed.answer}
                    </p>
                  )}
                  {faq.answer_images.length > 0 && (
                    <ImageCarousel images={faq.answer_images} />
                  )}
                </div>
              )}

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => go({ name: 'faq-list' })}
                  className="w-[220px] h-[58px] rounded-[10px] border border-[#005744] text-[18px] font-semibold text-[#005744] hover:bg-[#005744] hover:text-white transition-colors"
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

function ImageCarousel({ images }: { images: FaqImage[] }) {
  const [startIdx, setStartIdx] = useState(0)
  const [failed, setFailed] = useState<Set<number>>(new Set())
  const [modalIdx, setModalIdx] = useState<number | null>(null)

  const onFail = (id: number) => setFailed(prev => new Set([...prev, id]))

  // 전체 이미지가 로드 실패하면 캐러셀 숨김
  if (failed.size >= images.length && images.length > 0) return null

  const visible = images.slice(startIdx, startIdx + 4)
  const canPrev = startIdx > 0
  const canNext = startIdx + 4 < images.length

  return (
    <>
      <div className="flex items-center gap-2 mt-2">
        <button
          type="button"
          onClick={() => setStartIdx(Math.max(0, startIdx - 4))}
          disabled={!canPrev}
          className="w-8 h-8 flex items-center justify-center text-ink-400 disabled:opacity-30 hover:text-ink-700 transition-colors shrink-0"
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 1 1 6l5 5" />
          </svg>
        </button>

        <div className="flex gap-3 flex-1">
          {visible.map((img, i) => (
            <ImageThumb
              key={img.BF_IDX}
              src={img.ATTACH_NM}
              label={img.FILE_NM}
              onClick={() => setModalIdx(startIdx + i)}
              onFail={() => onFail(img.BF_IDX)}
            />
          ))}
          {Array.from({ length: 4 - visible.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1" />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setStartIdx(startIdx + 4)}
          disabled={!canNext}
          className="w-8 h-8 flex items-center justify-center text-ink-400 disabled:opacity-30 hover:text-ink-700 transition-colors shrink-0"
        >
          <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m1 1 5 5-5 5" />
          </svg>
        </button>
      </div>

      {modalIdx !== null && (
        <ImageModal
          images={images.filter((_, i) => !failed.has(images[i].BF_IDX))}
          index={modalIdx}
          onClose={() => setModalIdx(null)}
          onPrev={() => setModalIdx(Math.max(0, modalIdx - 1))}
          onNext={() => setModalIdx(Math.min(images.length - 1, modalIdx + 1))}
        />
      )}
    </>
  )
}

function ImageThumb({ src, label, onClick, onFail }: { src: string; label: string; onClick: () => void; onFail: () => void }) {
  const [failed, setFailed] = useState(false)

  const handleError = () => { setFailed(true); onFail() }

  if (failed) return <div className="flex-1 aspect-square" />

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 aspect-square rounded-[5px] overflow-hidden bg-[#CCCCCC] flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
    >
      <img
        src={src}
        alt={label}
        onError={handleError}
        className="w-full h-full object-cover"
      />
    </button>
  )
}

function ImageModal({ images, index, onClose, onPrev, onNext }: {
  images: FaqImage[]
  index: number
  onClose: () => void
  onPrev: () => void
  onNext: () => void
}) {
  const img = images[index]
  const [failed, setFailed] = useState(false)

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-[8px] w-[480px] h-[480px] flex items-center justify-center mx-4"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onPrev}
          disabled={index === 0}
          className="absolute left-[-44px] top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white text-ink-500 disabled:opacity-30 hover:bg-surface-active transition-colors"
        >
          <svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M7 1 1 6.5 7 12" />
          </svg>
        </button>

        {!failed ? (
          <img
            key={img.BF_IDX}
            src={img.ATTACH_NM}
            alt={img.FILE_NM}
            onError={() => setFailed(true)}
            className="max-w-full max-h-full object-contain"
          />
        ) : (
          <span className="text-[24px] font-medium text-[#888]">이미지</span>
        )}

        <button
          type="button"
          onClick={onNext}
          disabled={index === images.length - 1}
          className="absolute right-[-44px] top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-full bg-white text-ink-500 disabled:opacity-30 hover:bg-surface-active transition-colors"
        >
          <svg width="8" height="13" viewBox="0 0 8 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m1 1 6 5.5-6 5.5" />
          </svg>
        </button>
      </div>
    </div>
  )
}
