import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

type Template = {
  template_key: string
  template_name: string
  template_body: string
}

const HEADERS = { 'content-type': 'application/json', 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }

const VARIABLE_HINTS: Record<string, string[]> = {
  approve: ['{name}', '{inst_name}', '{instt_code}'],
  reject:  ['{name}', '{inst_name}', '{reject_reason}'],
}

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

  return (
    <Layout title="문자 설정">
      <div className="max-w-[720px]">
        <p className="text-[14px] text-[#727272] mb-6">
          기관 승인·반려 시 자동으로 발송되는 문자 문구를 설정합니다.
        </p>

        {loading && (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="h-40 rounded-[10px] bg-[#F0F0F0] animate-pulse" />)}
          </div>
        )}

        {!loading && error && (
          <p className="text-[13px] text-red-500 mb-4">{error}</p>
        )}

        {!loading && templates.map(tpl => (
          <div key={tpl.template_key} className="mb-6 bg-white rounded-[10px] border border-[#DEDEDE] p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[17px] font-semibold text-[#202020]">{tpl.template_name}</h2>
              <span className={`text-[12px] px-2 py-0.5 rounded-full font-medium ${
                tpl.template_key === 'approve'
                  ? 'bg-green-50 text-green-600'
                  : 'bg-red-50 text-red-500'
              }`}>
                {tpl.template_key === 'approve' ? '승인' : '반려'}
              </span>
            </div>

            <div className="mb-3">
              <p className="text-[12px] text-[#919191] mb-1">사용 가능한 변수</p>
              <div className="flex gap-2 flex-wrap">
                {(VARIABLE_HINTS[tpl.template_key] ?? []).map(v => (
                  <span key={v} className="text-[12px] px-2 py-0.5 bg-[#F3F3F3] rounded text-[#505050] font-mono">{v}</span>
                ))}
              </div>
            </div>

            <textarea
              value={tpl.template_body}
              onChange={e => updateBody(tpl.template_key, e.target.value)}
              rows={4}
              className="w-full px-3 py-2.5 border border-[#B1B1B1] rounded-[7px] text-[14px] outline-none focus:border-[#005744] resize-none"
            />

            <div className="flex items-center justify-between mt-3">
              <p className="text-[12px] text-[#919191]">
                SMS 90자 이내 권장 · 현재 {tpl.template_body.length}자
              </p>
              <div className="flex items-center gap-3">
                {saved === tpl.template_key && (
                  <span className="text-[13px] text-[#005744]">저장되었습니다.</span>
                )}
                <button
                  type="button"
                  onClick={() => handleSave(tpl)}
                  disabled={saving === tpl.template_key}
                  className="h-[38px] px-5 bg-[#005744] text-white text-[14px] font-medium rounded-[5px] hover:opacity-90 transition disabled:opacity-50"
                >
                  {saving === tpl.template_key ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        ))}

        {!loading && templates.length === 0 && !error && (
          <div className="py-20 text-center text-[14px] text-[#B5B5B5]">
            템플릿 데이터가 없습니다. DB에 tb_sms_template 테이블과 초기 데이터를 추가해주세요.
          </div>
        )}
      </div>
    </Layout>
  )
}
