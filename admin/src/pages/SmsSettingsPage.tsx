import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

type Template = {
  template_key: string
  template_name: string
  template_body: string
}

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }

const VARIABLE_HINTS: Record<string, string[]> = {
  approve:         ['{name}', '{inst_name}', '{instt_code}'],
  reject:          ['{name}', '{inst_name}', '{reject_reason}'],
  teacher_approve: ['{name}'],
  teacher_reject:  ['{name}', '{reject_reason}'],
}

const BADGE: Record<string, { label: string; className: string }> = {
  approve:         { label: '승인', className: 'bg-green-50 text-green-600' },
  reject:          { label: '반려', className: 'bg-red-50 text-red-500' },
  teacher_approve: { label: '승인', className: 'bg-green-50 text-green-600' },
  teacher_reject:  { label: '반려', className: 'bg-red-50 text-red-500' },
}

const SECTIONS = [
  { title: '의사 / 기관 관리자', keys: ['approve', 'reject'] },
  { title: '치료사', keys: ['teacher_approve', 'teacher_reject'] },
]

export default function SmsSettingsPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/sms-templates', { headers: HEADERS })
      .then(r => r.json())
      .then((data: { templates?: Template[] }) => {
        if (data.templates) setTemplates(data.templates)
      })
      .catch(() => setError('템플릿을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [])

  const updateBody = (key: string, value: string) => {
    setTemplates(prev => prev.map(t => t.template_key === key ? { ...t, template_body: value } : t))
    setSaved(null)
  }

  const handleSave = async (tpl: Template) => {
    setSaving(tpl.template_key)
    setError('')
    try {
      const res = await fetch('/api/admin/sms-template', {
        method: 'PUT',
        headers: HEADERS,
        body: JSON.stringify({ template_key: tpl.template_key, template_body: tpl.template_body }),
      })
      if (!res.ok) throw new Error()
      setSaved(tpl.template_key)
    } catch {
      setError('저장에 실패했습니다.')
    } finally {
      setSaving(null)
    }
  }

  const tplMap = Object.fromEntries(templates.map(t => [t.template_key, t]))

  return (
    <Layout title="문자 설정">
      <div className="max-w-[720px]">
        <p className="text-[14px] text-[#727272] mb-6">
          회원 승인·반려 시 자동으로 발송되는 문자 문구를 설정합니다.
        </p>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 rounded-[10px] bg-[#F0F0F0] animate-pulse" />)}
          </div>
        )}

        {!loading && error && (
          <p className="text-[13px] text-red-500 mb-4">{error}</p>
        )}

        {!loading && SECTIONS.map(section => (
          <div key={section.title} className="mb-8">
            <h2 className="text-[15px] font-semibold text-[#202020] mb-3 pb-2 border-b border-[#DEDEDE]">
              {section.title}
            </h2>
            {section.keys.map(key => {
              const tpl = tplMap[key]
              if (!tpl) return (
                <div key={key} className="mb-4 p-4 bg-[#FFF8F0] border border-[#FFD9A0] rounded-[10px] text-[13px] text-[#B07A00]">
                  DB에 <code className="font-mono">{key}</code> 템플릿이 없습니다. 아래 SQL을 실행해 주세요.
                </div>
              )
              const badge = BADGE[key] ?? { label: key, className: 'bg-gray-100 text-gray-500' }
              return (
                <div key={key} className="mb-6 bg-white rounded-[10px] border border-[#DEDEDE] p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[17px] font-semibold text-[#202020]">{tpl.template_name}</h3>
                    <span className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="mb-3">
                    <p className="text-[12px] text-[#919191] mb-1">사용 가능한 변수</p>
                    <div className="flex gap-2 flex-wrap">
                      {(VARIABLE_HINTS[key] ?? []).map(v => (
                        <span key={v} className="text-[12px] px-2 py-0.5 bg-[#F3F3F3] rounded text-[#505050] font-mono">{v}</span>
                      ))}
                    </div>
                  </div>

                  <textarea
                    value={tpl.template_body}
                    onChange={e => updateBody(key, e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2.5 border border-[#B1B1B1] rounded-[7px] text-[14px] outline-none focus:border-[#005744] resize-none"
                  />

                  <div className="flex items-center justify-between mt-3">
                    <p className="text-[12px] text-[#919191]">
                      SMS 90자 이내 권장 · 현재 {tpl.template_body.length}자
                    </p>
                    <div className="flex items-center gap-3">
                      {saved === key && (
                        <span className="text-[13px] text-[#005744]">저장되었습니다.</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSave(tpl)}
                        disabled={saving === key}
                        className="h-[38px] px-5 bg-[#005744] text-white text-[14px] font-medium rounded-[5px] hover:opacity-90 transition disabled:opacity-50"
                      >
                        {saving === key ? '저장 중...' : '저장'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </Layout>
  )
}
