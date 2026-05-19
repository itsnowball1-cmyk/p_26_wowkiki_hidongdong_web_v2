import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api, type FaqDetailDto, type FaqImage } from '../lib/api'

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
              className="text-[14px] text-ink-500 hover:text-brand transition-colors"
            >
              목록으로 돌아가기 &gt;
            </button>
          </div>

          {loading && (
            <div className="space-y-4">
              <div className="h-6 w-80 rounded animate-pulse bg-line" />
              <div className="h-32 rounded animate-pulse bg-line" />
              <div className="h-32 rounded animate-pulse bg-line" />
            </div>
          )}

          {!loading && !faq && (
            <div className="text-center text-ink-400 py-20">FAQ를 찾을 수 없습니다.</div>
          )}

          {!loading && faq && (
            <div className="max-w-4xl space-y-3">
              <h1 className="text-[18px] font-bold text-ink-900 mb-4">
                Q. {faq.BOARD_TITLE}
              </h1>

              {/* Q 박스 */}
              <div className="border border-line rounded-[5px] p-5 bg-white">
                <p className="text-[15px] text-ink-700 whitespace-pre-wrap leading-relaxed">
                  Q. {faq.BOARD_CONTENT || faq.BOARD_TITLE}
                </p>
                {faq.question_images.length > 0 && (
                  <ImageCarousel images={faq.question_images} />
                )}
              </div>

              {/* A 박스 */}
              {faq.REPLY_MEMO && (
                <div className="border border-line rounded-[5px] p-5 bg-white">
                  <p className="text-[15px] text-ink-700 whitespace-pre-wrap leading-relaxed">
                    A. {faq.REPLY_MEMO}
                  </p>
                  {faq.answer_images.length > 0 && (
                    <ImageCarousel images={faq.answer_images} />
                  )}
                </div>
              )}

              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  onClick={() => go({ name: 'faq-list' })}
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

function ImageCarousel({ images }: { images: FaqImage[] }) {
  const [startIdx, setStartIdx] = useState(0)
  const [modalIdx, setModalIdx] = useState<number | null>(null)

  const visible = images.slice(startIdx, startIdx + 4)
  const canPrev = startIdx > 0
  const canNext = startIdx + 4 < images.length

  return (
    <>
      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={() => setStartIdx(Math.max(0, startIdx - 4))}
          disabled={!canPrev}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-line text-ink-400 disabled:opacity-30 hover:bg-surface-active transition-colors shrink-0"
        >
          <svg width="6" height="11" viewBox="0 0 6 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M5 1 1 5.5 5 10" />
          </svg>
        </button>

        <div className="flex gap-3 flex-1">
          {visible.map((img, i) => (
            <ImageThumb
              key={img.BF_IDX}
              src={img.ATTACH_NM}
              label={img.FILE_NM}
              onClick={() => setModalIdx(startIdx + i)}
            />
          ))}
          {/* 빈 칸 채우기 */}
          {Array.from({ length: 4 - visible.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1" />
          ))}
        </div>

        <button
          type="button"
          onClick={() => setStartIdx(startIdx + 4)}
          disabled={!canNext}
          className="w-8 h-8 flex items-center justify-center rounded-full border border-line text-ink-400 disabled:opacity-30 hover:bg-surface-active transition-colors shrink-0"
        >
          <svg width="6" height="11" viewBox="0 0 6 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="m1 1 4 4.5-4 4.5" />
          </svg>
        </button>
      </div>

      {modalIdx !== null && (
        <ImageModal
          images={images}
          index={modalIdx}
          onClose={() => setModalIdx(null)}
          onPrev={() => setModalIdx(Math.max(0, modalIdx - 1))}
          onNext={() => setModalIdx(Math.min(images.length - 1, modalIdx + 1))}
        />
      )}
    </>
  )
}

function ImageThumb({ src, label, onClick }: { src: string; label: string; onClick: () => void }) {
  const [failed, setFailed] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 aspect-square rounded-[5px] overflow-hidden bg-[#CCCCCC] flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
    >
      {!failed ? (
        <img
          src={src}
          alt={label}
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="text-[16px] font-medium text-[#888]">이미지</span>
      )}
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
        {/* 이전 */}
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

        {/* 이미지 */}
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

        {/* 다음 */}
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
