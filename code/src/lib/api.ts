import type { Role } from './auth'

export type CurrentUserDto = {
  id: string
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
}

export type CustomListItem = {
  id: number
  identifier: string
  therapist_name: string
  current_sound: string | null
  upcoming_sound: string | null
  last_diagnosis: string | null
}

export type CustomDetailDto = {
  id: number
  identifier: string
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
  error_position: { phoneme: string; types: string; positions: string }[]
  error_rank: { rank: number; type: string; ratio: string }[]
  stimulability: unknown[]
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
  treatmentRecordings: (id: number) => apiFetch<RecordingItem[]>(`/treatments/${id}/recordings`)
}
