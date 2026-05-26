import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

const S_TYPE: Record<string, string> = {
  '01': '아동관리', '02': '전체 내진 일정', '03': '아동별 커스텀',
  '04': '마이페이지', '05': '기타',
}

const HEADERS = { 'content-type': 'application/json', 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }

type CsDetail = {
  cs_idx: number
  s_title: string
  memo: string
  s_type: string
  email: string
  name: string
  user_id: string
  regist_date: string
  reply_yn: string
  reply_memo: string | null
  reply_date: string | null
  question_files: { sf_idx: number; file_nm: string; source_file_nm: string; file_size: number | null }[]
  answer_files:   { sf_idx: number; file_nm: string; source_file_nm: string; file_size: number | null }[]
}

export default function CsDetailPage({ idx, onBack }: { idx: number; onBack: (saved?: boolean) => void }) {
  const [data, setData] = useState<CsDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [mode, setMode] = useState<'view' | 'edit'>('view')

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

  const handleSubmit = async () => {
    if (!replyText.trim()) { alert('답변 내용을 입력해주세요.'); return }
    setSaving(true)
    const res = await fetch(`/api/admin/cs/${idx}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({ reply_memo: replyText }),
    })
    setSaving(false)
    if (res.ok) {
      const result = await res.json() as { replier?: string }
      setData(prev => prev ? {
        ...prev,
        reply_yn: 'Y',
        reply_memo: replyText,
        reply_date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
      } : prev)
      setMode('view')
      onBack(true)
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string }
      alert(`저장 실패: ${d.error ?? '알 수 없는 오류'}`)
    }
  }

  const isAnswered = data?.reply_yn === 'Y'
  const showEditForm = !isAnswered || mode === 'edit'

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
          {/* 기본 정보 */}
          <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-4">
            <FormRow label="문의자 이름"><span className="text-[15px] text-[#585858]">{data.name || '-'}</span></FormRow>
            <FormRow label="문의자 아이디"><span className="text-[15px] text-[#585858]">{data.user_id || '-'}</span></FormRow>
            <FormRow label="문의자 이메일"><span className="text-[15px] text-[#585858]">{data.email || '-'}</span></FormRow>
            <FormRow label="문의 날짜"><span className="text-[15px] text-[#585858]">{data.regist_date}</span></FormRow>
            <FormRow label="답변 날짜"><span className="text-[15px] text-[#585858]">{data.reply_date || '-'}</span></FormRow>
            <FormRow label="문의 유형"><span className="text-[15px] text-[#585858]">{S_TYPE[data.s_type] ?? data.s_type}</span></FormRow>
            <FormRow label="문의 제목" last><span className="text-[15px] text-[#585858]">{data.s_title}</span></FormRow>
          </div>

          {/* 문의 내용 */}
          <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-4">
            <FormRow label="문의 내용" height={data.memo?.length > 100 ? 160 : 106}>
              <p className="text-[15px] text-[#585858] whitespace-pre-wrap leading-relaxed">{data.memo}</p>
            </FormRow>
            {data.question_files.length > 0 && (
              <FormRow label="문의 파일첨부" height={Math.max(65, 50 + data.question_files.length * 36)}>
                <ul className="space-y-1">
                  {data.question_files.map(f => (
                    <li key={f.sf_idx} className="flex items-center gap-2 text-[14px] text-[#585858]">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                        <path d="M2 2h5l3 3v6H2z"/><path d="M7 2v3h3"/>
                      </svg>
                      <span>{f.source_file_nm}</span>
                      {f.file_size && <span className="text-[#AEAEAE]">({(f.file_size / 1024).toFixed(1)} KB)</span>}
                    </li>
                  ))}
                </ul>
              </FormRow>
            )}
          </div>

          {/* 답변 영역 */}
          <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-6">
            {showEditForm ? (
              <FormRow label="답변 내용" height={266} last>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="A. 답변을 입력해주세요."
                  className="w-full h-[225px] p-3 border border-[#B1B1B1] rounded-[5px] text-[15px] text-[#585858] outline-none resize-none placeholder:text-[#C0C0C0]"
                />
              </FormRow>
            ) : (
              <>
                <FormRow label="답변 내용" height={data.reply_memo && data.reply_memo.length > 100 ? 160 : 106}>
                  <p className="text-[15px] text-[#585858] whitespace-pre-wrap leading-relaxed">{data.reply_memo}</p>
                </FormRow>
                {data.answer_files.length > 0 && (
                  <FormRow label="답변 파일첨부" height={Math.max(65, 50 + data.answer_files.length * 36)} last>
                    <ul className="space-y-1">
                      {data.answer_files.map(f => (
                        <li key={f.sf_idx} className="flex items-center gap-2 text-[14px] text-[#585858]">
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                            <path d="M2 2h5l3 3v6H2z"/><path d="M7 2v3h3"/>
                          </svg>
                          <span>{f.source_file_nm}</span>
                          {f.file_size && <span className="text-[#AEAEAE]">({(f.file_size / 1024).toFixed(1)} KB)</span>}
                        </li>
                      ))}
                    </ul>
                  </FormRow>
                )}
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
                  등록
                </button>
                <button
                  type="button"
                  onClick={() => onBack()}
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
                  수정 완료
                </button>
                <button
                  type="button"
                  onClick={() => { setReplyText(data.reply_memo ?? ''); setMode('view') }}
                  className="w-[220px] h-[58px] border border-[#005744] text-[#005744] text-[18px] font-semibold rounded-[10px] hover:bg-[#005744] hover:text-white transition-colors"
                >
                  취소
                </button>
              </>
            )}
          </div>
        </>
      )}
    </Layout>
  )
}

function FormRow({ label, children, last, height }: {
  label: string; children: React.ReactNode; last?: boolean; height?: number
}) {
  const rowH = height ?? 60
  return (
    <div className={`grid grid-cols-[271px_1fr] ${!last ? 'border-b border-[#DEDEDE]' : ''}`}>
      <div className="bg-[#EAEAEA] flex items-center px-6 text-[15px] font-medium text-[#272727] border-r border-[#DEDEDE]"
        style={{ height: rowH, minHeight: 60 }}>
        {label}
      </div>
      <div className="bg-white flex items-center px-6" style={{ height: rowH, minHeight: 60 }}>
        {children}
      </div>
    </div>
  )
}
