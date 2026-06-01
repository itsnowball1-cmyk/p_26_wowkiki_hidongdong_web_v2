import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useRouter } from '../lib/router'

type HistoryItem = { idx: number; attempt_number: number; source_file_nm: string | null; submitted_at: string }
type Institution = {
  inst_name: string | null; inst_type: string | null
  address: string | null; address_detail: string | null
  director_name: string | null; other_requests: string | null
  doctor_sheets: string | null; therapist_sheets: string | null
  business_reg_num: string | null
}
type Member = {
  idx: number; id: string; name: string; phone: string | null; email: string | null
  instt_code: string; mtype: string; approval_status: string | null; admin_memo: string | null
}

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }
const ORDINALS = ['1차', '2차', '3차', '4차', '5차', '6차', '7차', '8차', '9차', '10차']

export default function InstitutionApprovalPage({ id }: { id: string }) {
  const { go } = useRouter()
  const idx = Number(id)

  const [member, setMember] = useState<Member | null>(null)
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)

  const [approveModal, setApproveModal] = useState(false)
  const [insttCode, setInsttCode] = useState('')
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectTitle, setRejectTitle] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [fileLoading, setFileLoading] = useState<number | null>(null)
  const [downloadLoading, setDownloadLoading] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/admin/institution-request?idx=${idx}`, { headers: HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) { setMember(d.member); setInstitution(d.institution); setHistory(d.history) }
      })
      .finally(() => setLoading(false))
  }, [idx])

  const doApprove = async () => {
    if (!insttCode.trim()) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ idx, action: 'approve', instt_code: insttCode.trim() })
      })
      if (res.ok) go({ name: 'institutions' })
    } finally { setActionLoading(false) }
  }

  const doReject = async () => {
    if (!rejectTitle.trim()) return
    setActionLoading(true)
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ idx, action: 'reject', reject_title: rejectTitle, reject_reason: rejectReason })
      })
      if (res.ok) go({ name: 'institutions' })
    } finally { setActionLoading(false) }
  }

  const fetchFileBlob = async (historyIdx: number) => {
    const res = await fetch(`/api/admin/approval-file?historyIdx=${historyIdx}`, { headers: HEADERS })
    if (!res.ok) return null
    const data = await res.json() as { source_file_nm: string | null; file_data: string }
    const byteStr = atob(data.file_data)
    const bytes = new Uint8Array(byteStr.length)
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i)
    const nm = data.source_file_nm ?? 'file'
    const ext = nm.split('.').pop()?.toLowerCase() ?? ''
    const mime = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg'
    return { blob: new Blob([bytes], { type: mime }), name: nm }
  }

  const openFile = async (historyIdx: number) => {
    setFileLoading(historyIdx)
    try {
      const result = await fetchFileBlob(historyIdx)
      if (!result) return
      const url = URL.createObjectURL(result.blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } finally { setFileLoading(null) }
  }

  const downloadFile = async (historyIdx: number, fileName: string | null) => {
    setDownloadLoading(historyIdx)
    try {
      const result = await fetchFileBlob(historyIdx)
      if (!result) return
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName ?? result.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    } finally { setDownloadLoading(null) }
  }

  if (loading) {
    return (
      <Layout title="기관 승인 관리">
        <div className="py-20 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
      </Layout>
    )
  }

  if (!member) {
    return (
      <Layout title="기관 승인 관리">
        <div className="py-20 text-center text-[14px] text-[#B5B5B5]">데이터를 찾을 수 없습니다.</div>
      </Layout>
    )
  }

  const isPending = member.approval_status === '승인대기'
  const isRejected = member.approval_status === '반려'
  const isReapply = isPending && history.length > 1

  // 이전 반려 사유 파싱
  let prevReject: { title?: string; reason?: string } | null = null
  if (isReapply && member.admin_memo) {
    try { prevReject = JSON.parse(member.admin_memo) } catch {}
  }

  const pageTitle = isReapply ? '반려된 기관 정보' : '기관 인증 요청'

  return (
    <Layout title="기관 승인 관리">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[28px] font-bold text-[#000000]">{pageTitle}</h1>
        <button
          type="button"
          onClick={() => go({ name: 'institutions' })}
          className="text-[14px] text-[#727272] hover:text-[#333] flex items-center gap-1"
        >
          목록으로 돌아가기
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3L9 7L5 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="max-w-[860px] mx-auto space-y-8">
        {/* 재신청 안내 박스 */}
        {isReapply && (
          <div className="border border-[#005744] rounded-[8px] px-6 py-5 bg-[#F5FAF7]">
            <p className="text-[14px] text-[#333] mb-2">기관에서 정보를 보완하여 재신청했습니다.</p>
            <p className="text-[16px] font-bold text-[#333]">
              총 {history.length - 1}개의 항목이 수정되었습니다.
            </p>
          </div>
        )}

        {/* 반려 사유 (재신청인 경우) */}
        {isReapply && prevReject && (
          <Section title="반려 사유">
            <Row label="제목">{prevReject.title || '-'}</Row>
            <Row label="사유">{prevReject.reason || '-'}</Row>
          </Section>
        )}

        {/* 기관 인증/가입 */}
        <Section title="기관 인증/가입">
          <Row label="기관명">{institution?.inst_name ?? '-'}</Row>
          <Row label="기관종류">{institution?.inst_type ?? '-'}</Row>
          <Row label="사업자등록증 첨부">
            {history.length === 0 ? (
              <span className="text-[#B5B5B5]">첨부 파일 없음</span>
            ) : (
              <div className="space-y-2">
                {history.map(h => (
                  <div key={h.idx} className="flex items-center gap-3">
                    <span className="text-[13px] text-[#005744] font-semibold w-[36px] shrink-0">
                      {ORDINALS[h.attempt_number - 1] ?? `${h.attempt_number}차`}
                    </span>
                    <svg width="16" height="18" viewBox="0 0 16 18" fill="none" className="shrink-0 text-[#FF4646]">
                      <rect x="1" y="1" width="14" height="16" rx="2" fill="white" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M4 1v4h4" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                    <span className="flex-1 text-[13px] text-[#585858] truncate">{h.source_file_nm ?? '-'}</span>
                    <span className="text-[12px] text-[#B5B5B5] shrink-0">{h.submitted_at}</span>
                    {h.source_file_nm && (
                      <>
                        <button
                          type="button"
                          onClick={() => openFile(h.idx)}
                          disabled={fileLoading === h.idx}
                          className="shrink-0 h-[28px] px-3 border border-[#005744] text-[#005744] rounded-[4px] text-[12px] hover:bg-[#005744] hover:text-white transition disabled:opacity-50"
                        >
                          {fileLoading === h.idx ? '…' : '보기'}
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadFile(h.idx, h.source_file_nm)}
                          disabled={downloadLoading === h.idx}
                          title="다운로드"
                          className="shrink-0 w-[28px] h-[28px] border border-[#005744] text-[#005744] rounded-[4px] flex items-center justify-center hover:bg-[#005744] hover:text-white transition disabled:opacity-50"
                        >
                          {downloadLoading === h.idx ? '…' : (
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M6.5 1v8M3 6.5l3.5 3.5 3.5-3.5"/>
                              <path d="M1 11h11"/>
                            </svg>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                ))}
                <p className="text-[11px] text-[#B5B5B5] mt-1">파일 저장 서비스에서 자동 수행</p>
              </div>
            )}
          </Row>
        </Section>

        {/* 담당자 정보 입력 */}
        <Section title="담당자 정보 입력">
          <Row label="이름">{member.name}</Row>
          <Row label="휴대전화">{member.phone ?? '-'}</Row>
          <Row label="이메일">{member.email ?? '-'}</Row>
        </Section>

        {/* 기관 정보 입력 */}
        <Section title={`${institution?.inst_type ?? '기관'} 정보 입력`}>
          <Row label="아이디">{member.id}</Row>
          <Row label="기관주소">
            {institution?.address
              ? `${institution.address}${institution.address_detail ? ' ' + institution.address_detail : ''}`
              : '-'}
          </Row>
          <Row label="기관장 성함">{institution?.director_name ?? '-'}</Row>
          <Row label="사업자등록번호">{institution?.business_reg_num ?? '-'}</Row>
        </Section>

        {/* 활성화 시트 수 */}
        <Section title="활성화 시트 수">
          <Row label="의사 시트수 선택">{institution?.doctor_sheets ?? '-'}</Row>
          <Row label="치료사 시트 수 선택">{institution?.therapist_sheets ?? '-'}</Row>
        </Section>

        {/* 기타 요청사항 */}
        {institution?.other_requests && (
          <Section title="">
            <Row label="기타 요청사항(선택)">{institution.other_requests}</Row>
          </Section>
        )}

        {/* 반려 사유 (반려된 경우) */}
        {isRejected && member.admin_memo && (() => {
          try {
            const memo = JSON.parse(member.admin_memo) as { title?: string; reason?: string }
            return (
              <div className="bg-[#FFF5F5] border border-[#FFCCCC] rounded-[8px] px-6 py-4">
                <p className="text-[14px] font-semibold text-[#FF4646] mb-1">반려 사유</p>
                {memo.title && <p className="text-[14px] text-[#333] font-medium">{memo.title}</p>}
                {memo.reason && <p className="text-[13px] text-[#666] mt-1">{memo.reason}</p>}
              </div>
            )
          } catch { return null }
        })()}

        {/* 버튼 */}
        {(isPending || isRejected) && (
          <div className="flex justify-center gap-4 pt-4">
            <button
              type="button"
              onClick={() => setRejectModal(true)}
              className="w-[160px] h-[52px] rounded-[8px] border border-[#FF4646] text-[#FF4646] text-[16px] font-semibold hover:bg-[#FF4646] hover:text-white transition"
            >
              반려
            </button>
            <button
              type="button"
              onClick={() => setApproveModal(true)}
              className="w-[160px] h-[52px] rounded-[8px] bg-[#005744] text-white text-[16px] font-semibold hover:opacity-90 transition"
            >
              승인
            </button>
          </div>
        )}
      </div>

      {/* 승인 모달 */}
      {approveModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] w-[460px] px-8 py-8 flex flex-col gap-5">
            <p className="text-[20px] font-bold text-[#2F2E2E]">기관 승인</p>
            <p className="text-[14px] text-[#585858]">부여할 기관 식별코드를 입력해주세요.</p>
            <input
              type="text"
              value={insttCode}
              onChange={e => setInsttCode(e.target.value.toUpperCase())}
              placeholder="예: HBD, ABC001"
              className="w-full h-[42px] px-3 border border-[#B1B1B1] rounded-[5px] text-[15px] outline-none focus:border-[#005744]"
            />
            <div className="flex gap-4 justify-center">
              <button
                type="button"
                onClick={doApprove}
                disabled={!insttCode.trim() || actionLoading}
                className="w-[125px] h-[40px] rounded-[5px] bg-[#005744] text-white text-[15px] font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {actionLoading ? '처리 중…' : '승인'}
              </button>
              <button
                type="button"
                onClick={() => setApproveModal(false)}
                className="w-[125px] h-[40px] rounded-[5px] border border-[#005744] text-[#005744] text-[15px] font-medium hover:bg-[#005744] hover:text-white transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 반려 모달 */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] w-[460px] px-8 py-8 flex flex-col gap-4">
            <p className="text-[20px] font-bold text-[#2F2E2E]">반려 사유 입력</p>
            <div className="flex flex-col gap-1">
              <label className="text-[14px] font-medium text-[#585858]">제목</label>
              <input
                type="text"
                value={rejectTitle}
                onChange={e => setRejectTitle(e.target.value)}
                placeholder="반려 제목을 입력해주세요."
                className="w-full h-[42px] px-3 border border-[#B1B1B1] rounded-[5px] text-[15px] outline-none focus:border-[#005744]"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[14px] font-medium text-[#585858]">사유</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="반려 사유를 입력해주세요."
                rows={4}
                className="w-full px-3 py-2 border border-[#B1B1B1] rounded-[5px] text-[15px] outline-none focus:border-[#005744] resize-none"
              />
            </div>
            <div className="flex gap-4 justify-center mt-2">
              <button
                type="button"
                onClick={doReject}
                disabled={!rejectTitle.trim() || actionLoading}
                className="w-[125px] h-[40px] rounded-[5px] bg-[#FF7979] text-white text-[15px] font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {actionLoading ? '처리 중…' : '반려'}
              </button>
              <button
                type="button"
                onClick={() => setRejectModal(false)}
                className="w-[125px] h-[40px] rounded-[5px] border border-[#005744] text-[#005744] text-[15px] font-medium hover:bg-[#005744] hover:text-white transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      {title && <h2 className="text-[17px] font-bold text-black mb-3">{title} <span className="text-[#FF5656]">*</span></h2>}
      <div className="border-t border-b border-[#C0C0C0]">
        {children}
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[173px_1fr] min-h-[52px] border-b border-[#ECECEC] last:border-b-0">
      <div className="bg-[#EAEAEA] px-5 flex items-center text-[14px] font-medium text-black">{label}</div>
      <div className="px-5 flex items-center text-[14px] text-[#333]">{children}</div>
    </div>
  )
}
