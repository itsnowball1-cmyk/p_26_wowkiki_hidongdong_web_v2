import { useState } from 'react'
import Layout from '../components/Layout'

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }

const FAQ_TYPES: { value: string; label: string }[] = [
  { value: '아동관리', label: '아동관리' },
  { value: '전체 내진 일정', label: '전체 내진 일정' },
  { value: '아동별 커스텀', label: '아동별 커스텀' },
  { value: '마이페이지', label: '마이페이지' },
  { value: '기타', label: '기타' },
]

type FormState = {
  status: 'public' | 'private'
  target_roles: string[]
  faq_type: string
  question: string
  question_detail: string
  answer: string
}

export default function FAQWriteForm({ onBack }: { onBack: (saved?: boolean) => void }) {
  const [form, setForm] = useState<FormState>({
    status: 'public', target_roles: [], faq_type: '',
    question: '', question_detail: '', answer: '',
  })
  const [saving, setSaving] = useState(false)

  const toggleRole = (role: string) => {
    setForm(f => ({
      ...f,
      target_roles: f.target_roles.includes(role)
        ? f.target_roles.filter(r => r !== role)
        : [...f.target_roles, role],
    }))
  }

  const handleSubmit = async () => {
    if (!form.question.trim()) { alert('질문을 입력해주세요.'); return }
    if (!form.answer.trim()) { alert('답변을 입력해주세요.'); return }
    setSaving(true)
    const res = await fetch('/api/admin/faq', {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        status:       form.status,
        target_roles: form.target_roles.join(', '),
        category:     form.faq_type,
        title:        form.question,
        content:      JSON.stringify({ detail: form.question_detail, answer: form.answer }),
      }),
    })
    setSaving(false)
    if (res.ok) {
      onBack(true)
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string }
      alert(`저장 실패 (${res.status}): ${data.error ?? '알 수 없는 오류'}`)
    }
  }

  return (
    <Layout title="FAQ">
      <div className="flex justify-end mb-4">
        <button type="button" onClick={() => onBack()} className="text-[12px] text-[#000000] hover:text-[#005744] transition">
          목록으로 돌아가기&gt;
        </button>
      </div>

      <h1 className="text-[30px] font-semibold text-[#000000] mb-6">FAQ 작성</h1>

      <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-6">
        {/* 노출 대상 */}
        <FormRow label="노출 대상">
          <div className="flex items-center gap-6">
            {['기관 관리자', '의사', '치료사'].map(role => (
              <label key={role} className="flex items-center gap-2 text-[15px] text-[#2F2E2E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.target_roles.includes(role)}
                  onChange={() => toggleRole(role)}
                  className="w-[18px] h-[18px] accent-[#005744]"
                />
                {role}
              </label>
            ))}
          </div>
        </FormRow>

        {/* 유형 */}
        <FormRow label="유형">
          <select
            value={form.faq_type}
            onChange={e => setForm(f => ({ ...f, faq_type: e.target.value }))}
            className="h-[34px] px-3 border border-[#B1B1B1] rounded-[5px] text-[15px] text-[#585858] outline-none bg-white min-w-[180px]"
          >
            <option value="">선택</option>
            {FAQ_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </FormRow>

        {/* 질문 */}
        <FormRow label="질문">
          <input
            type="text"
            value={form.question}
            onChange={e => setForm(f => ({ ...f, question: e.target.value }))}
            placeholder="Q. 질문을 입력해주세요."
            className="w-full h-[34px] px-3 border border-[#B1B1B1] rounded-[5px] text-[15px] text-[#585858] outline-none placeholder:text-[#C0C0C0]"
          />
        </FormRow>

        {/* 상세 질문 */}
        <FormRow label="상세 질문" height={106}>
          <textarea
            value={form.question_detail}
            onChange={e => setForm(f => ({ ...f, question_detail: e.target.value }))}
            placeholder="Q. 상세한 질문을 입력해주세요."
            className="w-full h-[80px] p-3 border border-[#B1B1B1] rounded-[5px] text-[15px] text-[#585858] outline-none resize-none placeholder:text-[#C0C0C0]"
          />
        </FormRow>

        {/* 질문 파일첨부 */}
        <FormRow label="질문 파일첨부" height={65}>
          <div className="flex items-center gap-3">
            <button type="button" className="h-[40px] px-4 border border-[#B1B1B1] text-[15px] text-[#000000] rounded-[5px] hover:bg-[#F5F5F5] transition-colors">
              내PC
            </button>
            <span className="text-[14px] text-[#AEAEAE]">파일을 마우스로 끌어 오세요.</span>
          </div>
        </FormRow>

        {/* 답변 */}
        <FormRow label="답변" height={219}>
          <textarea
            value={form.answer}
            onChange={e => setForm(f => ({ ...f, answer: e.target.value }))}
            placeholder="A. 답변을 입력해주세요."
            className="w-full h-[195px] p-3 border border-[#B1B1B1] rounded-[5px] text-[15px] text-[#585858] outline-none resize-none placeholder:text-[#C0C0C0]"
          />
        </FormRow>

        {/* 답변 파일첨부 */}
        <FormRow label="답변 파일첨부" height={66}>
          <div className="flex items-center gap-3">
            <button type="button" className="h-[40px] px-4 border border-[#B1B1B1] text-[15px] text-[#000000] rounded-[5px] hover:bg-[#F5F5F5] transition-colors">
              내PC
            </button>
            <span className="text-[14px] text-[#AEAEAE]">파일을 마우스로 끌어 오세요.</span>
          </div>
        </FormRow>

        {/* 공개 여부 */}
        <FormRow label="공개 여부" last>
          <div className="flex items-center gap-6">
            {[{ val: 'public', label: '공개' }, { val: 'private', label: '비공개' }].map(opt => (
              <label key={opt.val} className="flex items-center gap-2 text-[15px] text-[#2F2E2E] cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  checked={form.status === opt.val}
                  onChange={() => setForm(f => ({ ...f, status: opt.val as 'public' | 'private' }))}
                  className="w-4 h-4 accent-[#005744]"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </FormRow>
      </div>

      <div className="flex items-center justify-center gap-6">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-[220px] h-[58px] bg-[#005744] text-white text-[18px] font-semibold rounded-[10px] hover:bg-[#004535] transition-colors disabled:opacity-50"
        >
          업로드
        </button>
        <button
          type="button"
          onClick={() => onBack()}
          className="w-[220px] h-[58px] border border-[#005744] text-[#005744] text-[18px] font-semibold rounded-[10px] hover:bg-[#005744] hover:text-white transition-colors"
        >
          취소
        </button>
      </div>
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
