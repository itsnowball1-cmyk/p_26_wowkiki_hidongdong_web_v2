import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }

const NOTICE_TYPES: { value: string; label: string }[] = [
  { value: '1', label: '전체 공지' },
  { value: '2', label: '회원가입 반려' },
  { value: '3', label: '서비스 안내' },
  { value: '4', label: '시스템 점검' },
  { value: '5', label: '업데이트' },
]

type FormState = {
  is_pinned: boolean
  target_roles: string[]
  notice_type: string
  title: string
  content: string
  status: 'public' | 'private'
}

export default function NoticesEditForm({ idx, onBack }: { idx: number; onBack: (saved?: boolean) => void }) {
  const [form, setForm] = useState<FormState>({
    is_pinned: false,
    target_roles: [],
    notice_type: '',
    title: '',
    content: '',
    status: 'public',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/notices/${idx}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then((d: { is_pinned: boolean; notice_type: string; title: string; content: string; status: string; target_roles: string } | null) => {
        if (!d) return
        setForm({
          is_pinned:    d.is_pinned,
          target_roles: d.target_roles ? d.target_roles.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          notice_type:  d.notice_type,
          title:        d.title,
          content:      d.content,
          status:       d.status === 'private' ? 'private' : 'public',
        })
      })
      .finally(() => setLoading(false))
  }, [idx])

  const toggleRole = (role: string) => {
    setForm(f => ({
      ...f,
      target_roles: f.target_roles.includes(role)
        ? f.target_roles.filter(r => r !== role)
        : [...f.target_roles, role],
    }))
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) { alert('제목을 입력해주세요.'); return }
    if (!form.content.trim()) { alert('내용을 입력해주세요.'); return }
    setSaving(true)
    const res = await fetch(`/api/admin/notices/${idx}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({
        is_pinned:    form.is_pinned,
        target_roles: form.target_roles.join(', '),
        notice_type:  form.notice_type,
        title:        form.title,
        content:      form.content,
        status:       form.status,
      }),
    })
    setSaving(false)
    if (res.ok) {
      onBack(true)
    } else {
      const data = await res.json().catch(() => ({})) as { error?: string }
      alert(`수정 실패 (${res.status}): ${data.error ?? '알 수 없는 오류'}`)
    }
  }

  return (
    <Layout title="공지/FAQ">
      <div className="flex justify-end mb-4">
        <button type="button" onClick={() => onBack()} className="text-[12px] text-[#000000] hover:text-[#005744] transition">
          목록으로 돌아가기&gt;
        </button>
      </div>

      <h1 className="text-[30px] font-semibold text-[#000000] mb-6">공지사항 수정</h1>

      {loading ? (
        <div className="py-20 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
      ) : (
        <>
          <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-6">
            <FormRow label="고정">
              <div className="flex items-center gap-6">
                {[{ val: true, label: '고정공지' }, { val: false, label: '일반공지' }].map(opt => (
                  <label key={String(opt.val)} className="flex items-center gap-2 text-[15px] text-[#585858] cursor-pointer">
                    <input
                      type="radio"
                      name="is_pinned"
                      checked={form.is_pinned === opt.val}
                      onChange={() => setForm(f => ({ ...f, is_pinned: opt.val }))}
                      className="w-4 h-4 accent-[#005744]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </FormRow>

            <FormRow label="노출 대상">
              <div className="flex items-center gap-6">
                {['기관 관리자', '의사', '치료사'].map(role => (
                  <label key={role} className="flex items-center gap-2 text-[15px] text-[#585858] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.target_roles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="w-4 h-4 accent-[#005744]"
                    />
                    {role}
                  </label>
                ))}
              </div>
            </FormRow>

            <FormRow label="유형">
              <select
                value={form.notice_type}
                onChange={e => setForm(f => ({ ...f, notice_type: e.target.value }))}
                className="h-[34px] px-3 border border-[#B1B1B1] rounded-[3px] text-[15px] text-[#585858] outline-none bg-white min-w-[180px]"
              >
                <option value="">선택</option>
                {NOTICE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </FormRow>

            <FormRow label="제목">
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="제목을 입력해주세요."
                className="w-full h-[34px] px-3 border border-[#DEDEDE] rounded-[3px] text-[15px] text-[#585858] outline-none placeholder:text-[#B5B5B5]"
              />
            </FormRow>

            <FormRow label="내용" tall>
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder="내용을 입력해주세요."
                style={{ minHeight: 320 }}
                className="w-full p-3 border border-[#DEDEDE] rounded-[3px] text-[15px] text-[#585858] outline-none resize-none placeholder:text-[#B5B5B5]"
              />
            </FormRow>

            <FormRow label="파일첨부" height={65}>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="h-[34px] px-4 border border-[#B1B1B1] text-[15px] text-[#585858] rounded-[3px] hover:bg-[#F5F5F5] transition-colors"
                >
                  내PC
                </button>
                <span className="text-[14px] text-[#B5B5B5]">파일을 마우스로 끌어 오세요.</span>
              </div>
            </FormRow>

            <FormRow label="공개 여부" last>
              <div className="flex items-center gap-6">
                {[{ val: 'public', label: '공개' }, { val: 'private', label: '비공개' }].map(opt => (
                  <label key={opt.val} className="flex items-center gap-2 text-[15px] text-[#585858] cursor-pointer">
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
              수정
            </button>
            <button
              type="button"
              onClick={() => onBack()}
              className="w-[220px] h-[58px] border border-[#005744] text-[#005744] text-[18px] font-semibold rounded-[10px] hover:bg-[#005744] hover:text-white transition-colors"
            >
              취소
            </button>
          </div>
        </>
      )}
    </Layout>
  )
}

function FormRow({
  label, children, tall, last, height,
}: {
  label: string
  children: React.ReactNode
  tall?: boolean
  last?: boolean
  height?: number
}) {
  const rowH = height ?? (tall ? undefined : 60)
  return (
    <div className={`grid grid-cols-[271px_1fr] ${!last ? 'border-b border-[#DEDEDE]' : ''}`}>
      <div
        className="bg-[#EAEAEA] flex items-center px-6 text-[15px] font-medium text-[#202020] border-r border-[#DEDEDE]"
        style={{ height: rowH, minHeight: 60 }}
      >
        {label}
      </div>
      <div
        className="bg-white flex items-center px-6"
        style={{ height: rowH, minHeight: 60 }}
      >
        {children}
      </div>
    </div>
  )
}
