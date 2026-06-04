import { useEffect, useState } from 'react'
import Layout from '../components/Layout'

type StatusFilter = 'active' | 'inactive' | 'all'

type TherapistRow = {
  idx: number
  name: string
  code: string | null
  instt_code: string
  instt_name: string
  child_count: number | null
  regist_date: string
  approval_status: string | null
}

type TherapistDetail = {
  idx: number; id: string; name: string; phone: string | null; email: string | null
  instt_code: string | null; depart_code: string | null
  license_file_nm: string | null; file_idx: number | null
  regist_date: string | null; is_reapply: boolean; admin_memo: string | null
}

const REJECT_REASONS = ['자격 정보 확인 불가', '파일 식별 어려움', '회원정보 불일치', '직접 입력']

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }
const PAGE_SIZE = 20

export default function TherapistsPage() {
  const [rows, setRows] = useState<TherapistRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [approveLoading, setApproveLoading] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState<number[] | null>(null)
  const [confirmApproveName, setConfirmApproveName] = useState<string>('')
  const [detailIdx, setDetailIdx] = useState<number | null>(null)
  const [detail, setDetail] = useState<TherapistDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rejectModal, setRejectModal] = useState<{ idx: number; name: string; instt_code: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('자격 정보 확인 불가')
  const [rejectCustom, setRejectCustom] = useState('')
  const [rejectLoading, setRejectLoading] = useState(false)
  const [fileLoading, setFileLoading] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  const fetchData = async (s: StatusFilter, q: string, p: number) => {
    setLoading(true)
    setSelected(new Set())
    try {
      const params = new URLSearchParams({ status: s, page: String(p) })
      if (q) params.set('search', q)
      const res = await fetch(`/api/admin/therapists?${params}`, { headers: HEADERS })
      if (res.ok) {
        const data = await res.json() as { rows: TherapistRow[]; total: number }
        setRows(data.rows)
        setTotal(data.total)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData(statusFilter, search, page) }, [statusFilter, page])

  const openDetail = async (idx: number) => {
    setDetailIdx(idx); setDetail(null); setImageUrl(null); setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/therapist-detail?idx=${idx}`, { headers: HEADERS })
      if (res.ok) setDetail(await res.json() as TherapistDetail)
    } finally { setDetailLoading(false) }
  }

  const loadImage = async (fileIdx: number) => {
    setFileLoading(true)
    try {
      const res = await fetch(`/api/admin/approval-file?historyIdx=${fileIdx}`, { headers: HEADERS })
      if (!res.ok) return
      const data = await res.json() as { source_file_nm: string | null; file_data: string }
      const byteStr = atob(data.file_data)
      const bytes = new Uint8Array(byteStr.length)
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i)
      const nm = data.source_file_nm ?? 'file'
      const ext = nm.split('.').pop()?.toLowerCase() ?? ''
      const mime = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg'
      const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
      setImageUrl(url)
    } finally { setFileLoading(false) }
  }

  const downloadFile = async (fileIdx: number, fileName: string | null) => {
    const res = await fetch(`/api/admin/approval-file?historyIdx=${fileIdx}`, { headers: HEADERS })
    if (!res.ok) return
    const data = await res.json() as { source_file_nm: string | null; file_data: string }
    const byteStr = atob(data.file_data)
    const bytes = new Uint8Array(byteStr.length)
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i)
    const nm = data.source_file_nm ?? fileName ?? 'file'
    const ext = nm.split('.').pop()?.toLowerCase() ?? ''
    const mime = ext === 'pdf' ? 'application/pdf' : ext === 'png' ? 'image/png' : 'image/jpeg'
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
    const a = document.createElement('a'); a.href = url; a.download = nm
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  const doReject = async () => {
    if (!rejectModal) return
    const reason = rejectReason === '직접 입력' ? rejectCustom.trim() : rejectReason
    if (!reason) return
    setRejectLoading(true)
    try {
      const res = await fetch('/api/admin/therapists/reject', {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ idx: rejectModal.idx, reason })
      })
      if (res.ok) {
        setRejectModal(null); setDetail(null); setDetailIdx(null)
        fetchData(statusFilter, search, page)
      }
    } finally { setRejectLoading(false) }
  }

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
    fetchData(statusFilter, searchInput, 1)
  }

  const doApprove = async (idxs: number[]) => {
    setApproveLoading(true)
    try {
      const res = await fetch('/api/admin/therapists/approve', {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ idxs })
      })
      if (res.ok) {
        setConfirmApprove(null)
        fetchData(statusFilter, search, page)
      }
    } finally {
      setApproveLoading(false)
    }
  }

  const pendingSelectedIdxs = [...selected].filter(idx => rows.find(r => r.idx === idx)?.approval_status === '승인대기')
  const allChecked = rows.length > 0 && rows.every(r => selected.has(r.idx))
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(rows.map(r => r.idx)))
  const toggleOne = (idx: number) => setSelected(prev => {
    const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next
  })
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <Layout title="치료사 관리">
      {/* 상단 컨트롤 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-8">
          <p className="text-[18px]">
            <span className="text-[#919191] font-semibold">치료사 목록</span>
            <span className="text-[#005744] font-semibold ml-2">{total}</span>
          </p>
          <div className="flex items-center gap-5">
            {(['all', 'active', 'inactive'] as StatusFilter[]).map(s => (
              <label
                key={s}
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => { setStatusFilter(s); setPage(1) }}
              >
                <span className={`w-[17px] h-[17px] rounded-[3px] border flex items-center justify-center ${statusFilter === s ? 'bg-[#005744] border-[#005744]' : 'bg-white border-[#000000]'}`}>
                  {statusFilter === s && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
                <span className="text-[15px] text-[#2F2E2E]">
                  {s === 'active' ? '재직 유저' : s === 'inactive' ? '휴직 유저' : '전체 유저'}
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={pendingSelectedIdxs.length === 0}
            onClick={() => setConfirmApprove(pendingSelectedIdxs)}
            className="h-[40px] px-4 border border-[#005744] text-[#005744] rounded-[5px] text-[14px] font-medium hover:bg-[#005744] hover:text-white transition disabled:opacity-40"
          >
            일괄 승인
          </button>
          <div className="flex items-center h-[40px] px-3 border border-[#ADB5BD] rounded-[5px] gap-2 w-[220px] overflow-hidden">
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="검색"
              className="flex-1 min-w-0 text-[14px] outline-none placeholder:text-[#B5B5B5]"
            />
            <button type="button" onClick={handleSearch}>
              <svg width="17" height="17" viewBox="0 0 17 17" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="#ADB5BD" strokeWidth="1.5"/>
                <path d="M11 11L15 15" stroke="#ADB5BD" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-[10px] border border-[#DEDEDE] overflow-hidden">
        <div className="grid grid-cols-[40px_60px_1fr_160px_160px_120px_140px_110px] px-6 py-3 bg-[#EAEAEA] border-b border-[#DEDEDE] text-[15px] font-medium text-[#202020]">
          <span className="flex items-center">
            <Checkbox checked={allChecked} onChange={toggleAll} />
          </span>
          <span>순번</span>
          <span>등록 기관명</span>
          <span>이름</span>
          <span>식별코드</span>
          <span>담당 아동 수</span>
          <span>가입일시</span>
          <span></span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-[14px] text-[#B5B5B5]">데이터가 없습니다.</div>
        ) : rows.map((r, i) => (
          <div
            key={r.idx}
            className={`grid grid-cols-[40px_60px_1fr_160px_160px_120px_140px_110px] px-6 py-3 items-center text-[15px] ${i < rows.length - 1 ? 'border-b border-[#DEDEDE]' : ''}`}
          >
            <span><Checkbox checked={selected.has(r.idx)} onChange={() => toggleOne(r.idx)} /></span>
            <span className="text-[#585858]">{(page - 1) * PAGE_SIZE + i + 1}</span>
            <span className="text-[#585858] truncate pr-2">{r.instt_name}</span>
            <span className="text-[#585858]">{r.name}</span>
            <span className="text-[#484848]">{r.code ?? '-'}</span>
            <span className="text-[#484848]">{r.child_count !== null ? r.child_count : '-'}</span>
            <span className="text-[#585858]">{r.regist_date}</span>
            <span className="flex justify-center">
              {r.approval_status === '승인대기' && (
                <button
                  type="button"
                  onClick={() => openDetail(r.idx)}
                  className="w-[78px] h-[28px] rounded-[5px] border border-[#FF3B3B] text-[#FF3B3B] text-[13px] font-medium hover:bg-[#FF3B3B] hover:text-white transition"
                >
                  승인 대기
                </button>
              )}
            </span>
          </div>
        ))}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-4">
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-[29px] h-[27px] rounded-[5px] bg-[#D9D9D9] text-[#5D5D5D] text-[13px] hover:bg-[#B5B5B5] disabled:opacity-40 transition flex items-center justify-center"
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M6 1L1 6L6 11" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              className={`w-[29px] h-[27px] rounded-[5px] text-[13px] transition ${page === p ? 'bg-[#005744] text-white' : 'bg-[#D9D9D9] text-[#5D5D5D] hover:bg-[#B5B5B5]'}`}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-[29px] h-[27px] rounded-[5px] bg-[#D9D9D9] text-[#5D5D5D] text-[13px] hover:bg-[#B5B5B5] disabled:opacity-40 transition flex items-center justify-center"
          >
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none">
              <path d="M1 1L6 6L1 11" stroke="#777777" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* 승인 확인 모달 */}
      {confirmApprove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-[10px] w-[400px] px-8 py-8 relative flex flex-col items-center gap-5">
            <button type="button" onClick={() => setConfirmApprove(null)} className="absolute top-5 right-5 text-[#707070] hover:text-[#333]">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 1L14 14M14 1L1 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <p className="text-[20px] font-bold text-[#2F2E2E]">치료사 승인</p>
            <p className="text-[14px] text-[#585858] text-center leading-[22px]">
              {confirmApprove.length === 1 && confirmApproveName
                ? <><span className="font-bold">[{confirmApproveName}]</span> 의 가입 신청을 승인하시겠습니까?<br/>승인된 치료사는 서비스를 이용할 수 있습니다.</>
                : `선택한 ${confirmApprove.length}명의 치료사를 일괄 승인하시겠습니까?`}
            </p>
            <div className="flex gap-4 mt-2">
              <button
                type="button"
                onClick={() => doApprove(confirmApprove)}
                disabled={approveLoading}
                className="w-[125px] h-[40px] rounded-[5px] bg-[#005744] text-white text-[15px] font-medium hover:opacity-90 transition disabled:opacity-50"
              >
                {approveLoading ? '처리 중…' : '승인'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmApprove(null)}
                className="w-[125px] h-[40px] rounded-[5px] border border-[#005744] text-[#005744] text-[15px] font-medium hover:bg-[#005744] hover:text-white transition"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 치료사 자격 상세 모달 */}
      {detailIdx !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] w-[600px] max-h-[85vh] flex flex-col overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-[#DEDEDE]">
              <div className="flex items-center gap-3">
                <p className="text-[18px] font-bold text-black">치료사 자격 상세</p>
                {detail && (
                  <span className={`text-[12px] font-semibold px-3 py-1 rounded-full ${detail.is_reapply ? 'bg-[#FFF0E0] text-[#FF8C00]' : 'bg-[#E8F5E9] text-[#005744]'}`}>
                    {detail.is_reapply ? '재신청' : '신규 신청'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {detail && <span className="text-[13px] text-[#727272]">가입일시 {detail.regist_date}</span>}
                <button type="button" onClick={() => { setDetailIdx(null); setDetail(null); setImageUrl(null) }} className="text-[#707070] hover:text-[#333]">
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 1L14 14M14 1L1 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
            </div>

            {detailLoading ? (
              <div className="flex-1 flex items-center justify-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
            ) : detail ? (
              <div className="flex-1 overflow-y-auto px-7 py-5 space-y-6">
                {/* 기본 정보 */}
                <div>
                  <p className="text-[15px] font-bold text-black mb-3">기본 정보</p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[14px]">
                    <InfoRow label="이름" value={detail.name} />
                    <InfoRow label="아이디" value={detail.id} />
                    <InfoRow label="휴대전화" value={detail.phone ?? '-'} />
                    <InfoRow label="기관 코드" value={detail.instt_code ?? '-'} />
                    <InfoRow label="이메일" value={detail.email ?? '-'} />
                    <InfoRow label="소속과" value={detail.depart_code ?? '-'} />
                  </div>
                </div>

                {/* 자격 정보 */}
                <div>
                  <p className="text-[15px] font-bold text-black mb-3">자격 정보</p>
                  <div className="space-y-3 text-[14px]">
                    {detail.license_file_nm && (
                      <div className="flex items-center gap-2">
                        <span className="text-[#727272] w-[90px] shrink-0">자격 첨부파일</span>
                        <div className="flex items-center gap-2 flex-1">
                          <div className="flex items-center gap-2 border border-[#DEDEDE] rounded-[6px] px-3 py-2 flex-1">
                            <svg width="14" height="16" viewBox="0 0 14 16" fill="none"><rect x="1" y="1" width="12" height="14" rx="2" fill="white" stroke="#ADB5BD" strokeWidth="1.2"/><path d="M4 1v4h4" stroke="#ADB5BD" strokeWidth="1.2"/></svg>
                            <span className="flex-1 text-[13px] text-[#333] truncate">{detail.license_file_nm}</span>
                          </div>
                          {detail.file_idx && (
                            <button type="button" onClick={() => downloadFile(detail.file_idx!, detail.license_file_nm)}
                              className="shrink-0 w-[32px] h-[32px] border border-[#005744] text-[#005744] rounded-[6px] flex items-center justify-center hover:bg-[#005744] hover:text-white transition">
                              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6.5 1v8M3 6.5l3.5 3.5 3.5-3.5"/><path d="M1 11h11"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {detail.file_idx && (
                      <div className="mt-1">
                        <button type="button" onClick={() => loadImage(detail.file_idx!)} disabled={fileLoading}
                          className="h-[32px] px-4 border border-[#ADB5BD] text-[#555] text-[13px] rounded-[5px] hover:bg-[#F5F5F5] transition disabled:opacity-50">
                          {fileLoading ? '불러오는 중…' : '이미지 확대 보기'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {/* 버튼 */}
            <div className="flex gap-3 justify-center py-5 border-t border-[#DEDEDE]">
              <button type="button"
                onClick={() => { if (detail) setRejectModal({ idx: detail.idx, name: detail.name, instt_code: detail.instt_code ?? '' }); setRejectReason('자격 정보 확인 불가'); setRejectCustom('') }}
                className="w-[140px] h-[44px] rounded-[8px] border-2 border-[#FF4646] text-[#FF4646] text-[15px] font-semibold hover:bg-[#FF4646] hover:text-white transition">
                반려
              </button>
              <button type="button"
                onClick={() => { if (detail) { setConfirmApprove([detail.idx]); setConfirmApproveName(detail.name) } }}
                className="w-[140px] h-[44px] rounded-[8px] bg-[#005744] text-white text-[15px] font-semibold hover:opacity-90 transition">
                승인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 이미지 뷰어 오버레이 */}
      {imageUrl && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70]" onClick={() => setImageUrl(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setImageUrl(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 flex items-center gap-1 text-[14px]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              닫기
            </button>
            <img src={imageUrl} alt="자격증" className="max-w-full max-h-[85vh] object-contain rounded-[8px] shadow-2xl" />
          </div>
        </div>
      )}

      {/* 반려 사유 모달 */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-[10px] w-[440px] px-8 py-7 relative">
            <button type="button" onClick={() => setRejectModal(null)} className="absolute top-5 right-5 text-[#707070] hover:text-[#333]">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 1L14 14M14 1L1 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <p className="text-[18px] font-bold text-black mb-1">치료사 반려</p>
            <p className="text-[13px] text-[#727272] mb-5">치료사 {rejectModal.name} &nbsp; 기관코드 {rejectModal.instt_code}</p>

            <div className="flex flex-col gap-2 mb-5">
              <label className="text-[14px] font-medium text-[#333]">사유</label>
              <div className="relative">
                <select
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full h-[44px] px-3 pr-8 border border-[#DEDEDE] rounded-[8px] text-[14px] text-[#333] outline-none appearance-none bg-white focus:border-[#005744]"
                >
                  {REJECT_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1L6 6L11 1" stroke="#727272" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              {rejectReason === '직접 입력' && (
                <textarea value={rejectCustom} onChange={e => setRejectCustom(e.target.value)}
                  placeholder="반려 사유를 직접 입력해주세요."
                  rows={3}
                  className="w-full px-3 py-2 border border-[#DEDEDE] rounded-[8px] text-[14px] outline-none focus:border-[#005744] resize-none mt-1"/>
              )}
            </div>

            <div className="flex gap-3 justify-center">
              <button type="button" onClick={doReject} disabled={rejectLoading || (rejectReason === '직접 입력' && !rejectCustom.trim())}
                className="w-[140px] h-[44px] rounded-[8px] bg-[#005744] text-white text-[15px] font-semibold hover:opacity-90 transition disabled:opacity-50">
                {rejectLoading ? '처리 중…' : '반려'}
              </button>
              <button type="button" onClick={() => setRejectModal(null)}
                className="w-[140px] h-[44px] rounded-[8px] border border-[#005744] text-[#005744] text-[15px] font-semibold hover:bg-[#005744] hover:text-white transition">
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#727272] w-[70px] shrink-0">{label}</span>
      <span className="text-[#333] font-medium">{value}</span>
    </div>
  )
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-colors ${checked ? 'bg-[#005744] border-[#005744]' : 'bg-white border-[#575757]'}`}
    >
      {checked && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </button>
  )
}

