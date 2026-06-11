import { useEffect, useMemo, useState, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import TopBar from '../components/TopBar'
import { useRouter } from '../lib/router'
import { useAuth, roleLabel, type Role } from '../lib/auth'
import { api, type ChildDetailDto, type DiagnosisListItem, type TreatmentListItem, type StaffItem } from '../lib/api'

type Props = { id: number }

const FALLBACK_DETAIL: ChildDetailDto = {
  child: {
    id: 1,
    identifier: 'HBD_P_001',
    name: '김동동',
    birth_date: '2019.05.12',
    age_label: '만 6세',
    primary_diagnosis: '조음장애',
    service_started_at: '2025.12.01',
    app_login_id: 'kimdongdong',
    next_doctor_appointment: '2025.11.25',
    next_therapy_appointment: null,
    doctor_id: 'HBD_D_001',
    doctor_name: '김OO',
    doctor_department: '재활의학과',
    therapist_id: 'HBD_T_001',
    therapist_name: '김민지',
    therapist_department: '언어치료학과',
    therapist_schedule: '매주 월 16:00'
  },
  memos: []
}

const FALLBACK_DIAGNOSES: DiagnosisListItem[] = []

const FALLBACK_TREATMENTS: TreatmentListItem[] = [
  { id: 1, treated_at: '2025.11.24', session_no: 13, trained_sound: '어두초성 ㅅ', tags_json: '["1음절","룰렛"]',  try_count: 30, avg_accuracy_pct: 45, duration_minutes: 15 },
  { id: 2, treated_at: '2025.11.20', session_no: 12, trained_sound: '어두초성 ㅅ', tags_json: '["1음절","주사위"]', try_count: 35, avg_accuracy_pct: 52, duration_minutes: 14 },
  { id: 3, treated_at: '2025.11.16', session_no: 11, trained_sound: '어두초성 ㅅ', tags_json: '["1음절","문장"]',  try_count: 40, avg_accuracy_pct: 60, duration_minutes: 16 }
]

export default function ChildDetail({ id }: Props) {
  const { go } = useRouter()
  const { user } = useAuth()
  const isClinical = user?.institutionCode === 'HBD' || user?.institutionCode === 'TEST'
  const [detail, setDetail] = useState<ChildDetailDto>(FALLBACK_DETAIL)
  const [diagnoses, setDiagnoses] = useState<DiagnosisListItem[]>(FALLBACK_DIAGNOSES)
  const [treatments, setTreatments] = useState<TreatmentListItem[]>(FALLBACK_TREATMENTS)
  const [showRediagModal, setShowRediagModal] = useState(false)
  const [rediagDate, setRediagDate] = useState<string | null>(null)
  const [customDismissed, setCustomDismissed] = useState(false)

  const needsCustomChange = useMemo(() => {
    const diagAcc = diagnoses[0]?.accuracy_pct ?? null
    const trainAcc = treatments[0]?.avg_accuracy_pct ?? null
    return diagAcc !== null && trainAcc !== null && trainAcc >= diagAcc + 5
  }, [diagnoses, treatments])

  useEffect(() => {
    const acked = localStorage.getItem(`hbd_custom_ack_${id}`)
    if (!acked) { setCustomDismissed(false); return }
    const [ackedDiag, ackedAccStr] = acked.split('|')
    const diagKey = diagnoses.length > 0 ? diagnoses[0].examined_at.slice(0, 10) : String(id)
    if (ackedDiag !== diagKey) { setCustomDismissed(false); return }
    const ackedAcc = ackedAccStr !== undefined && ackedAccStr !== '' ? Number(ackedAccStr) : null
    const currentTrainAcc = treatments[0]?.avg_accuracy_pct ?? 0
    setCustomDismissed(ackedAcc === null || currentTrainAcc < ackedAcc + 5)
  }, [diagnoses, treatments, id])

  const dismissCustomBanner = useCallback(() => {
    const diagKey = diagnoses.length > 0 ? diagnoses[0].examined_at.slice(0, 10) : String(id)
    const trainAcc = treatments[0]?.avg_accuracy_pct ?? ''
    localStorage.setItem(`hbd_custom_ack_${id}`, `${diagKey}|${trainAcc}`)
    setCustomDismissed(true)
  }, [diagnoses, treatments, id])

  const loadDetail = () => api.childDetail(id).then(setDetail).catch(() => {})

  useEffect(() => {
    loadDetail()
    api.childDiagnoses(id).then(rows => {
      setDiagnoses(rows)
      if (rows.length > 0) {
        const datePart = rows[0].examined_at.slice(0, 10).replace(/\./g, '-')
        const diagMs = new Date(datePart).getTime()
        const todayMs = new Date(new Date().toISOString().slice(0, 10)).getTime()
        if (isClinical && !isNaN(diagMs) && todayMs - diagMs >= 14 * 86400000) {
          setRediagDate(rows[0].examined_at.slice(0, 10))
          setShowRediagModal(true)
        }
      }
    }).catch(() => {})
    api.childTreatments(id).then(setTreatments).catch(() => {})
  }, [id])

  const memoByType = useMemo(() => {
    const m: Record<Role, { content: string; updated_at: string } | null> = {
      admin: null,
      doctor: null,
      therapist: null
    }
    for (const r of detail.memos) m[r.type] = { content: r.content, updated_at: r.updated_at }
    return m
  }, [detail.memos])

  return (
    <div className="min-h-screen flex bg-surface">
      <Sidebar />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar />

        <main className="flex-1 px-6 lg:px-10 py-8 space-y-12">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-semibold text-ink-900">아동 정보</h2>
            <button
              type="button"
              onClick={() => go({ name: 'list' })}
              className="text-[12px] text-ink-900 hover:text-brand transition-colors"
            >
              목록으로 돌아가기 &gt;
            </button>
          </div>

          {/* 커스텀 변경 안내 배너 */}
          {needsCustomChange && !customDismissed && (
            <div className="w-full border border-[#005744] rounded-[10px] bg-white flex items-center gap-6 px-8 py-5">
              <div className="flex-shrink-0 w-[56px] h-[56px] rounded-full bg-[#EEF5F0] flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                  <polyline points="2,20 9,12 14,16 24,6" stroke="#005744" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="18,6 24,6 24,12" stroke="#005744" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-black mb-1">훈련 목표 검토 안내</p>
                <p className="text-[13px] font-medium text-black leading-relaxed">
                  아동의 발음 정확도가 진단 대비 5% 이상 향상되었습니다. 다음 훈련을 위해 커스텀 설정을 변경하시겠습니까?
                </p>
                <p className="text-[12px] font-medium text-[#767676] mt-0.5">
                  ※ 현재 설정을 유지할 경우, 이후 정확도가 추가 향상되면 다시 안내됩니다.
                </p>
              </div>
              <div className="flex-shrink-0 flex gap-3">
                <button
                  type="button"
                  onClick={() => { dismissCustomBanner(); go({ name: 'custom-detail', id }) }}
                  className="w-[125px] h-[40px] rounded-[5px] bg-[#005744] text-white text-[14px] font-medium hover:opacity-90 transition"
                >
                  커스텀 설정 변경
                </button>
                <button
                  type="button"
                  onClick={dismissCustomBanner}
                  className="w-[125px] h-[40px] rounded-[5px] border border-[#005744] text-black text-[14px] font-medium hover:bg-[#005744]/5 transition"
                >
                  나중에 변경하기
                </button>
              </div>
            </div>
          )}

          {/* Info Table */}
          <InfoCard child={detail.child} childId={id} onUpdate={loadDetail} />

          {/* Memo Cards */}
          <section>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <MemoCard
                childId={id}
                role="admin"
                initial={memoByType.admin?.content ?? ''}
                lastEdited={memoByType.admin?.content ? (memoByType.admin.updated_at ?? '-') : '-'}
              />
              <MemoCard
                childId={id}
                role="doctor"
                initial={memoByType.doctor?.content ?? ''}
                lastEdited={memoByType.doctor?.content ? (memoByType.doctor.updated_at ?? '-') : '-'}
              />
              <MemoCard
                childId={id}
                role="therapist"
                initial={memoByType.therapist?.content ?? ''}
                lastEdited={memoByType.therapist?.content ? (memoByType.therapist.updated_at ?? '-') : '-'}
              />
            </div>
          </section>

          {/* 진단 이력 */}
          <DiagnosisSection childId={id} identifier={detail.child.identifier} diagnoses={diagnoses} />

          {/* 치료 이력 */}
          <TreatmentSection childId={id} identifier={detail.child.identifier} treatments={treatments} />

          <div className="text-[12px] text-ink-400 pt-4">아동 ID: {id}</div>
        </main>
      </div>

      {showRediagModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="relative w-[400px] bg-white rounded-[10px] shadow-lg py-10 px-8 flex flex-col items-center">
            <button
              type="button"
              onClick={() => setShowRediagModal(false)}
              className="absolute top-[21px] right-[21px] w-[15px] h-[15px] flex items-center justify-center text-[#707070] hover:text-ink-700"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M2 2L13 13M13 2L2 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>

            <h2 className="text-[20px] font-bold text-ink-800 mb-[18px]">재진단 안내</h2>

            <p className="text-[12px] font-medium text-ink-800 text-center leading-[18px] mb-3">
              진단 후 2주가 경과했습니다.<br />
              아이의 발음 변화를 확인하기 위해 재진단을 진행해주세요.
            </p>

            <p className="text-[12px] font-medium text-brand text-center leading-[18px] mb-7">
              최근 진단 일시: {rediagDate}
            </p>

            <button
              type="button"
              onClick={() => setShowRediagModal(false)}
              className="w-[125px] h-[40px] rounded-[5px] border border-brand text-brand text-[15px] font-medium hover:bg-brand/5 transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------- */
/* Info Card                          */
/* ---------------------------------- */
function serviceDurationLabel(startDate: string | null): string | null {
  if (!startDate) return null
  const [y, m, d] = startDate.split('.').map(Number)
  if (!y || !m) return null
  const start = new Date(y, m - 1, d || 1)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
  if (months < 1) return '1개월 미만'
  return `${months}개월 째`
}

function TableRow({ label, children, last = false }: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div className={`flex min-h-[52px] items-stretch ${!last ? 'border-b border-[#DEDEDE]' : ''}`}>
      <div className="w-[140px] shrink-0 flex items-center px-4 border-r border-[#DEDEDE] bg-[#EAEAEA] text-[15px] font-medium text-[#343A40]">
        {label}
      </div>
      <div className="flex-1 px-5 flex items-center text-[15px]">
        {children}
      </div>
    </div>
  )
}

function InfoCard({
  child,
  childId,
  onUpdate
}: {
  child: ChildDetailDto['child']
  childId: number
  onUpdate: () => void
}) {
  const { user } = useAuth()
  const isDoctor = user?.role === 'doctor'

  const [diagInputMode, setDiagInputMode] = useState(false)
  const [diagValue, setDiagValue] = useState('')
  const [diagSaving, setDiagSaving] = useState(false)
  const [showTherapistModal, setShowTherapistModal] = useState(false)

  const saveDiagnosis = async () => {
    if (!diagValue.trim()) return
    setDiagSaving(true)
    try {
      await api.updatePrimaryDiagnosis(childId, diagValue.trim())
      setDiagInputMode(false)
      setDiagValue('')
      onUpdate()
    } catch {
      alert('저장에 실패했습니다.')
    } finally {
      setDiagSaving(false)
    }
  }

  const durationLabel = serviceDurationLabel(child.service_started_at)

  return (
    <>
      <div className="rounded-md border border-[#DEDEDE] bg-white overflow-hidden">

        {/* Row 1: 아동명 */}
        <TableRow label="아동명">
          <span className="text-[#585858] font-medium">{child.name}</span>
          <span className="text-[#484848] ml-8">{child.identifier}</span>
        </TableRow>

        {/* Row 2: 생년원일 */}
        <TableRow label="생년원일">
          <span className="text-[#585858]">{child.birth_date ?? '-'}</span>
          {child.age_label && (
            <span className="text-[#585858] ml-8">{child.age_label}</span>
          )}
        </TableRow>

        {/* Row 3: 주진단 */}
        <TableRow label="주진단">
          {diagInputMode ? (
            <div className="flex items-center gap-2 w-full">
              <input
                type="text"
                value={diagValue}
                onChange={(e) => setDiagValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveDiagnosis() }}
                placeholder="주진단 입력"
                autoFocus
                className="flex-1 h-8 px-2 border border-[#CCCCCC] rounded-[4px] text-[14px] focus:outline-none focus:border-[#005744]"
              />
              <button
                onClick={saveDiagnosis}
                disabled={diagSaving || !diagValue.trim()}
                className="h-8 px-3 rounded-[4px] bg-[#005744] text-white text-[13px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {diagSaving ? '저장 중…' : '저장'}
              </button>
              <button
                onClick={() => { setDiagInputMode(false); setDiagValue('') }}
                className="h-8 px-3 rounded-[4px] border border-[#CCCCCC] text-[#585858] text-[13px]"
              >
                취소
              </button>
            </div>
          ) : child.primary_diagnosis ? (
            <div className="flex items-center gap-4">
              <span className="text-[#585858]">{child.primary_diagnosis}</span>
              {isDoctor && (
                <button
                  onClick={() => { setDiagValue(child.primary_diagnosis!); setDiagInputMode(true) }}
                  className="h-8 px-4 rounded-[4px] border border-[#005744] text-[#005744] text-[13px] font-medium hover:bg-[#005744] hover:text-white transition-colors"
                >
                  수정하기
                </button>
              )}
            </div>
          ) : isDoctor ? (
            <button
              onClick={() => setDiagInputMode(true)}
              className="h-8 px-4 rounded-[4px] border border-[#005744] text-[#005744] text-[13px] font-medium hover:bg-[#005744] hover:text-white transition-colors"
            >
              입력하기
            </button>
          ) : (
            <span className="text-[#B0B0B0]">-</span>
          )}
        </TableRow>

        {/* Row 4: 담당 의사 */}
        <TableRow label="담당 의사">
          {child.doctor_name ? (
            <div className="flex items-center gap-8 flex-wrap">
              <span className="text-[#585858]">{child.doctor_name}</span>
              <span className="text-[#484848]">{child.doctor_id ?? '-'}</span>
              <span className="text-[#484848]">{child.doctor_department ?? '-'}</span>
              {child.next_doctor_appointment && (
                <span className="text-[#484848]">예약&nbsp;&nbsp;&nbsp;{child.next_doctor_appointment}</span>
              )}
            </div>
          ) : (
            <span className="text-[#585858]">미배정</span>
          )}
        </TableRow>

        {/* Row 5: 담당 치료사 */}
        <TableRow label="담당 치료사">
          {child.therapist_name ? (
            <div className="flex items-center gap-8 flex-wrap">
              <span className="text-[#585858]">{child.therapist_name}</span>
              <span className="text-[#484848]">{child.therapist_id ?? '-'}</span>
              <span className="text-[#484848]">{child.therapist_department ?? '-'}</span>
              {child.therapist_schedule && (
                <span className="text-[#484848]">{child.therapist_schedule}</span>
              )}
            </div>
          ) : isDoctor ? (
            <button
              onClick={() => setShowTherapistModal(true)}
              className="h-8 px-4 rounded-[4px] border border-[#005744] text-[#005744] text-[13px] font-medium hover:bg-[#005744] hover:text-white transition-colors"
            >
              배정하기
            </button>
          ) : (
            <span className="text-[#585858]">미배정</span>
          )}
        </TableRow>

        {/* Row 6: 하이동동 시작일 */}
        <TableRow label="하이동동 시작일" last>
          <span className="text-[#585858]">{child.service_started_at ?? '-'}</span>
          {durationLabel && (
            <span className="text-[#585858] ml-8">{durationLabel}</span>
          )}
        </TableRow>

      </div>

      {showTherapistModal && (
        <AssignTherapistModal
          childId={childId}
          childName={child.name}
          onAssigned={() => { setShowTherapistModal(false); onUpdate() }}
          onClose={() => setShowTherapistModal(false)}
        />
      )}
    </>
  )
}

/* ---------------------------------- */
/* Assign Therapist Modal             */
/* ---------------------------------- */
function AssignTherapistModal({
  childId,
  childName,
  onAssigned,
  onClose
}: {
  childId: number
  childName: string
  onAssigned: () => void
  onClose: () => void
}) {
  const [therapists, setTherapists] = useState<StaffItem[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState(false)
  const [pending, setPending] = useState<StaffItem | null>(null)

  useEffect(() => {
    api.staff(['therapist'])
      .then(setTherapists)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleConfirm = async () => {
    if (!pending) return
    setAssigning(true)
    try {
      await api.assignTherapist(childId, pending.code)
      onAssigned()
    } catch {
      alert('배정에 실패했습니다.')
      setPending(null)
    } finally {
      setAssigning(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
        <div
          className="bg-white rounded-[8px] w-[400px] max-h-[480px] flex flex-col shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h3 className="text-[16px] font-semibold text-ink-850">담당 치료사 배정</h3>
            <button onClick={onClose} className="text-ink-400 hover:text-ink-700">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 2l14 14M16 2 2 16" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-10 rounded animate-pulse bg-surface-active" />
                ))}
              </div>
            ) : therapists.length === 0 ? (
              <p className="text-center text-ink-400 py-8">배정 가능한 치료사가 없습니다.</p>
            ) : (
              <ul className="space-y-1">
                {therapists.map((t) => (
                  <li key={t.code}>
                    <button
                      onClick={() => setPending(t)}
                      className="w-full h-10 px-4 rounded-[5px] text-left text-[14px] text-ink-700 hover:bg-surface-active transition-colors"
                    >
                      {t.name} <span className="text-ink-400 text-[12px]">({t.code})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {pending && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-[8px] w-[520px] px-10 py-10 relative shadow-xl">
            <button
              onClick={() => setPending(null)}
              className="absolute top-5 right-5 text-[#9E9E9E] hover:text-[#333] transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 2l12 12M14 2 2 14" />
              </svg>
            </button>
            <h2 className="text-[22px] font-bold text-center text-[#222] mb-7">담당치료사 변경</h2>
            <p className="text-[15px] text-center text-[#333] mb-10">
              <span className="font-bold">{childName}</span> 아동의 담당 치료사를{' '}
              <span className="font-bold">{pending.name}</span>으로 변경하시겠습니까?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleConfirm}
                disabled={assigning}
                className="w-[160px] h-[52px] bg-[#005744] text-white text-[16px] font-medium rounded-[5px] hover:bg-[#005744]/90 disabled:opacity-50 transition-colors"
              >
                변경하기
              </button>
              <button
                onClick={() => setPending(null)}
                className="w-[120px] h-[52px] border border-[#005744] text-[#005744] text-[16px] font-medium rounded-[5px] hover:bg-[#005744]/5 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ---------------------------------- */
/* Memo Card — RBAC + 저장 API         */
/* ---------------------------------- */
function MemoCard({
  childId,
  role,
  initial,
  lastEdited
}: {
  childId: number
  role: Role
  initial: string
  lastEdited: string
}) {
  const [value, setValue] = useState(initial)
  const [savedAt, setSavedAt] = useState(lastEdited)
  const [saving, setSaving] = useState(false)
  const { user } = useAuth()
  const canEdit = user?.role === role
  const title = `${roleLabel(role)} 메모`

  useEffect(() => {
    setValue(initial)
    setSavedAt(lastEdited)
  }, [initial, lastEdited])

  const handleSave = async () => {
    if (!canEdit || saving) return
    setSaving(true)
    try {
      const res = await api.saveMemo(childId, role, value)
      setSavedAt(res.updated_at)
    } catch (e) {
      alert('저장에 실패했습니다. (워커가 실행 중인지 확인해주세요)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-surface-card border border-line rounded-[5px] p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-[18px] font-semibold text-ink-850">{title}</h3>
          {!canEdit && (
            <span className="text-[11px] text-ink-400 px-2 py-0.5 rounded-full bg-surface-active">읽기 전용</span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canEdit || saving}
          className="h-10 px-5 rounded-[5px] bg-brand text-white text-[15px] font-medium hover:opacity-90 transition disabled:bg-ink-300 disabled:cursor-not-allowed"
        >
          {saving ? '저장 중…' : '저장'}
        </button>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        readOnly={!canEdit}
        placeholder={canEdit ? '메모를 입력하세요' : '아직 작성된 메모가 없습니다.'}
        className="w-full h-[100px] resize-none border border-line rounded-[5px] p-3 text-[14px] text-ink-700 focus:outline-none focus:border-brand read-only:bg-surface-active read-only:cursor-not-allowed"
      />
      <div className="mt-3 text-[12px] text-ink-200">최종 정보 수정일시 : {savedAt}</div>
    </div>
  )
}

/* ---------------------------------- */
/* 날짜 필터 유틸                        */
/* ---------------------------------- */
function parseDateStr(s: string): Date {
  const [y, m, d] = s.split(' ')[0].split('.').map(Number)
  return new Date(y, m - 1, d)
}

function rangeCutoff(range: 'today' | '1w' | '1m' | '3m' | '12m'): Date {
  const days = range === 'today' ? 0 : range === '1w' ? 7 : range === '1m' ? 30 : range === '3m' ? 90 : 365
  const cutoff = new Date()
  cutoff.setHours(0, 0, 0, 0)
  if (range !== 'today') cutoff.setDate(cutoff.getDate() - days)
  return cutoff
}

function applyDateFilter<T>(
  items: T[],
  getDate: (item: T) => string | null,
  range: 'today' | '1w' | '1m' | '3m' | '12m' | null,
  fromDate: string,
  toDate: string,
  customActive: boolean
): T[] {
  if (customActive && (fromDate || toDate)) {
    return items.filter(item => {
      const ds = getDate(item)
      if (!ds) return false
      const d = parseDateStr(ds)
      if (fromDate) { const f = new Date(fromDate); f.setHours(0, 0, 0, 0); if (d < f) return false }
      if (toDate)   { const t = new Date(toDate);   t.setHours(23, 59, 59, 999); if (d > t) return false }
      return true
    })
  }
  if (range === null) return items
  const cutoff = rangeCutoff(range)
  return items.filter(item => {
    const ds = getDate(item)
    return ds ? parseDateStr(ds) >= cutoff : false
  })
}

/* ---------------------------------- */
/* 목록 내보내기 유틸                   */
/* ---------------------------------- */
async function downloadAsExcel(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const XLSX = await import('xlsx')
  const data = [headers, ...rows.map(r => r.map(c => c ?? '-'))]
  const sheet = XLSX.utils.aoa_to_sheet(data)
  sheet['!cols'] = headers.map(() => ({ wch: 18 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheet, '목록')
  XLSX.writeFile(wb, filename.replace(/[\\/:*?"<>|]/g, '_'))
}

async function downloadAsPdf(title: string, filename: string, headers: string[], rows: (string | number | null)[][]) {
  const wrap = document.createElement('div')
  wrap.style.cssText = 'padding:20px;font-family:sans-serif;background:#fff'
  const h = document.createElement('h2')
  h.textContent = title
  h.style.cssText = 'font-size:16px;margin-bottom:12px;color:#343A40'
  wrap.appendChild(h)
  const table = document.createElement('table')
  table.style.cssText = 'border-collapse:collapse;width:100%;font-size:12px'
  const thead = document.createElement('thead')
  const hrow = document.createElement('tr')
  for (const hd of headers) {
    const th = document.createElement('th')
    th.textContent = hd
    th.style.cssText = 'border:1px solid #ddd;padding:6px 10px;background:#f5f5f5;text-align:center'
    hrow.appendChild(th)
  }
  thead.appendChild(hrow)
  table.appendChild(thead)
  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    for (const cell of row) {
      const td = document.createElement('td')
      td.textContent = String(cell ?? '-')
      td.style.cssText = 'border:1px solid #ddd;padding:6px 10px;text-align:center'
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  wrap.appendChild(table)
  document.body.appendChild(wrap)
  try {
    const { exportElementToPdf } = await import('../lib/exporters')
    await exportElementToPdf(wrap, filename.replace(/[\\/:*?"<>|]/g, '_'))
  } finally {
    document.body.removeChild(wrap)
  }
}

/* ---------------------------------- */
/* 진단 이력                           */
/* ---------------------------------- */
function DiagnosisSection({ childId, identifier, diagnoses }: { childId: number; identifier: string; diagnoses: DiagnosisListItem[] }) {
  const { go } = useRouter()
  const [range, setRange] = useState<'today' | '1w' | '1m' | '3m' | '12m' | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [customActive, setCustomActive] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const latest = diagnoses[0]

  const filteredDiagnoses = applyDateFilter(diagnoses, d => d.examined_at, range, fromDate, toDate, customActive)
  const isFiltered = range !== null || customActive
  const totalPages = Math.ceil(filteredDiagnoses.length / 10) || 1
  const pagedDiagnoses = filteredDiagnoses.slice((page - 1) * 10, page * 10)

  const allPageSelected = pagedDiagnoses.length > 0 && pagedDiagnoses.every(r => selectedIds.has(r.id))
  const toggleAll = () => setSelectedIds(prev => {
    const next = new Set(prev)
    allPageSelected ? pagedDiagnoses.forEach(r => next.delete(r.id)) : pagedDiagnoses.forEach(r => next.add(r.id))
    return next
  })
  const toggleRow = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const selectedRows = filteredDiagnoses.filter(r => selectedIds.has(r.id))
  const hasSelection = selectedRows.length > 0

  const DIAG_HEADERS = ['진단일시', '사용시간', '정확도', '진단 결과 요약']
  const toRows = (items: DiagnosisListItem[]) =>
    items.map(r => [r.examined_at, r.duration_label ?? '-', r.accuracy_pct != null ? `${r.accuracy_pct}%` : '-', r.summary ?? '-'])

  const handleExcel = () => downloadAsExcel(`진단목록_${identifier}.xlsx`, DIAG_HEADERS, toRows(selectedRows))
  const handlePdf   = () => downloadAsPdf(`진단 이력 (${identifier})`, `진단목록_${identifier}.pdf`, DIAG_HEADERS, toRows(selectedRows))

  const handleRangeChange = (r: 'today' | '1w' | '1m' | '3m' | '12m') => { setRange(r); setCustomActive(false); setPage(1) }
  const handleReset = () => { setRange(null); setCustomActive(false); setFromDate(''); setToDate(''); setPage(1) }

  return (
    <section>
      <h2 className="text-[18px] font-semibold text-ink-900 mb-5">진단 이력</h2>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5 mb-6">
        <div className="bg-surface-card border border-line rounded-[5px] p-5">
          <div className="text-[18px] font-medium text-ink-850 mb-1">최근진단일</div>
          <div className="text-[14px] text-ink-500">
            {latest
              ? `검사일 ${latest.examined_at} · 소요시간 ${latest.duration_label ?? '-'}`
              : '진단 기록이 없습니다.'}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <MetricBlock label="자음정확도" sub="아동 개인 수치" value={latest?.consonant_pct != null ? `${latest.consonant_pct}%` : '--'} />
          <MetricBlock label="단어 내 위치별 자음 정확도" sub="아동 개인 수치" value={latest?.word_pos_pct != null ? `${latest.word_pos_pct}%` : '--'} />
          <MetricBlock label="모음정확도" sub="아동 개인 수치" value={latest?.vowel_pct != null ? `${latest.vowel_pct}%` : '--'} />
        </div>
      </div>

      <DateRangeFilter
        range={range} onChange={handleRangeChange} onReset={handleReset}
        fromDate={fromDate} toDate={toDate}
        onFromChange={setFromDate} onToChange={setToDate}
        onSearch={() => setCustomActive(true)}
      />

      <div className="flex items-center justify-between my-4">
        <span className="text-[12px] text-ink-500">
          {isFiltered
            ? `${filteredDiagnoses.length}개 표시 중 (전체 ${diagnoses.length}개)`
            : `전체 ${diagnoses.length}개`}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-ink-900">[데이터 다운로드]</span>
          <OutlineButton onClick={handleExcel} disabled={!hasSelection}>엑셀 다운</OutlineButton>
          <OutlineButton onClick={handlePdf} disabled={!hasSelection}>PDF 다운</OutlineButton>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-line bg-surface-card">
        <table className="w-full min-w-[800px] text-[15px]">
          <thead>
            <tr className="border-b border-line bg-line-soft">
              <Th className="w-10">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded-[3px] border border-ink-850 accent-brand"
                  checked={allPageSelected}
                  onChange={toggleAll}
                />
              </Th>
              <Th>진단일시</Th>
              <Th>사용시간</Th>
              <Th>정확도</Th>
              <Th>진단 결과 요약</Th>
              <Th className="w-32">상세보기</Th>
            </tr>
          </thead>
          <tbody>
            {pagedDiagnoses.length === 0 && (
              <tr>
                <td colSpan={6} className="h-[80px] text-center text-ink-400">
                  {isFiltered ? '해당 기간에 진단 기록이 없습니다.' : '진단 기록이 없습니다.'}
                </td>
              </tr>
            )}
            {pagedDiagnoses.map((row) => (
              <tr
                key={row.id}
                onClick={() => go({ name: 'diagnosis', childId, diagnosisId: row.id })}
                className="cursor-pointer hover:bg-surface-active transition-colors"
              >
                <Td onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    className="w-5 h-5 rounded-[3px] border border-ink-850 accent-brand"
                    checked={selectedIds.has(row.id)}
                    onChange={() => toggleRow(row.id)}
                  />
                </Td>
                <Td className="text-ink-850">{row.examined_at}</Td>
                <Td className="text-ink-850">{row.duration_label ?? '-'}</Td>
                <Td className="text-ink-850">{row.accuracy_pct != null ? `${row.accuracy_pct}%` : '-'}</Td>
                <Td className="text-ink-850">{row.summary ?? '-'}</Td>
                <Td>
                  <button className="inline-flex items-center gap-1 text-ink-850 hover:text-brand">
                    상세보기
                    <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="m1 1 4 4-4 4" strokeLinecap="round" />
                    </svg>
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SmallPagination current={page} total={totalPages} onChange={setPage} />
    </section>
  )
}

/* ---------------------------------- */
/* 치료 이력                           */
/* ---------------------------------- */


/* ---------------------------------- */
/* 치료 이력 차트 컴포넌트              */
/* ---------------------------------- */
type CDSeriesKey = 'accuracy' | 'tries' | 'minutes'
type CDWeeklyPoint = { day: string; accuracy: number; tries: number; minutes: number }
type CDCalEntry = { acc: number[]; tries: number; minutes: number }

const CD_SERIES: { key: CDSeriesKey; label: string; color: string }[] = [
  { key: 'accuracy', label: '정확도(%)',       color: '#FF6767' },
  { key: 'tries',    label: '발음 횟수 (회)', color: '#FF9873' },
  { key: 'minutes',  label: '훈련시간 (분)',  color: '#5EBC93' },
]

function CDSeriesToggle({
  label, color, checked, onChange
}: { label: string; color: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <button
        type="button"
        onClick={onChange}
        className={`w-5 h-5 rounded-[3px] grid place-items-center transition-colors ${
          checked ? 'bg-brand' : 'bg-white border border-[#B2B2B2]'
        }`}
        role="checkbox"
        aria-checked={checked}
      >
        {checked && (
          <svg width="12" height="10" viewBox="0 0 12 10" fill="none" stroke="white" strokeWidth="2">
            <path d="M1 5l3.5 3.5L11 1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[14px] text-ink-900">{label}</span>
    </label>
  )
}

function CDMonthCalendar({
  year, month, data, visible
}: {
  year: number
  month: number
  data: Map<number, CDCalEntry>
  visible: Record<CDSeriesKey, boolean>
}) {
  const DAYS = ['월', '화', '수', '목', '금', '토', '일']
  const daysInMonth = new Date(year, month, 0).getDate()
  const rawDow = new Date(year, month - 1, 1).getDay()
  const offset = rawDow === 0 ? 6 : rawDow - 1

  const CALSERIES = [
    { key: 'accuracy' as CDSeriesKey, color: '#FF4646', fmt: (e: CDCalEntry) => e.acc.length ? `${Math.round(e.acc.reduce((a, v) => a + v) / e.acc.length)}%` : null },
    { key: 'tries'    as CDSeriesKey, color: '#FF9873', fmt: (e: CDCalEntry) => e.tries   > 0 ? `${e.tries}회`   : null },
    { key: 'minutes'  as CDSeriesKey, color: '#5EBC93', fmt: (e: CDCalEntry) => e.minutes > 0 ? `${e.minutes}분` : null },
  ]

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1)
  ]

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-[#E8E8E8] mb-0">
        {DAYS.map(d => (
          <div key={d} className="text-[15px] font-semibold text-center text-ink-900 py-3">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 border-l border-t border-[#E8E8E8]">
        {cells.map((day, idx) => {
          const entry = day !== null ? data.get(day) ?? null : null
          return (
            <div key={idx} className="border-r border-b border-[#E8E8E8] min-h-[76px] p-2">
              {day !== null && (
                <>
                  <div className="text-[10px] text-[#C0C0C0] leading-none mb-1.5">{day}</div>
                  {CALSERIES.map(({ key, color, fmt }) => {
                    if (!visible[key]) return null
                    const label = entry ? fmt(entry) : null
                    let activeColor = color
                    if (key === 'accuracy' && entry && entry.acc.length > 0) {
                      const avg = entry.acc.reduce((a, v) => a + v) / entry.acc.length
                      if (avg < 70) activeColor = '#B2B2B2'
                    }
                    return (
                      <div key={key} className="flex items-center gap-1.5 mb-[3px]">
                        <span className="w-[7px] h-[7px] rounded-full flex-shrink-0"
                          style={{ backgroundColor: label ? activeColor : '#D0D0D0' }} />
                        {label
                          ? <span className="text-[11px] font-semibold leading-none" style={{ color: activeColor }}>{label}</span>
                          : <span className="text-[11px] text-[#C8C8C8] leading-none">-</span>
                        }
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CDWeeklyBarChart({
  data,
  visible,
  showSeriesLabels = false
}: {
  data: CDWeeklyPoint[]
  visible: Record<CDSeriesKey, boolean>
  showSeriesLabels?: boolean
}) {
  const allValues = data.flatMap(d => [d.accuracy, d.tries, d.minutes])
  const max = Math.max(...allValues, 100)
  const colMinW = data.length <= 7 ? undefined : Math.max(48, Math.floor(660 / data.length))

  return (
    <div className="relative">
      <div className="absolute top-0 left-0 right-0 flex items-center pointer-events-none">
        <div className="flex-1 border-t border-dashed border-line-dash" />
        <span className="text-[12px] text-[#B2B2B2] ml-2">목표</span>
      </div>

      <div className="overflow-x-auto">
        <div
          className="h-[280px] pt-6"
          style={
            colMinW
              ? { display: 'grid', gridTemplateColumns: `repeat(${data.length}, ${colMinW}px)`, gap: '0.5rem' }
              : { display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, data.length)}, 1fr)`, gap: '1rem' }
          }
        >
          {data.map((d, idx) => (
            <div key={idx} className="flex flex-col items-center">
              <div className="flex-1 flex items-end justify-center gap-1 w-full">
                {(['accuracy', 'tries', 'minutes'] as CDSeriesKey[]).map(key => {
                  if (!visible[key]) return null
                  const value = d[key]
                  const heightPct = max > 0 ? (value / max) * 100 : 0
                  const color =
                    key === 'accuracy' ? '#FF6767' : key === 'tries' ? '#FF9873' : '#5EBC93'
                  return (
                    <div
                      key={key}
                      className="flex flex-col items-center justify-end h-full"
                      style={{ width: 24 }}
                    >
                      <div className="text-[12px] text-ink-700 mb-1 leading-none">{value || ''}</div>
                      <div
                        className="w-full rounded-sm"
                        style={{
                          backgroundColor: value > 0 ? color : '#EAEAEA',
                          height: `${Math.max(2, heightPct)}%`,
                          minHeight: 4
                        }}
                      />
                    </div>
                  )
                })}
              </div>
              {showSeriesLabels && (
                <div className="flex justify-center gap-1 mt-1">
                  {(['accuracy', 'tries', 'minutes'] as CDSeriesKey[]).map(key =>
                    visible[key] ? (
                      <div key={key} className="text-[11px] text-ink-400 leading-none" style={{ width: 24, textAlign: 'center' }}>
                        {key === 'accuracy' ? 'P' : key === 'tries' ? 'F' : 'T'}
                      </div>
                    ) : null
                  )}
                </div>
              )}
              <div className="text-[13px] font-semibold text-ink-900 mt-1">{d.day}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function TreatmentSection({ childId, identifier, treatments }: { childId: number; identifier: string; treatments: TreatmentListItem[] }) {
  const { go } = useRouter()
  const [period, setPeriod] = useState<'week' | 'month' | '3month'>('week')
  const [range, setRange] = useState<'today' | '1w' | '1m' | '3m' | '12m' | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [customActive, setCustomActive] = useState(false)

  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  const filteredTreatments = applyDateFilter(treatments, t => t.treated_at, range, fromDate, toDate, customActive)
  const isFiltered = range !== null || customActive
  const totalPages = Math.ceil(filteredTreatments.length / 10) || 1
  const pagedTreatments = filteredTreatments.slice((page - 1) * 10, page * 10)

  const allPageSelected = pagedTreatments.length > 0 && pagedTreatments.every(r => selectedIds.has(r.id))
  const toggleAll = () => setSelectedIds(prev => {
    const next = new Set(prev)
    allPageSelected ? pagedTreatments.forEach(r => next.delete(r.id)) : pagedTreatments.forEach(r => next.add(r.id))
    return next
  })
  const toggleRow = (id: number) => setSelectedIds(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const selectedRows = filteredTreatments.filter(r => selectedIds.has(r.id))
  const hasSelection = selectedRows.length > 0

  const TREAT_HEADERS = ['치료일시', '회기', '훈련조음', '치료 분야', '발음 시도 횟수', '평균정확도']
  const toRows = (items: TreatmentListItem[]) =>
    items.map(r => [
      r.treated_at,
      r.session_no != null ? `${r.session_no}회기` : '-',
      r.trained_sound ?? '-',
      parseTags(r.tags_json).join(', ') || '-',
      r.try_count != null ? `${r.try_count}회` : '-',
      r.avg_accuracy_pct != null ? `${r.avg_accuracy_pct}%` : '-',
    ])

  const handleExcel = () => downloadAsExcel(`치료목록_${identifier}.xlsx`, TREAT_HEADERS, toRows(selectedRows))
  const handlePdf   = () => downloadAsPdf(`치료 이력 (${identifier})`, `치료목록_${identifier}.pdf`, TREAT_HEADERS, toRows(selectedRows))

  const handleRangeChange = (r: 'today' | '1w' | '1m' | '3m' | '12m') => { setRange(r); setCustomActive(false); setPage(1) }
  const handleReset = () => { setRange(null); setCustomActive(false); setFromDate(''); setToDate(''); setPage(1) }

  const [visible, setVisible] = useState<Record<CDSeriesKey, boolean>>({
    accuracy: true, tries: true, minutes: true
  })

  const { calYear, calMonth } = useMemo(() => {
    if (treatments.length === 0) {
      const n = new Date()
      return { calYear: n.getFullYear(), calMonth: n.getMonth() + 1 }
    }
    const sorted = [...treatments].sort((a, b) => (b.treated_at ?? '').localeCompare(a.treated_at ?? ''))
    const p = sorted[0].treated_at?.split(' ')[0].split('.').map(Number) ?? []
    if (p.length >= 3) return { calYear: p[0], calMonth: p[1] }
    const n = new Date()
    return { calYear: n.getFullYear(), calMonth: n.getMonth() + 1 }
  }, [treatments])

  const calendarMap = useMemo(() => {
    if (period !== 'month') return new Map<number, CDCalEntry>()
    const map = new Map<number, CDCalEntry>()
    for (const t of treatments) {
      if (!t.treated_at) continue
      const p = t.treated_at.split(' ')[0].split('.').map(Number)
      if (p.length < 3 || p[0] !== calYear || p[1] !== calMonth) continue
      if (!map.has(p[2])) map.set(p[2], { acc: [], tries: 0, minutes: 0 })
      const b = map.get(p[2])!
      if (t.avg_accuracy_pct != null) b.acc.push(t.avg_accuracy_pct)
      b.tries += t.try_count ?? 0
      b.minutes += t.duration_minutes ?? 0
    }
    return map
  }, [period, treatments, calYear, calMonth])

  const weeklyData = useMemo((): CDWeeklyPoint[] => {
    const now = new Date()
    const dow = now.getDay()
    const mondayOffset = dow === 0 ? -6 : 1 - dow
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset)
    monday.setHours(0, 0, 0, 0)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    sunday.setHours(23, 59, 59, 999)
    const DAYS = ['월', '화', '수', '목', '금', '토', '일']
    const buckets = DAYS.map(() => ({ acc: [] as number[], tries: 0, minutes: 0 }))
    for (const t of treatments) {
      if (!t.treated_at) continue
      const p = t.treated_at.split(' ')[0].split('.').map(Number)
      if (p.length < 3) continue
      const date = new Date(p[0], p[1] - 1, p[2])
      if (date < monday || date > sunday) continue
      const d = date.getDay()
      const idx = d === 0 ? 6 : d - 1
      if (t.avg_accuracy_pct != null) buckets[idx].acc.push(t.avg_accuracy_pct)
      buckets[idx].tries += t.try_count ?? 0
      buckets[idx].minutes += t.duration_minutes ?? 0
    }
    return DAYS.map((day, idx) => ({
      day,
      accuracy: buckets[idx].acc.length ? Math.round(buckets[idx].acc.reduce((a, v) => a + v) / buckets[idx].acc.length) : 0,
      tries: buckets[idx].tries,
      minutes: buckets[idx].minutes
    }))
  }, [treatments])

  const monthlyData = useMemo((): CDWeeklyPoint[] => {
    if (period !== '3month') return []
    const now = new Date()
    const slots: { ym: string; label: string }[] = []
    for (let i = 2; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1)
      slots.push({ ym: `${m.getFullYear()}-${m.getMonth() + 1}`, label: `${m.getMonth() + 1}월` })
    }
    const mbuckets = new Map<string, { label: string; acc: number[]; tries: number; minutes: number }>()
    for (const { ym, label } of slots) mbuckets.set(ym, { label, acc: [], tries: 0, minutes: 0 })
    for (const t of treatments) {
      if (!t.treated_at) continue
      const p = t.treated_at.split(' ')[0].split('.').map(Number)
      if (p.length < 3) continue
      const ym = `${p[0]}-${p[1]}`
      if (!mbuckets.has(ym)) continue
      const b = mbuckets.get(ym)!
      if (t.avg_accuracy_pct != null) b.acc.push(t.avg_accuracy_pct)
      b.tries += t.try_count ?? 0
      b.minutes += t.duration_minutes ?? 0
    }
    return [...mbuckets.values()].map(b => ({
      day: b.label,
      accuracy: b.acc.length ? Math.round(b.acc.reduce((a, v) => a + v) / b.acc.length) : 0,
      tries: b.tries,
      minutes: b.minutes
    }))
  }, [period, treatments])

  return (
    <section>
      <h2 className="text-[18px] font-semibold text-ink-900 mb-4">치료 이력</h2>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="inline-flex bg-line-soft p-1 rounded-[8px]">
          {(['week', 'month', '3month'] as const).map((p) => {
            const label = p === 'week' ? '주간' : p === 'month' ? '월간' : '3개월'
            const active = period === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`h-[34px] px-6 rounded-[5px] text-[15px] font-medium transition-colors ${
                  active ? 'bg-white border border-brand text-ink-900' : 'text-ink-700 hover:text-ink-900'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-5">
          {CD_SERIES.map(({ key, label, color }) => (
            <CDSeriesToggle
              key={key}
              label={label}
              color={color}
              checked={visible[key]}
              onChange={() => setVisible(v => ({ ...v, [key]: !v[key] }))}
            />
          ))}
        </div>
      </div>

      <div className="mb-6">
        {period === 'week' && <CDWeeklyBarChart data={weeklyData} visible={visible} />}
        {period === 'month' && <CDMonthCalendar year={calYear} month={calMonth} data={calendarMap} visible={visible} />}
        {period === '3month' && <CDWeeklyBarChart data={monthlyData} visible={visible} showSeriesLabels />}
      </div>

      <DateRangeFilter
        range={range} onChange={handleRangeChange} onReset={handleReset}
        fromDate={fromDate} toDate={toDate}
        onFromChange={setFromDate} onToChange={setToDate}
        onSearch={() => setCustomActive(true)}
      />

      <div className="flex items-center justify-between my-4">
        <span className="text-[12px] text-ink-500">
          {isFiltered
            ? `${filteredTreatments.length}개 표시 중 (전체 ${treatments.length}개)`
            : `전체 ${treatments.length}개`}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-ink-900">[데이터 다운로드]</span>
          <OutlineButton onClick={handleExcel} disabled={!hasSelection}>엑셀 다운</OutlineButton>
          <OutlineButton onClick={handlePdf} disabled={!hasSelection}>PDF 다운</OutlineButton>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-line bg-surface-card">
        <table className="w-full min-w-[900px] text-[15px]">
          <thead>
            <tr className="border-b border-line bg-line-soft">
              <Th className="w-10">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded-[3px] border border-ink-850 accent-brand"
                  checked={allPageSelected}
                  onChange={toggleAll}
                />
              </Th>
              <Th>치료일시</Th>
              <Th>회기</Th>
              <Th>훈련조음</Th>
              <Th>치료 분야</Th>
              <Th>발음 시도 횟수</Th>
              <Th>평균정확도</Th>
              <Th className="w-32">상세보기</Th>
            </tr>
          </thead>
          <tbody>
            {filteredTreatments.length === 0 && (
              <tr>
                <td colSpan={8} className="h-[80px] text-center text-ink-400">
                  {isFiltered ? '해당 기간에 치료 기록이 없습니다.' : '치료 기록이 없습니다.'}
                </td>
              </tr>
            )}
            {pagedTreatments.map((row) => {
              const tags = parseTags(row.tags_json)
              return (
                <tr
                  key={row.id}
                  onClick={() => go({ name: 'treatment', childId, treatmentId: row.id })}
                  className="cursor-pointer hover:bg-surface-active transition-colors"
                >
                  <Td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="w-5 h-5 rounded-[3px] border border-ink-850 accent-brand"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleRow(row.id)}
                    />
                  </Td>
                  <Td className="text-ink-850">{row.treated_at}</Td>
                  <Td className="text-ink-850">{row.session_no ?? '-'}회기</Td>
                  <Td className="text-ink-850">{row.trained_sound ?? '-'}</Td>
                  <Td>
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {tags.map((t) => (
                        <Tag key={t} label={t} />
                      ))}
                    </div>
                  </Td>
                  <Td className="text-ink-850">{row.try_count ?? 0}회</Td>
                  <Td className="text-ink-850">{row.avg_accuracy_pct != null ? `${row.avg_accuracy_pct}%` : '-'}</Td>
                  <Td>
                    <button className="inline-flex items-center gap-1 text-ink-850 hover:text-brand">
                      상세보기
                      <svg width="6" height="10" viewBox="0 0 6 10" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="m1 1 4 4-4 4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <SmallPagination current={page} total={totalPages} onChange={setPage} />
    </section>
  )
}

function parseTags(json: string | null): string[] {
  if (!json) return []
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/* ---------------------------------- */
/* Shared building blocks             */
/* ---------------------------------- */
function Th({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`h-[45px] px-3 text-center font-medium text-[15px] text-ink-850 ${className}`}>
      {children}
    </th>
  )
}

function Td({
  children,
  className = '',
  onClick
}: {
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent<HTMLTableCellElement>) => void
}) {
  return (
    <td onClick={onClick} className={`h-[45px] px-3 text-center border-t border-line ${className}`}>
      {children}
    </td>
  )
}

function MetricBlock({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className="bg-surface-card border border-line rounded-[5px] p-4 flex flex-col justify-between min-w-[140px]">
      <div>
        <div className="text-[14px] font-medium text-ink-850 leading-snug">{label}</div>
        <div className="text-[12px] text-ink-400 mt-1">{sub}</div>
      </div>
      <div className="text-[24px] font-semibold text-brand mt-3">{value}</div>
    </div>
  )
}

function DateRangeFilter({
  range, onChange, onReset,
  fromDate, toDate, onFromChange, onToChange, onSearch
}: {
  range: 'today' | '1w' | '1m' | '3m' | '12m' | null
  onChange: (r: 'today' | '1w' | '1m' | '3m' | '12m') => void
  onReset?: () => void
  fromDate: string
  toDate: string
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onSearch: () => void
}) {
  const chips: Array<['today' | '1w' | '1m' | '3m' | '12m', string]> = [
    ['today', '오늘'],
    ['1w', '1주일'],
    ['1m', '1개월'],
    ['3m', '3개월'],
    ['12m', '12개월']
  ]

  return (
    <div className="flex flex-wrap items-center gap-3 bg-surface-card border border-line rounded-[5px] p-4">
      <span className="text-[15px] font-medium text-ink-850">조회기간</span>
      <div className="flex items-center gap-2">
        {onReset && (
          <button
            onClick={onReset}
            className={`h-7 px-3 rounded-[3px] text-[12px] font-medium border transition ${
              range === null
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface-card text-ink-700 hover:border-brand'
            }`}
          >
            전체
          </button>
        )}
        {chips.map(([key, label]) => (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`h-7 px-3 rounded-[3px] text-[12px] font-medium border transition ${
              range === key
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-surface-card text-ink-700 hover:border-brand'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-2">
        <DateInput value={fromDate} onChange={onFromChange} />
        <span className="text-ink-500">~</span>
        <DateInput value={toDate} onChange={onToChange} />
      </div>

      <button
        onClick={onSearch}
        className="h-7 px-4 rounded-[3px] bg-brand text-white text-[12px] font-medium ml-auto hover:opacity-90 transition"
      >
        조회
      </button>
    </div>
  )
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="h-7 w-[130px] px-2 border border-line rounded-[3px] text-[12px] text-ink-700 focus:outline-none focus:border-brand"
    />
  )
}

function OutlineButton({ children, onClick, disabled }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="h-9 px-3 rounded-[5px] border border-brand text-brand text-[14px] font-medium hover:bg-brand hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-brand"
    >
      {children}
    </button>
  )
}


function Tag({ label }: { label: string }) {
  const colors: Record<string, string> = {
    '1음절': 'bg-tag-yellow text-ink-700',
    룰렛: 'bg-tag-green text-ink-700',
    주사위: 'bg-tag-blue text-ink-700',
    문장: 'bg-tag-pink text-ink-700'
  }
  const cls = colors[label] ?? 'bg-tag-yellow text-ink-700'
  return <span className={`inline-block px-2 py-0.5 rounded-[10px] text-[12px] ${cls}`}>{label}</span>
}


function SmallPagination({ current, total, onChange }: {
  current: number
  total: number
  onChange: (page: number) => void
}) {
  const delta = 2
  const left = Math.max(1, current - delta)
  const right = Math.min(total, current + delta)
  const pages: number[] = []
  for (let i = left; i <= right; i++) pages.push(i)

  return (
    <div className="flex items-center justify-center gap-1 mt-6 text-[15px] text-ink-500">
      <button
        disabled={current === 1}
        onClick={() => onChange(current - 1)}
        className="w-7 h-7 grid place-items-center hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 1 1 6l5 5" strokeLinecap="round" /></svg>
      </button>

      {left > 1 && (
        <>
          <button onClick={() => onChange(1)} className="w-7 h-7 rounded-[3px] font-medium hover:bg-surface-active">1</button>
          {left > 2 && <span className="px-1 text-ink-400">…</span>}
        </>
      )}

      {pages.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-7 h-7 rounded-[3px] font-medium transition ${
            n === current ? 'bg-line-dash text-ink-700' : 'text-ink-500 hover:bg-surface-active'
          }`}
        >
          {n}
        </button>
      ))}

      {right < total && (
        <>
          {right < total - 1 && <span className="px-1 text-ink-400">…</span>}
          <button onClick={() => onChange(total)} className="w-7 h-7 rounded-[3px] font-medium hover:bg-surface-active">{total}</button>
        </>
      )}

      <button
        disabled={current === total}
        onClick={() => onChange(current + 1)}
        className="w-7 h-7 grid place-items-center hover:text-brand disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <svg width="7" height="12" viewBox="0 0 7 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="m1 1 5 5-5 5" strokeLinecap="round" /></svg>
      </button>
    </div>
  )
}
