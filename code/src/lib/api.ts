import type { Role } from './auth'

export type CurrentUserDto = {
  id: string
  code: string | null
  name: string
  role: Role
  institutionCode: string
  department: string | null
  schedule: string | null
}

export type AssignedChild = {
  id: number
  identifier: string
  child_name: string | null
  birth_date: string | null
  age_label: string | null
  gender: string | null
  app_login_id: string | null
  doctor_code: string | null
  teacher_code: string | null
  doctor_name: string | null
  therapist_name: string | null
  next_doctor_appointment: string | null
  next_therapy_appointment: string | null
}

export type StaffItem = {
  code: string
  name: string
  role: Role
}

export type ScheduleItem = {
  id: number
  child_idx: number
  child_name: string
  child_member_id: string
  schedule_type: string
  start_datetime: string
  end_datetime: string
}

export type ScheduleDetail = {
  id: number
  schedule_type: string
  child_idx: number
  child_name: string
  child_member_id: string
  start_datetime: string
  end_datetime: string
  doctor_code: string | null
  teacher_code: string | null
  doctor_name: string | null
  therapist_name: string | null
}

export type UnassignedChild = {
  id: number
  name: string
  age_label: string | null
  app_login_id: string | null
}

export type ChildDetailDto = {
  child: {
    id: number
    identifier: string
    name: string
    birth_date: string | null
    age_label: string | null
    primary_diagnosis: string | null
    service_started_at: string | null
    app_login_id: string | null
    next_doctor_appointment: string | null
    next_therapy_appointment: string | null
    doctor_id: string | null
    doctor_name: string | null
    doctor_department: string | null
    therapist_id: string | null
    therapist_name: string | null
    therapist_department: string | null
    therapist_schedule: string | null
  }
  memos: Array<{ type: Role; content: string; updated_at: string }>
}

export type DiagnosisListItem = {
  id: number
  examined_at: string
  duration_label: string | null
  accuracy_pct: number | null
  summary: string | null
  consonant_pct: number | null
  word_pos_pct: number | null
  vowel_pct: number | null
}

export type TreatmentListItem = {
  id: number
  treated_at: string
  session_no: number | null
  trained_sound: string | null
  tags_json: string | null
  try_count: number | null
  avg_accuracy_pct: number | null
  duration_minutes: number | null
}

export type RecordingItem = {
  index: number
  word: string | null
  url: string
}

export type TreatmentDetailDto = {
  id: number
  identifier: string
  service_started_at: string | null
  treated_at: string | null
  session_no: number
  trained_sound: string | null
  accuracy_pct: number | null
  try_count: number | null
  duration_minutes: number | null
  tags: string[]
  weekly: Array<{ day: string; accuracy: number; tries: number; minutes: number }>
  // 진단 상세와 동일한 풀 분석
  duration_label: string | null
  statistics: [string, string, string, string][]
  revised_statistics: [string, string, string, string][]
  mispronunciations: { word: string; ch_pron: string }[]
  error_position: { phoneme: string; count: number; types: string; positions: string }[]
  error_rank: { rank: number; type: string; ratio: string }[]
  stimulability: unknown[]
  consonant_pct: number | null
  word_pos_pct: number | null
  vowel_pct: number | null
  // 베이스라인(최근 진단) 비교 + 다음 단계 제안
  baseline: {
    id: number
    examined_at: string | null
    consonant_pct: number | null
    word_pos_pct: number | null
    vowel_pct: number | null
    error_phoneme_count: number
  } | null
  improvement: {
    consonant_delta: number | null
    word_pos_delta: number | null
    vowel_delta: number | null
    error_phoneme_reduced: number | null
  } | null
  next_step: {
    sound: string | null
    threshold: number
    achieved: number
    message: string
  } | null
}

export type CustomListItem = {
  id: number
  identifier: string
  name: string | null
  birth_date: string | null
  age_label: string | null
  gender: string | null
  therapist_name: string | null
  current_sound: string | null
  upcoming_sound: string | null
  last_diagnosis: string | null
}

export type CustomDetailDto = {
  id: number
  identifier: string
  name: string | null
  age_label: string | null
  gender: string | null
  therapist_name: string | null
  doctor_name: string | null
  schedule: string[]
  current: { sound: string; by: string | null; at: string | null } | null
  reserved: null
  diagnosis_rows: { pos: string; phoneme: string; type: string }[]
}

export type DiagnosisDetailDto = {
  id: number
  child_id: number
  identifier: string
  examined_at: string
  duration_label: string | null
  statistics: [string, string, string, string][]
  revised_statistics: [string, string, string, string][]
  mispronunciations: { word: string; ch_pron: string }[]
  error_position: { phoneme: string; count: number; types: string; positions: string }[]
  error_rank: { rank: number; type: string; ratio: string }[]
  stimulability: unknown[]
}

export type FaqListItem = {
  BOARD_KEY: number
  BOARD_TITLE: string
  GUBUN: string
}

export type FaqImage = {
  BF_IDX: number
  ATTACH_NM: string
  FILE_NM: string
}

export type FaqDetailDto = {
  BOARD_KEY: number
  BOARD_TITLE: string
  BOARD_CONTENT: string | null
  REPLY_MEMO: string | null
  GUBUN: string
  question_images: FaqImage[]
  answer_images: FaqImage[]
}

export type NoticeListItem = {
  BOARD_KEY: number
  GUBUN: string
  BOARD_FIXED: string
  BOARD_TITLE: string
  reg_date: string
  BOARD_READ_COUNT: number
}

export type NoticeListDto = {
  total: number
  categories: string[]
  items: NoticeListItem[]
}

export type NoticeAttachment = {
  BF_IDX: number
  ATTACH_NM: string
  FILE_NM: string
  ATTACH_TYPE: string
  FILE_SIZE: number | null
  FILE_DATA: string | null
}

export type NoticeDetailDto = {
  BOARD_KEY: number
  GUBUN: string
  BOARD_FIXED: string
  BOARD_TITLE: string
  BOARD_CONTENT: string | null
  reg_date: string
  BOARD_READ_COUNT: number
  attachments: NoticeAttachment[]
}

export type AdminChild = {
  id: number
  identifier: string
  name: string
  birth_date: string | null
  age_label: string | null
  gender: string
  regist_date: string | null
  is_new: boolean
  doctor_code: string | null
  doctor_name: string | null
  teacher_code: string | null
  therapist_name: string | null
  deleted_at?: string | null
}

export type AdminStaffItem = {
  code: string
  name: string
  depart_code: string | null
}

export type AdminChildHistory = AdminChild & {
  next_doctor_appointment: string | null
  next_therapy_appointment: string | null
}

export type AdminChildDetail = {
  id: number
  identifier: string
  name: string
  birth_date: string | null
  age_label: string | null
  gender: string
  regist_date: string | null
  doctor_code: string | null
  doctor_name: string | null
  doctor_department: string | null
  teacher_code: string | null
  therapist_name: string | null
  therapist_department: string | null
}

export type AdminChildSchedule = {
  id: number
  schedule_type: string
  start_datetime: string
  end_datetime: string
}

export type AdminMember = {
  id: number
  code: string
  name: string
  depart_code: string | null
  instt_code: string | null
  status: '재직' | '휴직'
  is_new: boolean
  diag_days: string | null
}

export type AdminMemberChild = {
  id: number
  identifier: string
  name: string
  age_label: string | null
  birth_date: string | null
  gender: string
  next_doctor_appointment: string | null
  therapist_name: string | null
  next_therapy_appointment: string | null
  regist_date: string | null
}

export type AdminDeletedMember = {
  id: number
  code: string
  name: string
  depart_code: string | null
  instt_code: string | null
  mtype: 'doctor' | 'therapist'
  status: '재직' | '휴직'
  deleted_at: string | null
}

export type AdminMemberDetailDto = {
  member: AdminMember & { mtype: 'doctor' | 'therapist' }
  children: AdminMemberChild[]
}

export type DashboardDto = {
  stats: {
    total_children: number
    total_delta: number
    trained_today: number
    trained_today_delta: number
    avg_accuracy: number | null
    no_custom: number
  }
  children: {
    id: number
    identifier: string
    name: string
    birth_date: string | null
    age_label: string | null
    diagnosis_date: string | null
    today_accuracy: number | null
    current_sound: string | null
    days_since_trained: number | null
    needs_custom_change: boolean
    latest_training_acc: number | null
  }[]
}

export type AdminDashboardDto = {
  stats: {
    doctors:    { total: number; delta: number; new_count: number }
    therapists: { total: number; delta: number; new_count: number }
    children:   { total: number; delta: number; new_count: number }
  }
  new_doctors:    { id: number; code: string; name: string; depart_code: string | null; regist_date: string | null }[]
  new_therapists: { id: number; code: string; name: string; depart_code: string | null; regist_date: string | null }[]
  new_children:   { id: number; identifier: string; name: string; regist_date: string | null; has_doctor: boolean }[]
}

export type SupportFile = {
  sf_idx: number
  file_nm: string
  source_file_nm: string
  file_size: number | null
}

export type SupportListItem = {
  cs_idx: number
  s_title: string
  s_type: string
  regist_date: string
  reply_yn: string
  reply_date: string | null
}

export type MypageDto = {
  phone: string | null
  diagDays: string | null
  updateDate: string | null
  instName: string | null
}

export type SupportDetailDto = {
  cs_idx: number
  s_title: string
  memo: string
  s_type: string
  name: string
  regist_date: string
  reply_yn: string
  reply_memo: string | null
  reply_date: string | null
  question_files: SupportFile[]
  answer_files: SupportFile[]
}

const BASE = '/api'

function currentUserId(): string {
  return localStorage.getItem('hbd_user_id') ?? ''
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-user-id': currentUserId(),
      ...(init.headers ?? {})
    }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text}`)
  }
  return (await res.json()) as T
}

export const api = {
  me: () => apiFetch<CurrentUserDto>('/me'),
  assignedChildren: () => apiFetch<AssignedChild[]>('/children/assigned'),
  unassignedChildren: () => apiFetch<UnassignedChild[]>('/children/unassigned'),
  assignToMe: (ids: number[]) =>
    apiFetch<{ moved: number }>('/children/assign-to-me', {
      method: 'POST',
      body: JSON.stringify({ ids })
    }),
  childDetail: (id: number) => apiFetch<ChildDetailDto>(`/children/${id}`),
  childDiagnoses: (id: number) => apiFetch<DiagnosisListItem[]>(`/children/${id}/diagnoses`),
  childTreatments: (id: number) => apiFetch<TreatmentListItem[]>(`/children/${id}/treatments`),
  saveMemo: (childId: number, type: Role, content: string) =>
    apiFetch<{ ok: true; updated_at: string }>(`/children/${childId}/memos/${type}`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    }),
  updatePrimaryDiagnosis: (id: number, primary_diagnosis: string) =>
    apiFetch<{ ok: boolean }>(`/children/${id}/primary-diagnosis`, {
      method: 'PUT',
      body: JSON.stringify({ primary_diagnosis })
    }),
  assignTherapist: (id: number, therapist_code: string) =>
    apiFetch<{ ok: boolean }>(`/children/${id}/assign-therapist`, {
      method: 'PUT',
      body: JSON.stringify({ therapist_code })
    }),
  customList: () => apiFetch<CustomListItem[]>('/children/custom-list'),
  customDetail: (id: number) => apiFetch<CustomDetailDto>(`/children/${id}/custom`),
  diagnosis: (id: number) => apiFetch<DiagnosisDetailDto>(`/diagnoses/${id}`),
  diagnosisRecordings: (id: number) => apiFetch<RecordingItem[]>(`/diagnoses/${id}/recordings`),
  staff: (types: ('doctor' | 'therapist')[]) =>
    apiFetch<StaffItem[]>(`/staff?${types.map(t => `type=${t}`).join('&')}`),
  schedules: (from: string, to: string) =>
    apiFetch<ScheduleItem[]>(`/schedules?from=${from}&to=${to}`),
  createSchedule: (body: {
    child_idx: number; start_datetime: string; end_datetime: string
    doctor_code?: string; teacher_code?: string; schedule_type?: string
  }) => apiFetch<{ id: number }>('/schedules', { method: 'POST', body: JSON.stringify(body) }),
  scheduleDetail: (id: number) => apiFetch<ScheduleDetail>(`/schedules/${id}`),
  deleteSchedule: (id: number) =>
    apiFetch<{ ok: boolean }>(`/schedules/${id}`, { method: 'DELETE' }),
  treatmentDetail: (id: number) => apiFetch<TreatmentDetailDto>(`/treatments/${id}`),
  treatmentRecordings: (id: number) => apiFetch<RecordingItem[]>(`/treatments/${id}/recordings`),
  notices: (page: number, gubun: string, search: string) =>
    apiFetch<NoticeListDto>(`/notices?page=${page}&gubun=${encodeURIComponent(gubun)}&search=${encodeURIComponent(search)}`),
  noticeDetail: (id: number) => apiFetch<NoticeDetailDto>(`/notices/${id}`),
  recordNoticeView: (id: number) => apiFetch<{ ok: boolean }>(`/notices/${id}/view`, { method: 'POST' }),
  faqList: (gubun: string, search: string) =>
    apiFetch<{ items: FaqListItem[] }>(`/faq?gubun=${encodeURIComponent(gubun)}&search=${encodeURIComponent(search)}`),
  faqDetail: (id: number) => apiFetch<FaqDetailDto>(`/faq/${id}`),
  adminChildren: (search: string) =>
    apiFetch<AdminChild[]>(`/admin/children?search=${encodeURIComponent(search)}`),
  adminDeleteChildren: (ids: number[]) =>
    apiFetch<{ deleted: number }>('/admin/children', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  adminAssignChild: (childId: number, body: { doctor_code?: string | null; teacher_code?: string | null }) =>
    apiFetch<{ ok: boolean }>(`/admin/children/${childId}/assign`, { method: 'PUT', body: JSON.stringify(body) }),
  adminStaff: (type: 'doctor' | 'therapist', search: string) =>
    apiFetch<AdminStaffItem[]>(`/admin/staff?type=${type}&search=${encodeURIComponent(search)}`),
  adminChildDetail: (id: number) =>
    apiFetch<AdminChildDetail>(`/admin/children/${id}`),
  adminChildSchedules: (id: number, year: number, month: number) =>
    apiFetch<AdminChildSchedule[]>(`/admin/children/${id}/schedules?year=${year}&month=${month}`),
  adminMembers: (type: 'doctor' | 'therapist', search: string) =>
    apiFetch<AdminMember[]>(`/admin/members?type=${type}&search=${encodeURIComponent(search)}`),
  adminMemberDetail: (id: number) =>
    apiFetch<AdminMemberDetailDto>(`/admin/members/${id}`),
  adminUpdateMember: (id: number, body: { name?: string; depart_code?: string | null; status?: '재직' | '휴직'; diag_days?: string | null }) =>
    apiFetch<{ ok: boolean }>(`/admin/members/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  adminDeletedChildren: () =>
    apiFetch<AdminChild[]>('/admin/deleted-children'),
  adminRestoreChildren: (ids: number[]) =>
    apiFetch<{ restored: number }>('/admin/children/restore', { method: 'PUT', body: JSON.stringify({ ids }) }),
  adminDeleteMembers: (ids: number[]) =>
    apiFetch<{ deleted: number }>('/admin/members', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  adminDeletedMembers: () =>
    apiFetch<AdminDeletedMember[]>('/admin/deleted-members'),
  adminRestoreMembers: (ids: number[]) =>
    apiFetch<{ restored: number }>('/admin/members/restore', { method: 'PUT', body: JSON.stringify({ ids }) }),
  dashboard: () =>
    apiFetch<DashboardDto>('/dashboard'),
  adminDashboard: () =>
    apiFetch<AdminDashboardDto>('/admin/dashboard'),
  adminChildHistory: (status: 'active' | 'dormant' | 'all', search: string) =>
    apiFetch<AdminChildHistory[]>(`/admin/child-history?status=${status}&search=${encodeURIComponent(search)}`),
  findIdCheck: (role: Role, name: string, phone: string) =>
    apiFetch<{ ok: true }>('/auth/find-id/check', {
      method: 'POST',
      body: JSON.stringify({ role, name, phone })
    }),
  findIdVerify: (role: Role, name: string, phone: string, code: string) =>
    apiFetch<{ ok: true; maskedId: string }>('/auth/find-id/verify', {
      method: 'POST',
      body: JSON.stringify({ role, name, phone, code })
    }),
  supportList: (from: string, to: string) =>
    apiFetch<{ items: SupportListItem[] }>(`/support?from=${from}&to=${to}`),
  supportCreate: (body: { s_type: string; s_title: string; memo: string; files?: { name: string; size: number; data: string }[] }) =>
    apiFetch<{ id: number }>('/support', { method: 'POST', body: JSON.stringify(body) }),
  supportDetail: (id: number) => apiFetch<SupportDetailDto>(`/support/${id}`),
  supportCancel: (id: number) => apiFetch<{ ok: boolean }>(`/support/${id}`, { method: 'DELETE' }),
  mypage: () => apiFetch<MypageDto>('/mypage'),
  updateMyProfile: (body: { name?: string; department?: string }) =>
    apiFetch<{ ok: boolean }>('/mypage/profile', { method: 'PUT', body: JSON.stringify(body) }),
  changeMyPassword: (body: { current_pw: string; pw: string }) =>
    apiFetch<{ ok: boolean }>('/mypage/password', { method: 'PUT', body: JSON.stringify(body) }),
  verifyMyPassword: (body: { current_pw: string }) =>
    apiFetch<{ ok: boolean }>('/mypage/verify-password', { method: 'POST', body: JSON.stringify(body) }),
  authSendSms: (phone: string) =>
    apiFetch<{ ok: boolean }>('/auth/send-sms', { method: 'POST', body: JSON.stringify({ phone }) }),
  authVerifySms: (phone: string, code: string) =>
    apiFetch<{ ok: boolean }>('/auth/verify-sms', { method: 'POST', body: JSON.stringify({ phone, code }) }),
  changeMyPhone: (phone: string) =>
    apiFetch<{ ok: boolean }>('/mypage/phone', { method: 'PUT', body: JSON.stringify({ phone }) }),
  updateMySchedule: (diagDays: string | null) =>
    apiFetch<{ ok: boolean }>('/mypage/schedule', { method: 'PUT', body: JSON.stringify({ diagDays }) }),
}
