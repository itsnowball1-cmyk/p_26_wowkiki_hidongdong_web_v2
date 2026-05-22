import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useRouter } from '../lib/router'

type RoleTab = 'child' | 'doctor' | 'therapist'
type StatusFilter = 'active' | 'inactive' | 'all'

type Institution = {
  idx: number
  id: string
  instt_code: string
  instt_name: string | null
  instt_type: string | null
  address: string | null
  contact_name: string
  contact_email: string | null
  contact_phone: string | null
  cert_file_nm: string | null
  regist_date: string
}

type Member = {
  idx: number
  id: string
  code: string | null
  name: string
  birth_date: string | null
  is_male: boolean
  regist_date: string
}

const HEADERS = { 'content-type': 'application/json', 'x-user-id': localStorage.getItem('hbd_user_id') ?? '' }

function calcAge(birthDateStr: string | null): string {
  if (!birthDateStr) return '-'
  const parts = birthDateStr.split('.')
  if (parts.length < 3) return '-'
  const birth = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return `만 ${age}세`
}

export default function InstitutionDetailPage({ id }: { id: string }) {
  const { go } = useRouter()
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loadingInfo, setLoadingInfo] = useState(true)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [roleTab, setRoleTab] = useState<RoleTab>('child')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [selected, setSelected] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch(`/api/admin/institution-detail?idx=${id}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setInstitution(data as Institution) })
      .finally(() => setLoadingInfo(false))
  }, [id])

  useEffect(() => {
    if (!institution) return
    setLoadingMembers(true)
    setSelected(new Set())
    fetch(
      `/api/admin/institution-members?instt_code=${institution.instt_code}&role=${roleTab}&status=${statusFilter}`,
      { headers: HEADERS }
    )
      .then(r => r.ok ? r.json() : [])
      .then(data => setMembers(data as Member[]))
      .finally(() => setLoadingMembers(false))
  }, [institution, roleTab, statusFilter])

  const allChecked = members.length > 0 && members.every(m => selected.has(m.idx))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(members.map(m => m.idx)))
  const toggleOne = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next
    })
  }

  const roleTabs: { key: RoleTab; label: string }[] = [
    { key: 'doctor',    label: '의사' },
    { key: 'therapist', label: '치료사' },
    { key: 'child',     label: '아동' },
  ]

  const statusOptions: { key: StatusFilter; label: string }[] = [
    { key: 'active',   label: '활성화 유저' },
    { key: 'inactive', label: '휴면 유저' },
    { key: 'all',      label: '전체 유저' },
  ]

  const roleLabel = roleTab === 'child' ? '아동' : roleTab === 'doctor' ? '의사' : '치료사'

  return (
    <Layout title="기관/계정">
      {/* 목록으로 돌아가기 */}
      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={() => go({ name: 'institutions' })}
          className="text-[12px] text-[#000000] hover:text-[#005744] transition"
        >
          목록으로 돌아가기&gt;
        </button>
      </div>

      {/* ── 기관 정보 ── */}
      <h2 className="text-[18px] font-semibold text-[#000000] mb-3">기관 정보</h2>
      {loadingInfo ? (
        <div className="h-[208px] bg-white border border-[#DEDEDE] rounded-[5px] flex items-center justify-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
      ) : !institution ? (
        <div className="h-[208px] bg-white border border-[#DEDEDE] rounded-[5px] flex items-center justify-center text-[14px] text-[#B5B5B5]">기관 정보를 불러올 수 없습니다.</div>
      ) : (
        <div className="border border-[#DEDEDE] rounded-[5px] overflow-hidden mb-8">
          {/* Row 1 */}
          <InfoRow
            l1="기관 식별코드" v1={institution.instt_code}
            l2="기관 사업자등록증"
            v2={
              institution.cert_file_nm
                ? <span className="flex items-center gap-2 text-[#585858]">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1" stroke="#585858" strokeWidth="1.2"/><path d="M5 5h6M5 8h6M5 11h4" stroke="#585858" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    {institution.cert_file_nm}
                  </span>
                : <span className="text-[#B5B5B5]">-</span>
            }
          />
          {/* Row 2 */}
          <InfoRow
            l1="기관 종류" v1={institution.instt_type ?? '-'}
            l2="기관 담당자" v2={institution.contact_name}
          />
          {/* Row 3 */}
          <InfoRow
            l1="기관명" v1={institution.instt_name ?? institution.instt_code}
            l2="기관 담당자 이메일" v2={institution.contact_email ?? '-'}
          />
          {/* Row 4 */}
          <InfoRow
            l1="기관 주소" v1={institution.address ?? '-'}
            l2="기관 담당자 휴대전화" v2={institution.contact_phone ?? '-'}
            last
          />
        </div>
      )}

      {/* ── 계약상태 ── */}
      <h2 className="text-[18px] font-semibold text-[#000000] mb-3">계약상태</h2>
      <div className="w-full h-[220px] bg-white border-2 border-[#DEDEDE] rounded-[5px] flex items-center justify-center text-[14px] text-[#B5B5B5] mb-8">
        계약 정보가 없습니다.
      </div>

      {/* ── 유저 타입 탭 ── */}
      <div className="flex items-baseline gap-10 mb-4">
        {roleTabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setRoleTab(t.key)}
            className={`text-[28px] leading-none transition-colors ${
              roleTab === t.key ? 'font-bold text-[#005744]' : 'font-medium text-[#D2D2D2]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── 검색필터 ── */}
      <h2 className="text-[18px] font-semibold text-[#000000] mb-3">검색필터</h2>
      <div className="w-full h-[57px] bg-[#EAEAEA] rounded-[5px] flex items-center px-8 gap-6 mb-4">
        <span className="text-[15px] font-semibold text-[#000000] mr-4">계정 상태</span>
        {statusOptions.map(opt => (
          <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
            <span
              onClick={() => setStatusFilter(opt.key)}
              className={`w-[17px] h-[17px] rounded-[3px] border border-[#000000] flex items-center justify-center cursor-pointer ${
                statusFilter === opt.key ? 'bg-[#005744] border-[#005744]' : 'bg-white'
              }`}
            >
              {statusFilter === opt.key && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </span>
            <span className="text-[15px] text-[#2F2E2E]" onClick={() => setStatusFilter(opt.key)}>{opt.label}</span>
          </label>
        ))}
      </div>

      {/* ── 멤버 리스트 ── */}
      <div className="bg-white rounded-[10px] border border-[#DEDEDE] overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#DEDEDE]">
          <p className="text-[18px] font-semibold">
            <span className="text-[#919191]">{roleLabel} 리스트</span>
            <span className="text-[#005744] ml-2">{members.length}</span>
          </p>
          <button
            type="button"
            disabled={selected.size === 0}
            className="h-[40px] px-6 border border-[#005744] text-[#000000] rounded-[5px] text-[15px] font-medium hover:bg-[#005744] hover:text-white transition disabled:opacity-40"
          >
            삭제
          </button>
        </div>

        {/* 테이블 */}
        {roleTab === 'child' ? (
          <>
            <div className="grid grid-cols-[40px_60px_160px_160px_140px_100px_140px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#000000] text-center">
              <span className="flex items-center justify-center">
                <CheckboxBtn checked={allChecked} onChange={toggleAll} />
              </span>
              <span>순번</span>
              <span>이름(나이)</span>
              <span>식별코드</span>
              <span>생년월일</span>
              <span>성별</span>
              <span>가입일시</span>
            </div>
            {loadingMembers ? (
              <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
            ) : members.length === 0 ? (
              <div className="py-12 text-center text-[14px] text-[#B5B5B5]">등록된 아동이 없습니다.</div>
            ) : members.map((m, i) => (
              <div key={m.idx} className={`grid grid-cols-[40px_60px_160px_160px_140px_100px_140px] px-6 py-3 items-center text-[15px] text-center ${i < members.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}>
                <span className="flex items-center justify-center"><CheckboxBtn checked={selected.has(m.idx)} onChange={() => toggleOne(m.idx)} /></span>
                <span className="text-[#585858]">{i + 1}</span>
                <span className="text-[#585858]">{m.name}({calcAge(m.birth_date)})</span>
                <span className="text-[#484848]">{m.code ?? '-'}</span>
                <span className="text-[#484848]">{m.birth_date ?? '-'}</span>
                <span className="text-[#585858]">{m.is_male ? '남아' : '여아'}</span>
                <span className="text-[#585858]">{m.regist_date}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="grid grid-cols-[40px_60px_1fr_160px_140px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#000000] text-center">
              <span className="flex items-center justify-center">
                <CheckboxBtn checked={allChecked} onChange={toggleAll} />
              </span>
              <span>순번</span>
              <span>이름</span>
              <span>아이디</span>
              <span>가입일시</span>
            </div>
            {loadingMembers ? (
              <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
            ) : members.length === 0 ? (
              <div className="py-12 text-center text-[14px] text-[#B5B5B5]">등록된 {roleLabel}가 없습니다.</div>
            ) : members.map((m, i) => (
              <div key={m.idx} className={`grid grid-cols-[40px_60px_1fr_160px_140px] px-6 py-3 items-center text-[15px] text-center ${i < members.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}>
                <span className="flex items-center justify-center"><CheckboxBtn checked={selected.has(m.idx)} onChange={() => toggleOne(m.idx)} /></span>
                <span className="text-[#585858]">{i + 1}</span>
                <span className="text-[#585858]">{m.name}</span>
                <span className="text-[#484848]">{m.id}</span>
                <span className="text-[#585858]">{m.regist_date}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </Layout>
  )
}

function InfoRow({
  l1, v1, l2, v2, last = false
}: {
  l1: string; v1: React.ReactNode
  l2: string; v2: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={`grid grid-cols-[240px_1fr_240px_1fr] ${last ? '' : 'border-b border-[#DEDEDE]'}`}>
      <div className="bg-[#EAEAEA] px-6 h-[52px] flex items-center text-[15px] font-medium text-[#343A40] border-r border-[#DEDEDE]">{l1}</div>
      <div className="bg-white px-6 h-[52px] flex items-center text-[15px] text-[#585858] border-r border-[#DEDEDE]">{v1}</div>
      <div className="bg-[#EAEAEA] px-6 h-[52px] flex items-center text-[15px] font-medium text-[#343A40] border-r border-[#DEDEDE]">{l2}</div>
      <div className="bg-white px-6 h-[52px] flex items-center text-[15px] text-[#585858]">{v2}</div>
    </div>
  )
}

function CheckboxBtn({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-colors ${
        checked ? 'bg-[#005744] border-[#005744]' : 'bg-white border-[#575757]'
      }`}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}
