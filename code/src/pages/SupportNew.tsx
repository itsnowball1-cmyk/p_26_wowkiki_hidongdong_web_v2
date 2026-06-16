import { useRef, useState } from 'react'
import type { ReactNode, DragEvent } from 'react'
import Sidebar from '../components/Sidebar'
import AdminSidebar from '../components/AdminSidebar'
import TopBar from '../components/TopBar'
import RestrictedLayout from '../components/RestrictedLayout'
import { useRouter } from '../lib/router'
import { useAuth } from '../lib/auth'
import { api } from '../lib/api'

const INQUIRY_TYPES = [
  { value: '01', label: '아동관리' },
  { value: '02', label: '전체 내진 일정' },
  { value: '03', label: '아동별 커스텀' },
  { value: '04', label: '마이페이지' },
  { value: '05', label: '기타' },
]

export default function SupportNew() {
  const { go } = useRouter()
  const { user } = useAuth()
  const [sType, setSType] = useState('01')
  const [title, setTitle] = useState('')
  const [memo, setMemo] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return
    setFiles(prev => {
      const names = new Set(prev.map(f => f.name))
      const next = [...prev]
      for (const f of Array.from(incoming)) {
        if (!names.has(f.name)) { next.push(f); names.add(f.name) }
      }
      return next
    })
  }

  const removeFile = (idx: number) =>
    setFiles(prev => prev.filter((_, i) => i !== idx))

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  const handleSubmit = async () => {
    if (!title.trim()) { setError('제목을 입력해주세요.'); return }
    if (!memo.trim()) { setError('내용을 입력해주세요.'); return }
    setError('')
    setSubmitting(true)
    try {
      const toBase64 = (f: File): Promise<string> =>
        new Promise((res, rej) => {
          const r = new FileReader()
          r.onload = () => res((r.result as string).split(',')[1])
          r.onerror = rej
          r.readAsDataURL(f)
        })
      const fileMeta = await Promise.all(files.map(async f => ({ name: f.name, size: f.size, data: await toBase64(f) })))
      await api.supportCreate({ s_type: sType, s_title: title, memo, files: fileMeta })
      setToast(true)
      setTimeout(() => go({ name: 'support-list' }), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
      setSubmitting(false)
    }
  }

  const isRestricted = user?.approvalStatus === 'pending' || user?.approvalStatus === 'rejected'

  const content = (
    <>
      <h1 className="text-[22px] font-bold mb-6">1:1 문의하기</h1>

      <div className="w-full border border-line rounded-[5px] bg-white overflow-hidden">
        <table className="w-full text-[14px]">
          <tbody>
            <FormRow label="아이디">
              <span className="text-ink-500">{user?.id}</span>
            </FormRow>
            <FormRow label="이름">
              <span className="text-ink-500">{user?.name}</span>
            </FormRow>
            <FormRow label="문의유형">
              <select
                value={sType}
                onChange={e => setSType(e.target.value)}
                className="h-10 px-3 border border-line rounded-[5px] text-[14px] focus:outline-none focus:border-brand bg-white"
              >
                {INQUIRY_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </FormRow>
            <FormRow label="제목">
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="제목을 입력하세요."
                className="w-full h-10 px-3 border border-line rounded-[5px] text-[14px] focus:outline-none focus:border-brand"
              />
            </FormRow>
            <FormRow label="내용">
              <textarea
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="내용을 입력하세요."
                rows={6}
                className="w-full px-3 py-2 border border-line rounded-[5px] text-[14px] focus:outline-none focus:border-brand resize-none"
              />
            </FormRow>
            <FormRow label="첨부파일">
              <div className="space-y-2">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 px-4 flex items-center border border-line rounded-[5px] text-[13px] text-ink-600 hover:bg-surface-active cursor-pointer transition-colors shrink-0"
                  >
                    내PC
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => addFiles(e.target.files)}
                  />
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    className={`flex-1 min-h-[64px] border border-dashed rounded-[5px] flex items-center justify-center text-[13px] transition-colors ${
                      dragging ? 'border-brand bg-brand/5 text-brand' : 'border-line text-ink-400'
                    }`}
                  >
                    파일을 마우스로 끌어 오세요.
                  </div>
                </div>
                {files.length > 0 && (
                  <ul className="space-y-1">
                    {files.map((f, i) => (
                      <li key={i} className="flex items-center gap-2 text-[13px] text-ink-600">
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M2 2h5l3 3v6H2z" /><path d="M7 2v3h3" />
                        </svg>
                        <span className="flex-1 truncate">{f.name}</span>
                        <span className="text-ink-300 shrink-0">({(f.size / 1024).toFixed(1)} KB)</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-ink-300 hover:text-red-400 transition-colors shrink-0"
                          aria-label="삭제"
                        >
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                            <path d="M3 3l8 8M11 3l-8 8" />
                          </svg>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </FormRow>
          </tbody>
        </table>
      </div>

      {error && <p className="mt-3 text-[13px] text-red-500">{error}</p>}

      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="w-36 h-11 bg-brand text-white text-[15px] font-medium rounded-[5px] hover:bg-brand/90 transition-colors disabled:opacity-60"
        >
          {submitting ? '처리 중...' : '문의하기'}
        </button>
        <button
          type="button"
          onClick={() => go({ name: 'support-list' })}
          className="w-36 h-11 border border-line text-[15px] text-ink-700 rounded-[5px] hover:bg-surface-active transition-colors"
        >
          취소
        </button>
      </div>
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
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#222] text-white text-[14px] px-5 py-3 rounded-[8px] shadow-lg z-50">
          문의가 등록되었습니다.
        </div>
      )}
    </div>
  )
}

function FormRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-3 px-4 bg-surface font-medium text-ink-700 w-28 align-top whitespace-nowrap">{label}</td>
      <td className="py-3 px-4">{children}</td>
    </tr>
  )
}
