import { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../lib/auth'

type AdminRow = { idx: number; order: number; name: string; nickname: string; email: string; phone: string }
type PageData = { current_idx: number; sadmins: AdminRow[]; wadmins: AdminRow[] }

const HEADERS = { 'content-type': 'application/json', get ['x-user-id']() { return localStorage.getItem('hbd_user_id') ?? '' } }

export default function MypagePage() {
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'sadmin'

  const [data, setData] = useState<PageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<number>>(new Set())

  // 내 정보 수정 모달
  const [editModal, setEditModal] = useState(false)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editPw, setEditPw] = useState('')
  const [editCurrentPw, setEditCurrentPw] = useState('')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState('')

  // 관리자 추가 모달
  const [addModal, setAddModal] = useState(false)
  const [addId, setAddId] = useState('')
  const [addPw, setAddPw] = useState('')
  const [addName, setAddName] = useState('')
  const [addNickname, setAddNickname] = useState('')
  const [addEmail, setAddEmail] = useState('')
  const [addPhone, setAddPhone] = useState('')
  const [addPhoneCode, setAddPhoneCode] = useState('')
  const [addPhoneSent, setAddPhoneSent] = useState(false)
  const [addPhoneVerified, setAddPhoneVerified] = useState(false)
  const [addPhoneSending, setAddPhoneSending] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  const [toast, setToast] = useState('')
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500) }

  const load = () => {
    setLoading(true)
    fetch('/api/admin/mypage', { headers: HEADERS })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d as PageData) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openEdit = () => {
    setEditName(user?.name ?? '')
    setEditEmail('')
    setEditPw('')
    setEditCurrentPw('')
    setEditError('')
    setEditModal(true)
  }

  const handleEdit = async () => {
    setEditLoading(true); setEditError('')
    try {
      const body: Record<string, string> = {}
      if (editName.trim()) body.name = editName.trim()
      if (editEmail.trim()) body.email = editEmail.trim()
      if (editPw.trim()) { body.pw = editPw.trim(); body.current_pw = editCurrentPw.trim() }
      const res = await fetch('/api/admin/mypage', { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) })
      if (res.ok) { setEditModal(false); load(); showToast('정보가 수정되었습니다.') }
      else { const d = await res.json().catch(() => ({})) as { error?: string }; setEditError(d.error ?? '수정 실패') }
    } finally { setEditLoading(false) }
  }

  const sendPhoneCode = async () => {
    setAddPhoneSending(true); setAddError('')
    try {
      const res = await fetch('/api/admin/send-phone-code', { method: 'POST', headers: HEADERS, body: JSON.stringify({ phone: addPhone }) })
      if (res.ok) { setAddPhoneSent(true); setAddPhoneVerified(false); setAddPhoneCode('') }
      else { const d = await res.json().catch(() => ({})) as { error?: string }; setAddError(d.error ?? 'SMS 발송 실패') }
    } finally { setAddPhoneSending(false) }
  }

  const verifyPhoneCode = async () => {
    const res = await fetch('/api/admin/verify-phone-code', { method: 'POST', headers: HEADERS, body: JSON.stringify({ phone: addPhone, code: addPhoneCode }) })
    if (res.ok) setAddPhoneVerified(true)
    else { const d = await res.json().catch(() => ({})) as { error?: string }; setAddError(d.error ?? '인증 실패') }
  }

  const handleAdd = async () => {
    setAddLoading(true); setAddError('')
    try {
      const res = await fetch('/api/admin/wadmin', { method: 'POST', headers: HEADERS, body: JSON.stringify({ id: addId, pw: addPw, name: addName, nickname: addNickname, email: addEmail, phone: addPhone }) })
      if (res.ok) {
        setAddModal(false)
        setAddId(''); setAddPw(''); setAddName(''); setAddNickname(''); setAddEmail(''); setAddPhone(''); setAddPhoneCode(''); setAddPhoneSent(false); setAddPhoneVerified(false)
        load(); showToast('관리자가 추가되었습니다.')
      } else { const d = await res.json().catch(() => ({})) as { error?: string }; setAddError(d.error ?? '추가 실패') }
    } finally { setAddLoading(false) }
  }

  const [exportModal, setExportModal] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)

  const handleExport = async () => {
    setExportLoading(true)
    try {
      await fetch('/api/admin/wadmin', { method: 'DELETE', headers: HEADERS, body: JSON.stringify({ idxs: [...selected] }) })
      setSelected(new Set()); setExportModal(false); load(); showToast('내보내기 완료되었습니다.')
    } finally { setExportLoading(false) }
  }

  const toggleOne = (idx: number) => setSelected(prev => { const next = new Set(prev); next.has(idx) ? next.delete(idx) : next.add(idx); return next })
  const allChecked = !!data && data.wadmins.length > 0 && data.wadmins.every(r => selected.has(r.idx))
  const toggleAll = () => { if (!data) return; if (allChecked) setSelected(new Set()); else setSelected(new Set(data.wadmins.map(r => r.idx))) }

  return (
    <Layout title="마이페이지">
      {loading ? (
        <div className="py-20 text-center text-[14px] text-[#B5B5B5]">불러오는 중…</div>
      ) : data ? (
        <div className="max-w-[900px] space-y-10">
          {/* 슈퍼 관리자 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[24px] font-bold text-black">
                슈퍼 관리자 <span className="text-[#005744]">{data.sadmins.length}</span>
              </h2>
              <button type="button" onClick={openEdit}
                className="h-[38px] px-4 bg-[#005744] text-white text-[14px] font-medium rounded-[5px] hover:opacity-90 transition">
                내 정보 수정
              </button>
            </div>
            <div className="bg-white border border-[#DEDEDE] rounded-[10px] overflow-hidden">
              <div className="grid grid-cols-[60px_1fr_130px_1fr_130px] px-6 h-[48px] items-center bg-[#EAEAEA] border-b border-[#DEDEDE] text-[14px] font-medium text-[#202020] text-center">
                <span>순번</span><span>이름</span><span>닉네임</span><span>이메일</span><span>휴대폰</span>
              </div>
              {data.sadmins.map((r, i) => {
                const isMe = r.idx === data.current_idx
                return (
                  <div key={r.idx} className={`grid grid-cols-[60px_1fr_130px_1fr_130px] px-6 h-[52px] items-center text-[14px] text-center ${i < data.sadmins.length - 1 ? 'border-b border-[#DEDEDE]' : ''} ${isMe ? 'bg-[#F5FAF7]' : ''}`}>
                    <span className="text-[#585858]">{r.order}</span>
                    <span className="flex items-center justify-center gap-2 text-[#333] font-medium">
                      {r.name}
                      {isMe && <span className="text-[11px] bg-[#005744] text-white px-2 py-0.5 rounded-full font-semibold">나</span>}
                    </span>
                    <span className="text-[#585858]">{r.nickname}</span>
                    <span className="text-[#585858]">{r.email}</span>
                    <span className="text-[#585858]">{r.phone}</span>
                  </div>
                )
              })}
            </div>
          </section>

          {/* 일반 관리자 */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[24px] font-bold text-black">
                일반 관리자 <span className="text-[#005744]">{data.wadmins.length}</span>
              </h2>
              {isSuperAdmin && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setAddError(''); setAddModal(true) }}
                    className="h-[38px] px-4 border border-[#005744] text-[#005744] text-[14px] font-medium rounded-[5px] hover:bg-[#005744] hover:text-white transition">
                    관리자 추가
                  </button>
                  <button type="button"
                    onClick={() => { if (selected.size > 0) setExportModal(true) }}
                    disabled={selected.size === 0}
                    className="h-[38px] px-4 bg-[#005744] text-white text-[14px] font-medium rounded-[5px] hover:opacity-90 transition disabled:opacity-40">
                    내보내기
                  </button>
                </div>
              )}
            </div>
            <div className="bg-white border border-[#DEDEDE] rounded-[10px] overflow-hidden">
              <div className="grid grid-cols-[48px_80px_1fr_160px_1fr] px-6 h-[48px] items-center bg-[#EAEAEA] border-b border-[#DEDEDE] text-[14px] font-medium text-[#202020] text-center">
                {isSuperAdmin && (
                  <span className="flex items-center justify-center">
                    <Checkbox checked={allChecked} onChange={toggleAll} />
                  </span>
                )}
                {!isSuperAdmin && <span />}
                <span>순번</span><span>이름</span><span>닉네임</span><span>이메일</span>
              </div>
              {data.wadmins.length === 0 ? (
                <div className="py-10 text-center text-[14px] text-[#B5B5B5]">등록된 일반 관리자가 없습니다.</div>
              ) : data.wadmins.map((r, i) => {
                const isMe = r.idx === data.current_idx
                return (
                  <div key={r.idx} className={`grid grid-cols-[48px_80px_1fr_160px_1fr] px-6 h-[52px] items-center text-[14px] text-center ${i < data.wadmins.length - 1 ? 'border-b border-[#DEDEDE]' : ''} ${isMe ? 'bg-[#F5FAF7]' : ''}`}>
                    <span className="flex items-center justify-center">
                      {isSuperAdmin ? <Checkbox checked={selected.has(r.idx)} onChange={() => toggleOne(r.idx)} /> : null}
                    </span>
                    <span className="text-[#585858]">{r.order}</span>
                    <span className="flex items-center justify-center gap-2 text-[#333] font-medium">
                      {r.name}
                      {isMe && <span className="text-[11px] bg-[#005744] text-white px-2 py-0.5 rounded-full font-semibold">나</span>}
                    </span>
                    <span className="text-[#585858]">{r.nickname}</span>
                    <span className="text-[#585858]">{r.email}</span>
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      ) : (
        <div className="py-20 text-center text-[14px] text-[#B5B5B5]">데이터를 불러올 수 없습니다.</div>
      )}

      {/* 내 정보 수정 모달 */}
      {editModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] w-[460px] px-8 py-8 flex flex-col gap-4">
            <p className="text-[20px] font-bold text-black">내 정보 수정</p>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#585858]">이름</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                className="h-[42px] px-3 border border-[#B1B1B1] rounded-[5px] text-[14px] outline-none focus:border-[#005744]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#585858]">이메일</label>
              <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="변경할 이메일"
                className="h-[42px] px-3 border border-[#B1B1B1] rounded-[5px] text-[14px] outline-none focus:border-[#005744]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#585858]">현재 비밀번호 (비밀번호 변경 시)</label>
              <input type="password" value={editCurrentPw} onChange={e => setEditCurrentPw(e.target.value)} placeholder="현재 비밀번호"
                className="h-[42px] px-3 border border-[#B1B1B1] rounded-[5px] text-[14px] outline-none focus:border-[#005744]" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-medium text-[#585858]">새 비밀번호</label>
              <input type="password" value={editPw} onChange={e => setEditPw(e.target.value)} placeholder="새 비밀번호"
                className="h-[42px] px-3 border border-[#B1B1B1] rounded-[5px] text-[14px] outline-none focus:border-[#005744]" />
            </div>
            {editError && <p className="text-[13px] text-[#FF4646]">{editError}</p>}
            <div className="flex gap-3 justify-center mt-2">
              <button type="button" onClick={handleEdit} disabled={editLoading}
                className="w-[140px] h-[42px] rounded-[5px] bg-[#005744] text-white text-[14px] font-medium hover:opacity-90 transition disabled:opacity-50">
                {editLoading ? '저장 중…' : '저장'}
              </button>
              <button type="button" onClick={() => setEditModal(false)}
                className="w-[140px] h-[42px] rounded-[5px] border border-[#005744] text-[#005744] text-[14px] font-medium hover:bg-[#005744] hover:text-white transition">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 내보내기 확인 모달 */}
      {exportModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] w-[400px] px-8 py-8 relative flex flex-col items-center gap-5">
            <button type="button" onClick={() => setExportModal(false)} className="absolute top-5 right-5 text-[#9E9E9E] hover:text-[#333]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>
            <p className="text-[20px] font-bold text-black">일반 관리자 내보내기</p>
            <p className="text-[14px] text-[#585858] text-center leading-[22px]">
              내보내기 처리 시 관리자 권한이 제거되며<br/>관리자 페이지에 접근할 수 없습니다.
            </p>
            <div className="flex gap-3 mt-2">
              <button type="button" onClick={() => setExportModal(false)}
                className="w-[140px] h-[44px] rounded-[8px] border border-[#ADB5BD] text-[#333] text-[15px] font-semibold hover:bg-[#F5F5F5] transition">
                취소
              </button>
              <button type="button" onClick={handleExport} disabled={exportLoading}
                className="w-[140px] h-[44px] rounded-[8px] border border-[#FF4646] text-[#FF4646] text-[15px] font-semibold hover:bg-[#FF4646] hover:text-white transition disabled:opacity-50">
                {exportLoading ? '처리 중…' : '내보내기'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 관리자 추가 모달 */}
      {addModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-[10px] w-[500px] px-8 py-8 relative flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setAddModal(false)} className="absolute top-5 right-5 text-[#9E9E9E] hover:text-[#333]">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 2L14 14M14 2L2 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
            </button>
            <p className="text-[20px] font-bold text-black">관리자 등록 정보</p>

            <div className="flex flex-col gap-1">
              <label className="text-[14px] font-medium text-[#333]">이름</label>
              <input type="text" value={addName} onChange={e => setAddName(e.target.value)}
                placeholder="이름을 입력해주세요."
                className="h-[48px] px-4 border border-[#B1B1B1] rounded-[8px] text-[14px] outline-none focus:border-[#005744] placeholder:text-[#C0C0C0]" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[14px] font-medium text-[#333]">닉네임</label>
              <input type="text" value={addNickname} onChange={e => setAddNickname(e.target.value)}
                placeholder="닉네임을 입력해주세요."
                className="h-[48px] px-4 border border-[#B1B1B1] rounded-[8px] text-[14px] outline-none focus:border-[#005744] placeholder:text-[#C0C0C0]" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[14px] font-medium text-[#333]">아이디</label>
              <input type="text" value={addId} onChange={e => setAddId(e.target.value)}
                placeholder="아이디를 입력해주세요."
                className="h-[48px] px-4 border border-[#B1B1B1] rounded-[8px] text-[14px] outline-none focus:border-[#005744] placeholder:text-[#C0C0C0]" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[14px] font-medium text-[#333]">비밀번호</label>
              <input type="password" value={addPw} onChange={e => setAddPw(e.target.value)}
                placeholder="비밀번호를 입력해주세요."
                className="h-[48px] px-4 border border-[#B1B1B1] rounded-[8px] text-[14px] outline-none focus:border-[#005744] placeholder:text-[#C0C0C0]" />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[14px] font-medium text-[#333]">이메일 (선택)</label>
              <input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)}
                placeholder="이메일을 입력해주세요."
                className="h-[48px] px-4 border border-[#B1B1B1] rounded-[8px] text-[14px] outline-none focus:border-[#005744] placeholder:text-[#C0C0C0]" />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-medium text-[#333]">휴대폰 번호</label>
              <div className="flex gap-2">
                <input type="tel" value={addPhone} onChange={e => { setAddPhone(e.target.value); setAddPhoneSent(false); setAddPhoneVerified(false) }}
                  placeholder="010-0000-0000"
                  className="flex-1 h-[48px] px-4 border border-[#B1B1B1] rounded-[8px] text-[14px] outline-none focus:border-[#005744] placeholder:text-[#C0C0C0]" />
                <button type="button" onClick={sendPhoneCode}
                  disabled={!addPhone.trim() || addPhoneVerified || addPhoneSending}
                  className="shrink-0 h-[48px] px-4 border border-[#005744] text-[#005744] text-[13px] font-medium rounded-[8px] hover:bg-[#005744] hover:text-white transition disabled:opacity-40 whitespace-nowrap">
                  {addPhoneSending ? '발송 중…' : '인증번호 발송'}
                </button>
              </div>
              {addPhoneSent && (
                <div className="flex gap-2">
                  <input type="text" value={addPhoneCode} onChange={e => setAddPhoneCode(e.target.value)}
                    placeholder="인증번호 6자리 입력"
                    className="flex-1 h-[48px] px-4 border border-[#B1B1B1] rounded-[8px] text-[14px] outline-none focus:border-[#005744] placeholder:text-[#C0C0C0]" />
                  <button type="button" onClick={verifyPhoneCode}
                    disabled={!addPhoneCode.trim() || addPhoneVerified}
                    className="shrink-0 h-[48px] px-4 border border-[#005744] text-[#005744] text-[13px] font-medium rounded-[8px] hover:bg-[#005744] hover:text-white transition disabled:opacity-40 whitespace-nowrap">
                    {addPhoneVerified ? '✓ 인증완료' : '인증확인'}
                  </button>
                </div>
              )}
            </div>

            {addError && <p className="text-[13px] text-[#FF4646]">{addError}</p>}

            <div className="flex gap-3 justify-center mt-2">
              <button type="button" onClick={handleAdd}
                disabled={addLoading || !addId.trim() || !addPw.trim() || !addName.trim()}
                className="w-[160px] h-[48px] rounded-[8px] bg-[#005744] text-white text-[15px] font-semibold hover:opacity-90 transition disabled:opacity-50">
                {addLoading ? '추가 중…' : '확인'}
              </button>
              <button type="button" onClick={() => setAddModal(false)}
                className="w-[160px] h-[48px] rounded-[8px] border border-[#ADB5BD] text-[#333] text-[15px] font-semibold hover:bg-[#F5F5F5] transition">
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[#333333] text-white text-[15px] px-6 py-3 rounded-[8px] shadow-lg z-50">
          {toast}
        </div>
      )}
    </Layout>
  )
}

function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`w-[18px] h-[18px] rounded-[3px] border flex items-center justify-center transition-colors ${checked ? 'bg-[#005744] border-[#005744]' : 'bg-white border-[#575757]'}`}>
      {checked && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
    </button>
  )
}
