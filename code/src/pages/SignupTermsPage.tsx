import { useEffect, useMemo, useState } from 'react'
import BrandLogo from '../components/BrandLogo'
import Stepper from '../components/Stepper'
import Modal, { ModalCloseButton } from '../components/Modal'
import { useRouter } from '../lib/router'
import type { Role } from '../lib/auth'

type Props = { role: Role }

type Term = {
  key: string
  label: string
  required: boolean
  body: string
}

const FALLBACK_TERMS: Term[] = [
  { key: 'privacy_use',    label: '개인정보 수집 및 이용 동의 (필수)', required: true,  body: DEFAULT_BODY('개인정보 수집 및 이용') },
  { key: 'sensitive_use',  label: '민감정보 수집 및 이용 동의 (필수)', required: true,  body: DEFAULT_BODY('민감정보 수집 및 이용') },
  { key: 'privacy_third',  label: '개인정보 제3자 제공 동의서',        required: false, body: DEFAULT_BODY('개인정보 제3자 제공') },
  { key: 'sensitive_third',label: '민감정보 제3자 제공 동의서',        required: false, body: DEFAULT_BODY('민감정보 제3자 제공') },
]

function DEFAULT_BODY(title: string): string {
  return `${title}에 관한 약관 상세 내용입니다.\n\n제 1조 (목적)\n본 약관은 하이동동이 제공하는 서비스의 이용조건 및 절차, 이용자와 당사의 권리·의무·책임사항을 규정함을 목적으로 합니다.\n\n제 2조 (용어의 정의)\n본 약관에서 사용하는 용어의 정의는 다음과 같습니다.\n1. "서비스"란 당사가 제공하는 모든 서비스를 의미합니다.\n2. "이용자"란 본 약관에 따라 서비스를 받는 자를 말합니다.\n\n제 3조 (약관의 효력)\n본 약관은 그 내용을 게시하여 이용자에게 공지함으로써 효력이 발생합니다.`
}

export default function SignupTermsPage({ role }: Props) {
  const { go } = useRouter()
  const [terms, setTerms] = useState<Term[]>(FALLBACK_TERMS)
  const [loadingTerms, setLoadingTerms] = useState(true)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [warningOpen, setWarningOpen] = useState(false)
  const [detail, setDetail] = useState<Term | null>(null)

  const dbRole = role === 'admin' ? 'iadmin' : role === 'therapist' ? 'therapist' : 'doctor'

  useEffect(() => {
    fetch(`/api/terms/current?role=${dbRole}`)
      .then(r => r.ok ? r.json() : [])
      .then((rows: { term_type: string; title: string; required: boolean; version: string; content: string }[]) => {
        if (rows.length > 0) {
          setTerms(rows.map(r => ({
            key: r.term_type,
            label: `${r.title}${r.required ? ' (필수)' : ' (선택)'}`,
            required: !!r.required,
            body: r.content,
          })))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTerms(false))
  }, [])

  const requiredKeys = useMemo(() => terms.filter(t => t.required).map(t => t.key), [terms])
  const allRequired = requiredKeys.every(k => checked[k])
  const allChecked = terms.every(t => checked[t.key])

  const toggle = (key: string) => setChecked(p => ({ ...p, [key]: !p[key] }))
  const toggleAll = () => {
    if (allChecked) setChecked({})
    else setChecked(Object.fromEntries(terms.map(t => [t.key, true])))
  }

  const handleSubmit = () => {
    if (!allRequired) { setWarningOpen(true); return }
    go({ name: 'signup-form', role })
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="max-w-[960px] mx-auto">
        <div className="mb-8"><BrandLogo size="md" /></div>
        <h1 className="text-[30px] font-bold text-ink-850 mb-10">회원가입</h1>
        <div className="mb-14"><Stepper current={1} /></div>

        {loadingTerms ? (
          <div className="border border-ink-850 rounded-[10px] p-10 flex items-center justify-center h-[200px] text-[14px] text-[#B5B5B5]">
            약관을 불러오는 중…
          </div>
        ) : (
          <div className="border border-ink-850 rounded-[10px] p-10">
            <label className="flex items-center gap-3 cursor-pointer pb-5 border-b border-line">
              <CheckboxBox checked={allChecked} onChange={toggleAll} />
              <span className="text-[15px] font-medium text-ink-850">모두 동의 합니다.</span>
            </label>

            <ul className="mt-4 space-y-1">
              {terms.map(term => (
                <li key={term.key} className="flex items-center justify-between py-2">
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <CheckboxBox checked={!!checked[term.key]} onChange={() => toggle(term.key)} />
                    <span className={`text-[15px] font-medium ${term.required ? 'text-ink-850' : 'text-ink-700'}`}>
                      {term.label}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setDetail(term)}
                    className="text-[12px] text-ink-700 hover:text-brand inline-flex items-center gap-1 underline underline-offset-2 decoration-ink-500"
                  >
                    내용보기
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-center mt-12">
          <button
            type="button"
            onClick={handleSubmit}
            className={`w-[220px] h-[58px] rounded-[10px] text-[15px] font-semibold text-white transition ${
              allRequired ? 'bg-brand hover:opacity-90' : 'bg-[#BFBFBF] cursor-not-allowed'
            }`}
          >
            동의하기
          </button>
        </div>

        <div className="flex justify-center mt-4">
          <button type="button" onClick={() => go({ name: 'signup' })} className="text-[12px] text-ink-500 hover:text-ink-900">
            &lt; 이전으로
          </button>
        </div>
      </div>

      {/* 필수 동의 경고 모달 */}
      <Modal open={warningOpen} onClose={() => setWarningOpen(false)} className="w-[320px]">
        <ModalCloseButton onClose={() => setWarningOpen(false)} />
        <div className="px-8 py-10 text-center">
          <h2 className="text-[20px] font-bold text-ink-800 mb-3">안내</h2>
          <p className="text-[12px] font-bold text-ink-800">
            필수 약관<span className="font-medium">에 모두 동의해 주세요.</span>
          </p>
          <button type="button" onClick={() => setWarningOpen(false)}
            className="mt-6 w-[75px] h-10 border border-brand text-ink-900 text-[15px] font-medium rounded-[5px] hover:bg-brand hover:text-white transition-colors">
            닫기
          </button>
        </div>
      </Modal>

      {/* 약관 상세 모달 */}
      <Modal open={!!detail} onClose={() => setDetail(null)} className="w-[800px] max-w-[95vw] h-[600px] max-h-[90vh] flex flex-col">
        <ModalCloseButton onClose={() => setDetail(null)} />
        <div className="px-14 py-10 overflow-hidden flex-1 flex flex-col">
          <h2 className="text-[20px] font-bold text-black mb-1">약관 상세내용</h2>
          <h3 className="text-[18px] font-bold text-black mb-6">{detail?.label.replace(/\s?\((필수|선택)\)/, '')}</h3>
          <div className="flex-1 overflow-y-auto pr-2 text-[15px] leading-[25px] text-black whitespace-pre-line">
            {detail?.body}
          </div>
        </div>
        <div className="flex justify-center pb-8">
          <button type="button" onClick={() => setDetail(null)}
            className="w-[75px] h-10 border border-brand text-ink-900 text-[15px] font-medium rounded-[5px] hover:bg-brand hover:text-white transition-colors">
            확인
          </button>
        </div>
      </Modal>
    </div>
  )
}

function CheckboxBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onChange}
      className={`w-5 h-5 rounded-[3px] border grid place-items-center transition-colors ${
        checked ? 'bg-brand border-brand' : 'bg-white border-[#B2B2B2] hover:border-brand'
      }`}>
      {checked && (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="white" strokeWidth="2">
          <path d="M1 5l3.5 3.5L11 1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}
