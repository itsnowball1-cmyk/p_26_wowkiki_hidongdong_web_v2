import { useEffect, useRef, useState } from 'react'
import Layout from '../components/Layout'

const S_TYPE: Record<string, string> = {
  '01': '아동관리', '02': '전체 내진 일정', '03': '아동별 커스텀',
  '04': '마이페이지', '05': '기타',
}

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }
const DL_HEADERS = { get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }

type CsFile = { sf_idx: number; file_nm: string; source_file_nm: string; file_size: number | null }
type PendingFile = { id: string; name: string; size: number; data: string }
type PreviewState = { url: string; name: string; mimeType: string }

type CsDetail = {
  cs_idx: number
  s_title: string
  memo: string
  s_type: string
  email: string
  phone: string | null
  name: string
  user_id: string
  regist_date: string
  reply_yn: string
  reply_memo: string | null
  reply_date: string | null
  question_files: CsFile[]
  answer_files: CsFile[]
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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

export default function CsDetailPage({ idx, onBack }: { idx: number; onBack: (saved?: boolean) => void }) {
  const [data, setData] = useState<CsDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [deletedFileIds, setDeletedFileIds] = useState<number[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState<PreviewState | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/admin/cs/${idx}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then((d: CsDetail | null) => {
        if (!d) return
        setData(d)
        setReplyText(d.reply_memo ?? '')
        setMode('view')
      })
      .finally(() => setLoading(false))
  }, [idx])

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview.url) }
  }, [preview])

  const openPreview = async (sfIdx: number, filename: string) => {
    setPreviewLoading(true)
    try {
      const res = await fetch(`/api/admin/cs/files/${sfIdx}`, { headers: DL_HEADERS })
      if (!res.ok) throw new Error('파일을 불러올 수 없습니다.')
      const d = await res.json() as { file_data?: string; source_file_nm?: string }
      if (!d.file_data) throw new Error('파일 데이터가 없습니다.')
      const name = d.source_file_nm ?? filename
      const mimeType = getMimeType(name)
      const binary = atob(d.file_data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }))
      if (preview) URL.revokeObjectURL(preview.url)
      setPreview({ url, name, mimeType })
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

  const handleFileSelect = async (files: FileList | File[]) => {
    const MAX = 10 * 1024 * 1024
    for (const file of Array.from(files)) {
      if (file.size > MAX) { alert(`${file.name}: 파일 크기는 10MB 이하여야 합니다.`); continue }
      const fileData = await readFileAsBase64(file)
      setPendingFiles(prev => [...prev, {
        id: Math.random().toString(36).slice(2),
        name: file.name,
        size: file.size,
        data: fileData,
      }])
    }
  }

  const handleSubmit = async () => {
    if (!replyText.trim()) { alert('답변 내용을 입력해주세요.'); return }
    setSaving(true)
    const res = await fetch(`/api/admin/cs/${idx}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        reply_memo: replyText,
        answer_files: pendingFiles.map(f => ({ name: f.name, size: f.size, data: f.data })),
        deleted_answer_file_ids: deletedFileIds,
      }),
    })
    setSaving(false)
    if (res.ok) {
      setPendingFiles([])
      setDeletedFileIds([])
      setMode('view')
      onBack(true)
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string }
      alert(`저장 실패: ${d.error ?? '알 수 없는 오류'}`)
    }
  }

  const isAnswered = data?.reply_yn === 'Y'
  const showEditForm = !isAnswered || mode === 'edit'

  const fileNameBtn = (sfIdx: number, name: string) => (
    <button
      type="button"
      onClick={() => openPreview(sfIdx, name)}
      disabled={previewLoading}
      className="flex-1 text-left text-[14px] text-[#005744] hover:underline truncate disabled:opacity-60"
    >
      {name}
    </button>
  )

  return (
    <Layout title="1:1 문의사항">
      <div className="flex justify-end mb-4">
        <button type="button" onClick={() => onBack()} className="text-[12px] text-[#000000] hover:text-[#005744] transition">
          목록으로 돌아가기&gt;
        </button>
      </div>

      <h1 className="text-[30px] font-semibold text-[#000000] mb-6">1:1 문의사항</h1>

      {loading ? (
        <div className="py-20 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
      ) : !data ? (
        <div className="py-20 text-center text-[14px] text-[#B5B5B5]">문의사항을 찾을 수 없습니다.</div>
      ) : (
        <>
          {/* 기본 정보 (3열) */}
          <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-4">
            <InfoRow3Col
              col1={{ label: '문의자 이름', value: data.name || '-' }}
              col2={{ label: '문의자 아이디', value: data.user_id || '-' }}
              col3={{ label: '문의자 휴대폰번호', value: data.phone || '-' }}
            />
            <InfoRow3Col
              col1={{ label: '문의 날짜', value: data.regist_date }}
              col2={{ label: '답변 날짜', value: data.reply_date || '-' }}
              col3={{ label: '답변자', value: '-' }}
              last
            />
          </div>

          {/* 문의 내용 섹션 */}
          <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-4">
            <FormRow label="문의 유형">
              <span className="text-[15px] text-[#585858]">{S_TYPE[data.s_type] ?? data.s_type}</span>
            </FormRow>
            <FormRow label="문의 제목">
              <span className="text-[15px] text-[#585858]">{data.s_title}</span>
            </FormRow>
            <FormRow label="문의 내용" tall>
              <p className="text-[15px] text-[#585858] whitespace-pre-wrap leading-relaxed min-h-[80px]">{data.memo}</p>
            </FormRow>
            <FormRow label="문의 첨부파일" tall last>
              {data.question_files.length > 0 ? (
                <ul className="space-y-2 py-1">
                  {data.question_files.map(f => (
                    <li key={f.sf_idx} className="flex items-center gap-2 text-[14px] text-[#585858]">
                      <FileIcon />
                      {fileNameBtn(f.sf_idx, f.source_file_nm)}
                      {f.file_size != null && (
                        <span className="text-[#AEAEAE] shrink-0">({(f.file_size / 1024).toFixed(1)} KB)</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-[14px] text-[#B5B5B5]">첨부파일 없음</span>
              )}
            </FormRow>
          </div>

          {/* 답변 섹션 */}
          <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-6">
            {showEditForm ? (
              <>
                <FormRow label="답변 내용" tall>
                  <textarea
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="A. 답변을 입력해주세요."
                    className="w-full h-[225px] p-3 border border-[#B1B1B1] rounded-[5px] text-[15px] text-[#585858] outline-none resize-none placeholder:text-[#C0C0C0]"
                  />
                </FormRow>
                <FormRow label="답변 파일첨부" tall last>
                  <div className="w-full space-y-2">
                    {/* 기존 첨부파일 (미리보기 + 삭제 가능) */}
                    {data.answer_files.filter(f => !deletedFileIds.includes(f.sf_idx)).length > 0 && (
                      <ul className="space-y-1.5">
                        {data.answer_files
                          .filter(f => !deletedFileIds.includes(f.sf_idx))
                          .map(f => (
                            <li key={f.sf_idx} className="flex items-center gap-2 text-[14px] text-[#585858] bg-[#F5F5F5] border border-[#DEDEDE] rounded-[5px] px-3 h-[36px]">
                              <FileIcon />
                              {fileNameBtn(f.sf_idx, f.source_file_nm)}
                              {f.file_size != null && (
                                <span className="text-[#AEAEAE] shrink-0 text-[13px]">({(f.file_size / 1024).toFixed(1)} KB)</span>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeletedFileIds(prev => [...prev, f.sf_idx])}
                                className="shrink-0 text-[#AAAAAA] hover:text-[#FF4646] transition-colors text-[16px] leading-none"
                                title="파일 삭제"
                              >
                                ×
                              </button>
                            </li>
                          ))}
                      </ul>
                    )}
                    {/* 드래그&드롭 영역 */}
                    <div
                      className={`border-2 border-dashed rounded-[5px] transition-colors ${dragOver ? 'border-[#005744] bg-[#f0f9f6]' : 'border-[#CCCCCC]'}`}
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={e => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files) }}
                    >
                      <div className="flex items-center gap-3 px-3 h-[44px]">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="shrink-0 h-[30px] px-3 border border-[#AAAAAA] rounded-[5px] text-[13px] text-[#585858] hover:bg-[#F0F0F0] transition-colors"
                        >
                          내PC
                        </button>
                        <span className="text-[13px] text-[#AEAEAE]">파일을 마우스로 끌어 오세요.</span>
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={e => { if (e.target.files) handleFileSelect(e.target.files); e.target.value = '' }}
                    />
                    {/* 새로 추가할 파일 목록 */}
                    {pendingFiles.length > 0 && (
                      <ul className="space-y-1.5">
                        {pendingFiles.map(f => (
                          <li key={f.id} className="flex items-center gap-2 text-[14px] text-[#585858] bg-[#EAEAEA] rounded-[5px] px-3 h-[36px]">
                            <FileIcon />
                            <span className="flex-1 truncate">{f.name}</span>
                            <span className="text-[#AEAEAE] shrink-0 text-[13px]">({(f.size / 1024).toFixed(1)} KB)</span>
                            <button
                              type="button"
                              onClick={() => setPendingFiles(prev => prev.filter(x => x.id !== f.id))}
                              className="shrink-0 text-[#AAAAAA] hover:text-[#FF4646] transition-colors text-[16px] leading-none"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </FormRow>
              </>
            ) : (
              <>
                <FormRow label="답변 내용" tall>
                  <p className="text-[15px] text-[#585858] whitespace-pre-wrap leading-relaxed min-h-[60px]">{data.reply_memo}</p>
                </FormRow>
                <FormRow label="답변 파일첨부" tall last>
                  {data.answer_files.length > 0 ? (
                    <ul className="space-y-2 py-1">
                      {data.answer_files.map(f => (
                        <li key={f.sf_idx} className="flex items-center gap-2 text-[14px] text-[#585858]">
                          <FileIcon />
                          {fileNameBtn(f.sf_idx, f.source_file_nm)}
                          {f.file_size != null && (
                            <span className="text-[#AEAEAE] shrink-0">({(f.file_size / 1024).toFixed(1)} KB)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-[14px] text-[#B5B5B5]">첨부파일 없음</span>
                  )}
                </FormRow>
              </>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex items-center justify-center gap-6">
            {!isAnswered && (
              <>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-[220px] h-[58px] bg-[#005744] text-white text-[18px] font-semibold rounded-[10px] hover:bg-[#004535] transition-colors disabled:opacity-50"
                >
                  {saving ? '저장 중…' : '등록'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPendingFiles([]); setDeletedFileIds([]); onBack() }}
                  className="w-[220px] h-[58px] border border-[#005744] text-[#005744] text-[18px] font-semibold rounded-[10px] hover:bg-[#005744] hover:text-white transition-colors"
                >
                  취소
                </button>
              </>
            )}
            {isAnswered && mode === 'view' && (
              <>
                <button
                  type="button"
                  onClick={() => setMode('edit')}
                  className="w-[220px] h-[58px] bg-[#005744] text-white text-[18px] font-semibold rounded-[10px] hover:bg-[#004535] transition-colors"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => onBack()}
                  className="w-[220px] h-[58px] border border-[#005744] text-[#005744] text-[18px] font-semibold rounded-[10px] hover:bg-[#005744] hover:text-white transition-colors"
                >
                  확인
                </button>
              </>
            )}
            {isAnswered && mode === 'edit' && (
              <>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="w-[220px] h-[58px] bg-[#005744] text-white text-[18px] font-semibold rounded-[10px] hover:bg-[#004535] transition-colors disabled:opacity-50"
                >
                  {saving ? '저장 중…' : '수정 완료'}
                </button>
                <button
                  type="button"
                  onClick={() => { setPendingFiles([]); setDeletedFileIds([]); setReplyText(data.reply_memo ?? ''); setMode('view') }}
                  className="w-[220px] h-[58px] border border-[#005744] text-[#005744] text-[18px] font-semibold rounded-[10px] hover:bg-[#005744] hover:text-white transition-colors"
                >
                  취소
                </button>
              </>
            )}
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
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#DEDEDE] shrink-0">
              <span className="text-[14px] font-medium text-[#272727] truncate max-w-[60vw]">
                {preview.name}
              </span>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <button
                  type="button"
                  onClick={downloadFromPreview}
                  className="h-8 px-3 flex items-center gap-1.5 border border-[#005744] text-[#005744] text-[13px] rounded-[5px] hover:bg-[#005744] hover:text-white transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6.5 1v7M4 5.5l2.5 2.5 2.5-2.5M1 11h11" />
                  </svg>
                  다운로드
                </button>
                <button
                  type="button"
                  onClick={closePreview}
                  className="w-8 h-8 flex items-center justify-center text-[#AEAEAE] hover:text-[#272727] hover:bg-[#F0F0F0] rounded-[5px] transition-colors"
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
                  <p className="text-[14px] text-[#AEAEAE]">이 파일 형식은 미리보기를 지원하지 않습니다.</p>
                  <button
                    type="button"
                    onClick={downloadFromPreview}
                    className="h-10 px-6 bg-[#005744] text-white text-[14px] font-medium rounded-[5px] hover:bg-[#004535] transition-colors"
                  >
                    파일 다운로드
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    fetch(url).then(r => r.text()).then(setText).catch(() => setText('파일을 읽을 수 없습니다.'))
  }, [url])
  if (text === null) return <div className="text-[#AEAEAE] text-[14px]">불러오는 중...</div>
  return (
    <pre className="w-[70vw] max-h-[70vh] overflow-auto text-[13px] text-[#585858] whitespace-pre-wrap bg-white rounded shadow p-4 border border-[#DEDEDE]">
      {text}
    </pre>
  )
}

function FileIcon() {
  return (
    <svg width="13" height="14" viewBox="0 0 13 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
      <path d="M2 1.5h5.5l3 3V12.5H2V1.5z"/>
      <path d="M7.5 1.5v3h3"/>
    </svg>
  )
}

function InfoRow3Col({
  col1, col2, col3, last,
}: {
  col1: { label: string; value: string }
  col2: { label: string; value: string }
  col3: { label: string; value: string }
  last?: boolean
}) {
  return (
    <div className={`grid grid-cols-3 ${!last ? 'border-b border-[#DEDEDE]' : ''}`} style={{ minHeight: 60 }}>
      {([col1, col2, col3] as const).map((col, i) => (
        <div key={i} className={`grid grid-cols-[120px_1fr] ${i < 2 ? 'border-r border-[#DEDEDE]' : ''}`}>
          <div className="bg-[#EAEAEA] flex items-center px-4 text-[14px] font-medium text-[#272727]">
            {col.label}
          </div>
          <div className="bg-white flex items-center px-4 text-[14px] text-[#585858]">
            {col.value}
          </div>
        </div>
      ))}
    </div>
  )
}

function FormRow({ label, children, last, tall }: {
  label: string
  children: React.ReactNode
  last?: boolean
  tall?: boolean
}) {
  return (
    <div className={`grid grid-cols-[271px_1fr] ${!last ? 'border-b border-[#DEDEDE]' : ''}`}>
      <div
        className="bg-[#EAEAEA] flex items-start pt-5 px-6 text-[15px] font-medium text-[#272727] border-r border-[#DEDEDE]"
        style={{ minHeight: tall ? 100 : 60 }}
      >
        {label}
      </div>
      <div
        className="bg-white flex items-start pt-5 px-6"
        style={{ minHeight: tall ? 100 : 60 }}
      >
        {children}
      </div>
    </div>
  )
}
