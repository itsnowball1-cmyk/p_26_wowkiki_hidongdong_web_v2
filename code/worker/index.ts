import { createConnection, type Connection, type RowDataPacket, type ResultSetHeader } from 'mysql2/promise'

// ─── 환경 타입 ───────────────────────────────────────────────────────────────

type Env = {
  ASSETS: Fetcher
  DB_HOST: string
  DB_PORT: string
  DB_USER: string
  DB_PASSWORD: string
  DB_DATABASE: string
  FILES_BASE_URL: string
  FILES_ORIGIN?: string
  ALIGO_KEY: string
  ALIGO_USER_ID: string
  ALIGO_SENDER: string
}

// ─── 역할 매핑 ───────────────────────────────────────────────────────────────
// DB의 mtype ('healler' 오타 포함) ↔ 웹 role 변환

type Mtype = 'sadmin' | 'wadmin' | 'iadmin' | 'doctor' | 'healler' | 'child' | 'parent'
type Role  = 'admin' | 'doctor' | 'therapist'

const STAFF_MTYPES: readonly Mtype[] = ['doctor', 'healler', 'iadmin', 'sadmin', 'wadmin']

function mtypeToRole(m: Mtype): Role {
  if (m === 'doctor') return 'doctor'
  if (m === 'healler') return 'therapist'
  return 'admin'
}

function roleToMtypes(r: Role): string[] {
  if (r === 'doctor')    return ['doctor']
  if (r === 'therapist') return ['healler']
  return ['iadmin', 'sadmin', 'wadmin']
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function ph(n: number) { return Array(n).fill('?').join(',') }

function fmtDate(d: unknown): string | null {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d as string)
  if (isNaN(dt.getTime())) return null
  return dt.toISOString().slice(0, 10).replace(/-/g, '.')
}

function fmtDateTime(d: unknown): string | null {
  if (!d) return null
  const dt = d instanceof Date ? d : new Date(d as string)
  if (isNaN(dt.getTime())) return null
  const date = dt.toISOString().slice(0, 10).replace(/-/g, '.')
  const time = dt.toISOString().slice(11, 16)
  return `${date} ${time}`
}

function ageLabel(birthDate: unknown): string | null {
  if (!birthDate) return null
  const bd = birthDate instanceof Date ? birthDate : new Date(birthDate as string)
  if (isNaN(bd.getTime())) return null
  return `만 ${Math.floor((Date.now() - bd.getTime()) / (365.25 * 24 * 3600 * 1000))}세`
}

async function sendSmsAligo(env: Env, phone: string, msg: string): Promise<void> {
  const form = new URLSearchParams({
    key:      env.ALIGO_KEY,
    user_id:  env.ALIGO_USER_ID,
    sender:   env.ALIGO_SENDER,
    receiver: phone,
    msg,
  })
  await fetch('https://apis.aligo.in/send/', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
}

// ─── DB 연결 ─────────────────────────────────────────────────────────────────

type StaffRow = RowDataPacket & {
  idx: number
  id: string            // 로그인 ID (tb_member.id)
  code: string | null   // 고유 코드 — children.doctor_code / teacher_code 와 매핑
  mtype: Mtype
  pw?: string | null
  name: string
  instt_code: string
  depart_code: string | null
  approval_status?: string | null
}

const TEXT_FIELD_TYPES = new Set(['VAR_STRING', 'STRING', 'BLOB', 'TINY_BLOB', 'MEDIUM_BLOB', 'LONG_BLOB'])

async function getConn(env: Env): Promise<Connection> {
  return createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_DATABASE,
    charset: 'utf8mb4',
    disableEval: true,
    timezone: '+00:00',
    // mysql2 in Cloudflare Workers decodes text bytes as Latin-1; force UTF-8.
    // Buffer polyfill is not a true Uint8Array so we must Array.from() first.
    typeCast(field, next) {
      if (TEXT_FIELD_TYPES.has(field.type) && (field as { charsetNr?: number }).charsetNr !== 63) {
        const buf = field.buffer()
        if (buf == null) return null
        return new TextDecoder('utf-8').decode(new Uint8Array(Array.from(buf) as number[]))
      }
      return next()
    }
  })
}

async function withConn<T>(env: Env, fn: (conn: Connection) => Promise<T>): Promise<T> {
  const conn = await getConn(env)
  try {
    await conn.query("SET NAMES 'utf8mb4'")
    return await fn(conn)
  } finally {
    await conn.end()
  }
}

// ─── analysislog 파싱 헬퍼 ───────────────────────────────────────────────────

const POS_LABEL: Record<string, string> = {
  EODU_CHO: '어두초성', EODU_JUNG: '어두중성', EODU_JONG: '어두종성',
  EOJUNG_CHO: '어중초성', EOJUNG_JUNG: '어중중성', EOJUNG_JONG: '어중종성',
  EOMAL_CHO: '어말초성', EOMAL_JUNG: '어말중성', EOMAL_JONG: '어말종성'
}

function parseDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || isNaN(seconds) || seconds < 0 || seconds > 7200) return null
  const s = Math.round(seconds)
  return s >= 60 ? `${Math.floor(s / 60)}분 ${s % 60}초` : `${s}초`
}

function parseAnalysislog(raw: string | null): {
  duration_label: string | null
  duration_minutes: number | null
  accuracy_pct: number | null
  summary: string | null
  trained_sound: string | null
  tags_json: string | null
  try_count: number | null
} {
  const empty = { duration_label: null, duration_minutes: null, accuracy_pct: null, summary: null, trained_sound: null, tags_json: null, try_count: null }
  if (!raw) return empty
  try {
    const log = JSON.parse(raw) as {
      summary?: { duration?: number; aim_joum?: string; aim_pos?: string; act_type?: string; round?: number }
      statistics?: Array<{ stts_id: string; score: number; ttl_cnt: number }>
    }
    const summ = log.summary ?? {}
    const stats = log.statistics ?? []

    const pcc = stats.find(s => s.stts_id === 'TOTAL_PCC')
    const accuracy_pct = pcc ? Math.round(pcc.score) : null

    const posLabel = POS_LABEL[summ.aim_pos ?? ''] ?? summ.aim_pos ?? ''
    const sound = posLabel && summ.aim_joum ? `${posLabel} ${summ.aim_joum}` : null

    const durationSecs = summ.duration ?? null
    return {
      duration_label:   parseDuration(durationSecs),
      duration_minutes: durationSecs != null ? Math.round(durationSecs / 60) : null,
      accuracy_pct:     accuracy_pct,
      summary:          sound,
      trained_sound:    sound,
      tags_json:        summ.act_type ? JSON.stringify([summ.act_type]) : null,
      try_count:        stats.find(s => s.stts_id === 'TOTAL_PCC')?.ttl_cnt ?? null
    }
  } catch {
    return empty
  }
}

// ─── analysislog 상세 파싱 (진단 결과 상세 페이지용) ────────────────────────

const MAIN_STTS_IDS  = ['UTAP_PCC', 'TOTAL_PCC', 'PWC', 'PMLU', 'PWP']
const REVISED_STTS_IDS = ['UTAP_PCC', 'PWC', 'PMLU', 'PWP']

const STTS_MAIN_LABEL: Record<string, string> = {
  UTAP_PCC: '자음정확도', TOTAL_PCC: '전체 자음정확도',
  PWC: '단어단위 정확률', PMLU: '평균음운길이', PWP: '단어단위 근접률'
}

const STTS_REVISED_LABEL: Record<string, string> = {
  UTAP_PCC: '개정 자음정확도', PWC: '단어단위 정확률',
  PMLU: '평균음운길이', PWP: '단어단위 근접률'
}

const E_CTGR_LABEL: Record<string, string> = {
  CHANGE: '대치', OMISSION: '생략', OMIT: '생략',
  ADDITION: '첨가', ADD: '첨가',
  DISTORTION: '왜곡', DISTORT: '왜곡'
}

function prcntlLabel(p: number): string {
  return p <= 0 ? '1%ile 이하' : `${Math.round(p)}%ile`
}

function lvLabel(lv: number): string {
  if (lv === 1) return '정상'
  if (lv === 2) return '경도'
  if (lv === 3) return '중도'
  if (lv === 4) return '심도'
  return '-'
}

type StatEntry = {
  stts_id: string; prcntl: number; lv: number; score: number
  attr?: string; ttl_cnt?: number; crct_cnt?: number
}

type MispronEntry = {
  qz_nth: number; word: string; pron: string; ch_pron: string
  e_list?: Array<{ pos: string; aim_joum: string; ch_joum: string; e_ctgr: string; e_attr: string }>
}

type DiagDetail = {
  duration_label: string | null
  statistics: [string, string, string, string][]
  revised_statistics: [string, string, string, string][]
  mispronunciations: { word: string; ch_pron: string }[]
  error_position: { phoneme: string; types: string; positions: string }[]
  error_rank: { rank: number; type: string; ratio: string }[]
  stimulability: unknown[]
}

function parseAnalysislogDetail(raw: string | null): DiagDetail {
  const empty: DiagDetail = {
    duration_label: null, statistics: [], revised_statistics: [],
    mispronunciations: [], error_position: [], error_rank: [], stimulability: []
  }
  if (!raw) return empty
  try {
    const log = JSON.parse(raw) as {
      summary?: { duration?: number }
      statistics?: StatEntry[]
      revised_statistics?: StatEntry[]
      mispronunciations?: MispronEntry[]
      stimulability?: { score?: number; details?: unknown[] }
    }

    const statsMap = new Map((log.statistics ?? []).map(s => [s.stts_id, s]))
    const statistics = MAIN_STTS_IDS
      .filter(id => statsMap.has(id))
      .map(id => {
        const s = statsMap.get(id)!
        return [STTS_MAIN_LABEL[id], s.score.toFixed(2), prcntlLabel(s.prcntl), lvLabel(s.lv)] as [string,string,string,string]
      })

    const revisedMap = new Map((log.revised_statistics ?? []).map(s => [s.stts_id, s]))
    const revised_statistics = REVISED_STTS_IDS
      .filter(id => revisedMap.has(id))
      .map(id => {
        const s = revisedMap.get(id)!
        return [STTS_REVISED_LABEL[id], s.score.toFixed(2), prcntlLabel(s.prcntl), lvLabel(s.lv)] as [string,string,string,string]
      })

    const misprons = log.mispronunciations ?? []
    const mispronunciations = misprons.map(m => ({ word: m.word, ch_pron: m.ch_pron }))

    const phonemeMap = new Map<string, { types: Set<string>; positions: Set<string> }>()
    for (const m of misprons) {
      for (const e of m.e_list ?? []) {
        const joum: string | undefined = e.aim_joum || undefined
        const posLabel = (e.pos && POS_LABEL[e.pos]) ? POS_LABEL[e.pos] : (e.pos || null)
        if (!joum || !posLabel) continue
        if (!phonemeMap.has(joum)) phonemeMap.set(joum, { types: new Set(), positions: new Set() })
        const entry = phonemeMap.get(joum)!
        if (e.e_ctgr) entry.types.add(E_CTGR_LABEL[e.e_ctgr] ?? e.e_ctgr)
        entry.positions.add(posLabel)
      }
    }
    const error_position = [...phonemeMap.entries()].map(([phoneme, d]) => ({
      phoneme: `/${phoneme}/`,
      types: [...d.types].join(', '),
      positions: [...d.positions].join(', ')
    }))

    const ctgrCount = new Map<string, number>()
    let totalErrors = 0
    for (const m of misprons) {
      for (const e of m.e_list ?? []) {
        if (!e.e_ctgr) continue
        const label = E_CTGR_LABEL[e.e_ctgr] ?? e.e_ctgr
        ctgrCount.set(label, (ctgrCount.get(label) ?? 0) + 1)
        totalErrors++
      }
    }
    const error_rank = [...ctgrCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([type, cnt], i) => ({
        rank: i + 1, type,
        ratio: totalErrors > 0 ? `${((cnt / totalErrors) * 100).toFixed(1)}%` : '0%'
      }))

    return {
      duration_label: parseDuration(log.summary?.duration ?? null),
      statistics, revised_statistics, mispronunciations, error_position, error_rank,
      stimulability: log.stimulability?.details ?? []
    }
  } catch {
    return empty
  }
}

// ─── HTTP 헬퍼 ───────────────────────────────────────────────────────────────

const json = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init.headers ?? {}) }
  })

const err = (status: number, message: string) => json({ error: message }, { status })

// ─── 인증 헬퍼 ───────────────────────────────────────────────────────────────

async function getCurrentUser(conn: Connection, request: Request): Promise<StaffRow | null> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return null
  const [rows] = await conn.query<StaffRow[]>(
    `SELECT idx, id, code, mtype, name, instt_code, depart_code, approval_status, admin_memo
     FROM tb_member
     WHERE id = ? AND mtype IN (${ph(STAFF_MTYPES.length)}) AND delete_yn = 'N'
     LIMIT 1`,
    [userId, ...STAFF_MTYPES]
  )
  return rows[0] ?? null
}

// 아동이 사용자와 같은 기관인지 확인
async function ownsChild(conn: Connection, childIdx: number, user: StaffRow): Promise<boolean> {
  const [rows] = await conn.query<RowDataPacket[]>(
    `SELECT instt_code FROM tb_member
     WHERE idx = ? AND mtype = 'child' AND delete_yn = 'N' LIMIT 1`,
    [childIdx]
  )
  const c = rows[0] as { instt_code: string } | undefined
  return !!c && c.instt_code === user.instt_code
}

// ─── 로그인 ──────────────────────────────────────────────────────────────────

const LOGIN_FAIL_MSG =
  '아이디(로그인 전화번호, 로그인 전용 아이디) 또는 비밀번호가 잘못 되었습니다.\n아이디와 비밀번호를 정확히 입력해 주세요.'

async function handleLogin(request: Request, conn: Connection): Promise<Response> {
  const body = (await request.json().catch(() => ({}))) as {
    role?: Role; id?: string; password?: string
  }
  const role = body.role
  const id   = (body.id ?? '').trim()
  const pw   = body.password ?? ''

  if (!role || !id || !pw) return err(401, LOGIN_FAIL_MSG)

  const mtypes = roleToMtypes(role)
  const [rows] = await conn.query<StaffRow[]>(
    `SELECT idx, id, code, mtype, pw, name, instt_code, depart_code, approval_status, admin_memo
     FROM tb_member
     WHERE id = ? AND mtype IN (${ph(mtypes.length)}) AND delete_yn = 'N'
     LIMIT 1`,
    [id, ...mtypes]
  )
  const row = rows[0]
  if (!row || row.pw !== pw) return err(401, LOGIN_FAIL_MSG)
  if (row.approval_status === '승인대기') {
    return json({
      id: row.id, code: row.code ?? null, name: row.name,
      role: mtypeToRole(row.mtype), institutionCode: row.instt_code,
      department: row.depart_code ?? null, schedule: null,
      approvalStatus: 'pending',
    })
  }
  if (row.approval_status === '반려') {
    let rejectTitle = '', rejectReason = ''
    try { const m = JSON.parse((row as StaffRow & { admin_memo?: string }).admin_memo ?? '{}'); rejectTitle = m.title ?? ''; rejectReason = m.reason ?? '' } catch {}
    return json({
      id: row.id, code: row.code ?? null, name: row.name,
      role: mtypeToRole(row.mtype), institutionCode: row.instt_code,
      department: row.depart_code ?? null, schedule: null,
      approvalStatus: 'rejected', rejectTitle, rejectReason,
    })
  }

  return json({
    id:              row.id,
    code:            row.code ?? null,
    name:            row.name,
    role:            mtypeToRole(row.mtype),
    institutionCode: row.instt_code,
    department:      row.depart_code ?? null,
    schedule:        null
  })
}

// ─── 메인 라우터 ─────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // 녹음 파일 프록시: /dataCenter/... → FILES_ORIGIN 서버로 전달
    if (url.pathname.startsWith('/dataCenter/') && env.FILES_ORIGIN) {
      const origin = env.FILES_ORIGIN.replace(/\/$/, '')
      const upstream = `${origin}${url.pathname}`
      const res = await fetch(upstream)
      const headers = new Headers()
      const ct = res.headers.get('content-type')
      if (ct) headers.set('content-type', ct)
      headers.set('cache-control', 'public, max-age=86400')
      headers.set('access-control-allow-origin', '*')
      return new Response(res.body, { status: res.status, headers })
    }

    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

    return withConn(env, conn => handleApi(url, request, conn, env))
      .catch((e: unknown) => err(500, e instanceof Error ? e.message : 'internal error'))
  }
} satisfies ExportedHandler<Env>

async function handleApi(url: URL, request: Request, conn: Connection, env: Env): Promise<Response> {
  const path   = url.pathname
  const method = request.method

  try {
    // ── 인증 불필요 ──────────────────────────────────────────────────────────

    if (path === '/api/auth/login' && method === 'POST') return handleLogin(request, conn)

    // POST /api/auth/signup
    if (path === '/api/auth/signup' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        role?: string; id?: string; pw?: string; name?: string
        phone?: string; email?: string; instt_code?: string; depart_code?: string
        license_file_nm?: string; license_file_data?: string
      }
      const BUILTIN_INSTITUTION_CODES = new Set(['HBD', 'HIC', 'HAS', 'TEST'])
      const { role, id, pw, name, phone, email, depart_code, license_file_nm, license_file_data } = body
      const instt_code = (body.instt_code ?? '').trim().toUpperCase()
      if (!role || !id || !pw || !name || !instt_code) return err(400, '필수 항목이 누락되었습니다.')
      if (role !== 'doctor' && role !== 'therapist') return err(400, '유효하지 않은 역할입니다.')
      if (!BUILTIN_INSTITUTION_CODES.has(instt_code)) {
        const [validRows] = await conn.query<RowDataPacket[]>(
          `SELECT 1 FROM tb_member WHERE instt_code = ? AND mtype = 'iadmin' AND delete_yn = 'N' AND approval_status IS NULL LIMIT 1`,
          [instt_code]
        )
        if ((validRows as RowDataPacket[]).length === 0) return err(400, '유효하지 않은 기관코드입니다.')
      }

      // 아이디 중복 확인
      const [existRows] = await conn.query<RowDataPacket[]>(
        `SELECT idx FROM tb_member WHERE id = ? LIMIT 1`, [id]
      )
      if ((existRows as RowDataPacket[]).length > 0) return err(409, '이미 사용 중인 아이디입니다.')

      const mtype  = role === 'doctor' ? 'doctor' : 'healler'
      const prefix = role === 'doctor' ? 'D' : 'T'

      // 해당 기관·역할의 마지막 코드 번호 조회 후 +1
      const [codeRows] = await conn.query<RowDataPacket[]>(
        `SELECT code FROM tb_member WHERE instt_code = ? AND mtype = ? AND code LIKE ? ORDER BY code DESC LIMIT 1`,
        [instt_code, mtype, `${instt_code}_${prefix}_%`]
      )
      let seq = 1
      if ((codeRows as RowDataPacket[]).length > 0) {
        const lastNum = parseInt(((codeRows[0] as { code: string }).code).split('_').pop() ?? '0', 10)
        if (!isNaN(lastNum)) seq = lastNum + 1
      }
      const code = `${instt_code}_${prefix}_${String(seq).padStart(3, '0')}`

      const approvalStatus = role === 'therapist' ? '승인대기' : null
      const [insertResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO tb_member (id, pw, code, mtype, name, phone, email, instt_code, depart_code, approval_status, license_file_nm, delete_yn, regist_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'N', NOW())`,
        [id, pw, code, mtype, name, phone ?? null, email ?? null, instt_code, depart_code ?? null, approvalStatus, license_file_nm ?? null]
      )
      if (license_file_nm && license_file_data) {
        await conn.query(
          `INSERT INTO tb_license_file (member_idx, source_file_nm, file_data) VALUES (?, ?, ?)`,
          [insertResult.insertId, license_file_nm, license_file_data]
        )
        try {
          await conn.query(
            `INSERT INTO tb_approval_history (member_idx, attempt_number, source_file_nm, file_data) VALUES (?, 1, ?, ?)`,
            [insertResult.insertId, license_file_nm, license_file_data]
          )
        } catch { /* tb_approval_history 없으면 건너뜀 */ }
      }
      return json({ ok: true, code })
    }

    // POST /api/auth/signup-admin — 기관 관리자 회원가입
    // 사전 DB 준비 필요:
    // CREATE TABLE IF NOT EXISTS tb_institution (
    //   idx INT PRIMARY KEY AUTO_INCREMENT,
    //   code VARCHAR(20) UNIQUE NOT NULL,
    //   inst_type VARCHAR(50),
    //   inst_name VARCHAR(255),
    //   business_reg_num VARCHAR(50),
    //   address VARCHAR(500),
    //   address_detail VARCHAR(255),
    //   director_name VARCHAR(100),
    //   other_requests TEXT,
    //   doctor_sheets VARCHAR(20),
    //   therapist_sheets VARCHAR(20),
    //   regist_date DATETIME DEFAULT NOW()
    // );
    if (path === '/api/auth/signup-admin' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        institutionType?: string; institutionName?: string; businessRegNumber?: string
        businessRegCertNm?: string; businessRegCertData?: string
        name?: string; phone?: string; id?: string; pw?: string; email?: string
        address?: string; addressDetail?: string; directorName?: string
        otherRequests?: string; doctorSheets?: string; therapistSheets?: string
      }
      const {
        institutionType, institutionName, businessRegNumber,
        businessRegCertNm, businessRegCertData,
        name, phone, id, pw, email,
        address, addressDetail, directorName, otherRequests,
        doctorSheets, therapistSheets
      } = body

      if (!institutionType || !institutionName || !name || !id || !pw)
        return err(400, '필수 항목이 누락되었습니다.')

      // ID 중복 확인
      const [existRows] = await conn.query<RowDataPacket[]>(
        `SELECT idx FROM tb_member WHERE id = ? LIMIT 1`, [id]
      )
      if ((existRows as RowDataPacket[]).length > 0) return err(409, '이미 사용 중인 아이디입니다.')

      // 기관 코드 생성: INST + 3자리 순번
      const [instCountRows] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT instt_code) AS cnt FROM tb_member
         WHERE mtype IN ('iadmin', 'sadmin', 'wadmin') AND instt_code LIKE 'INST%' AND delete_yn = 'N'`
      )
      const instSeq = ((instCountRows[0] as { cnt: number }).cnt ?? 0) + 1
      const instt_code = `INST${String(instSeq).padStart(3, '0')}`
      const code = `${instt_code}_A_001`

      // 기관 정보 저장 (테이블 없으면 무시)
      try {
        await conn.query(
          `INSERT INTO tb_institution (code, inst_type, inst_name, business_reg_num, address, address_detail, director_name, other_requests, doctor_sheets, therapist_sheets)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [instt_code, institutionType, institutionName, businessRegNumber ?? null,
           address ?? null, addressDetail ?? null, directorName ?? null,
           otherRequests ?? null, doctorSheets ?? null, therapistSheets ?? null]
        )
      } catch { /* tb_institution 없으면 건너뜀 */ }

      // 관리자 계정 생성 — 와우키키 관리자 승인 후 로그인 가능
      const [insertResult] = await conn.query<ResultSetHeader>(
        `INSERT INTO tb_member (id, pw, code, mtype, name, phone, email, instt_code, approval_status, license_file_nm, delete_yn, regist_date)
         VALUES (?, ?, ?, 'iadmin', ?, ?, ?, ?, '승인대기', ?, 'N', NOW())`,
        [id, pw, code, name, phone ?? null, email ?? null, instt_code, businessRegCertNm ?? null]
      )

      // 사업자등록증 저장
      if (businessRegCertNm && businessRegCertData) {
        await conn.query(
          `INSERT INTO tb_license_file (member_idx, source_file_nm, file_data) VALUES (?, ?, ?)`,
          [insertResult.insertId, businessRegCertNm, businessRegCertData]
        )
        try {
          await conn.query(
            `INSERT INTO tb_approval_history (member_idx, attempt_number, source_file_nm, file_data) VALUES (?, 1, ?, ?)`,
            [insertResult.insertId, businessRegCertNm, businessRegCertData]
          )
        } catch { /* tb_approval_history 없으면 건너뜀 */ }
      }

      return json({ ok: true, instt_code })
    }

    // POST /api/auth/supplement — 반려된 치료사가 파일 재제출
    if (path === '/api/auth/supplement' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        id?: string; license_file_nm?: string; license_file_data?: string
      }
      const { id, license_file_nm, license_file_data } = body
      if (!id || !license_file_nm || !license_file_data) return err(400, '필수 항목이 누락되었습니다.')

      const [memberRows] = await conn.query<RowDataPacket[]>(
        `SELECT idx FROM tb_member WHERE id = ? AND mtype = 'healler' AND approval_status = '반려' AND delete_yn = 'N' LIMIT 1`,
        [id]
      )
      const member = memberRows[0] as { idx: number } | undefined
      if (!member) return err(404, '해당 계정을 찾을 수 없습니다.')

      await conn.query(
        `INSERT INTO tb_license_file (member_idx, source_file_nm, file_data) VALUES (?, ?, ?)`,
        [member.idx, license_file_nm, license_file_data]
      )
      try {
        const [[last]] = await conn.query<RowDataPacket[]>(
          `SELECT COALESCE(MAX(attempt_number), 0) AS last FROM tb_approval_history WHERE member_idx = ?`,
          [member.idx]
        ) as [RowDataPacket[], unknown]
        await conn.query(
          `INSERT INTO tb_approval_history (member_idx, attempt_number, source_file_nm, file_data) VALUES (?, ?, ?, ?)`,
          [member.idx, (last?.last ?? 0) + 1, license_file_nm, license_file_data]
        )
      } catch { /* tb_approval_history 없으면 건너뜀 */ }
      await conn.query(
        `UPDATE tb_member SET approval_status = '승인대기', license_file_nm = ?, update_date = NOW() WHERE idx = ?`,
        [license_file_nm, member.idx]
      )
      return json({ ok: true })
    }

    // POST /api/auth/iadmin-supplement — 반려된 기관관리자 재신청
    if (path === '/api/auth/iadmin-supplement' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        id?: string; institutionType?: string; institutionName?: string
        businessRegCertNm?: string; businessRegCertData?: string
        doctorSheets?: string; therapistSheets?: string
      }
      if (!body.id) return err(400, '필수 항목이 누락되었습니다.')
      const [memberRows] = await conn.query<RowDataPacket[]>(
        `SELECT idx, instt_code FROM tb_member WHERE id = ? AND mtype = 'iadmin' AND approval_status = '반려' AND delete_yn = 'N' LIMIT 1`,
        [body.id]
      )
      const member = memberRows[0] as { idx: number; instt_code: string } | undefined
      if (!member) return err(404, '해당 계정을 찾을 수 없습니다.')
      try {
        await conn.query(
          `UPDATE tb_institution SET inst_type = ?, inst_name = ?, doctor_sheets = ?, therapist_sheets = ? WHERE code = ?`,
          [body.institutionType ?? null, body.institutionName ?? null, body.doctorSheets ?? null, body.therapistSheets ?? null, member.instt_code]
        )
      } catch {}
      if (body.businessRegCertNm && body.businessRegCertData) {
        await conn.query(
          `INSERT INTO tb_license_file (member_idx, source_file_nm, file_data) VALUES (?, ?, ?)`,
          [member.idx, body.businessRegCertNm, body.businessRegCertData]
        )
        try {
          const [[last]] = await conn.query<RowDataPacket[]>(
            `SELECT COALESCE(MAX(attempt_number), 0) AS last FROM tb_approval_history WHERE member_idx = ?`,
            [member.idx]
          ) as [RowDataPacket[], unknown]
          await conn.query(
            `INSERT INTO tb_approval_history (member_idx, attempt_number, source_file_nm, file_data) VALUES (?, ?, ?, ?)`,
            [member.idx, (last?.last ?? 0) + 1, body.businessRegCertNm, body.businessRegCertData]
          )
        } catch { /* tb_approval_history 없으면 건너뜀 */ }
        await conn.query(`UPDATE tb_member SET license_file_nm = ?, update_date = NOW() WHERE idx = ?`, [body.businessRegCertNm, member.idx])
      }
      await conn.query(
        `UPDATE tb_member SET approval_status = '승인대기', admin_memo = NULL, update_date = NOW() WHERE idx = ?`,
        [member.idx]
      )
      return json({ ok: true })
    }

    // POST /api/auth/send-sms
    if (path === '/api/auth/send-sms' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { phone?: string }
      const phone = (body.phone ?? '').replace(/\D/g, '')
      if (!phone || phone.length < 10) return err(400, '올바른 전화번호를 입력해주세요.')

      const code = String(Math.floor(100000 + Math.random() * 900000))
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000)
        .toISOString().slice(0, 19).replace('T', ' ')

      await conn.query(
        `DELETE FROM sms_verification WHERE phone = ?`, [phone]
      )
      await conn.query(
        `INSERT INTO sms_verification (phone, code, expires_at) VALUES (?, ?, ?)`,
        [phone, code, expiresAt]
      )

      const form = new URLSearchParams({
        key:     env.ALIGO_KEY,
        user_id: env.ALIGO_USER_ID,
        sender:  env.ALIGO_SENDER,
        receiver: phone,
        msg:     `[하이동동] 인증번호 [${code}]를 입력해주세요. (3분 이내 유효)`
      })
      const smsRes = await fetch('https://apis.aligo.in/send/', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form.toString()
      })
      const smsData = await smsRes.json() as { result_code?: string; message?: string }
      if (smsData.result_code !== '1') {
        return err(500, smsData.message ?? 'SMS 발송에 실패했습니다.')
      }
      return json({ ok: true })
    }

    // POST /api/auth/verify-sms
    if (path === '/api/auth/verify-sms' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as { phone?: string; code?: string }
      const phone = (body.phone ?? '').replace(/\D/g, '')
      const code  = (body.code ?? '').trim()
      if (!phone || !code) return err(400, '전화번호와 인증번호를 입력해주세요.')

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT id, code, expires_at, verified FROM sms_verification
         WHERE phone = ? ORDER BY id DESC LIMIT 1`,
        [phone]
      )
      const row = rows[0] as { id: number; code: string; expires_at: Date; verified: number } | undefined
      if (!row) return err(400, '인증번호를 먼저 요청해주세요.')
      if (row.verified) return err(400, '이미 사용된 인증번호입니다.')
      if (new Date(row.expires_at) < new Date()) return err(400, '인증번호가 만료되었습니다. 다시 요청해주세요.')
      if (row.code !== code) return err(400, '인증번호가 동일하지 않습니다.')

      await conn.query(`UPDATE sms_verification SET verified = 1 WHERE id = ?`, [row.id])
      return json({ ok: true })
    }

    // GET /api/auth/check-institution?code=xxx
    if (path === '/api/auth/check-institution' && method === 'GET') {
      const code = (url.searchParams.get('code') ?? '').trim().toUpperCase()
      if (!code) return err(400, 'code required')
      // 레거시 기관코드는 항상 유효, 신규 기관코드는 DB에서 승인된 iadmin 여부로 판단
      const BUILTIN_CODES = new Set(['HBD', 'HIC', 'HAS', 'TEST'])
      if (BUILTIN_CODES.has(code)) return json({ valid: true })
      const [codeRows] = await conn.query<RowDataPacket[]>(
        `SELECT 1 FROM tb_member WHERE instt_code = ? AND mtype = 'iadmin' AND delete_yn = 'N' AND approval_status IS NULL LIMIT 1`,
        [code]
      )
      return json({ valid: (codeRows as RowDataPacket[]).length > 0 })
    }

    // GET /api/auth/check-id?id=xxx
    if (path === '/api/auth/check-id' && method === 'GET') {
      const id = url.searchParams.get('id') ?? ''
      if (!id.trim()) return err(400, 'id required')
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT idx FROM tb_member WHERE id = ? LIMIT 1', [id.trim()]
      )
      return json({ available: (rows as RowDataPacket[]).length === 0 })
    }

    // MariaDB 연결 확인용 — 전환 완료 후 제거
    if (path === '/api/db-ping' && method === 'GET') {
      const [[{ v }]] = await conn.query('SELECT ? AS v', ['pong']) as [Array<{ v: string }>, unknown]
      return json({ ok: true, echo: v })
    }

    // ── 인증 필요 ────────────────────────────────────────────────────────────

    const user = await getCurrentUser(conn, request)
    if (!user) return err(401, 'unauthorized')

    // ── 와우키키 어드민 전용 ──────────────────────────────────────────────────

    // GET /api/admin/stats — 전체 통계
    if (path === '/api/admin/stats' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const [[inst]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT instt_code) AS cnt FROM tb_member WHERE mtype IN ('iadmin','doctor','healler') AND delete_yn='N'`
      ) as [RowDataPacket[], unknown]
      const [[web]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_member WHERE mtype IN ('doctor','healler','iadmin') AND delete_yn='N'`
      ) as [RowDataPacket[], unknown]
      const [[app]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_member WHERE mtype='child' AND delete_yn='N'`
      ) as [RowDataPacket[], unknown]
      return json({
        total_institutions: (inst as {cnt:number}).cnt,
        total_web_users:    (web  as {cnt:number}).cnt,
        total_app_users:    (app  as {cnt:number}).cnt,
      })
    }

    // GET /api/admin/pending-approvals — 승인 대기 목록 (대시보드용)
    if (path === '/api/admin/pending-approvals' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT idx, id, name, mtype, instt_code, regist_date FROM tb_member
         WHERE approval_status = '승인대기' AND delete_yn = 'N'
         ORDER BY regist_date DESC`
      )
      return json((rows as Array<RowDataPacket & {idx:number;id:string;name:string;mtype:Mtype;instt_code:string;regist_date:unknown}>).map(r => ({
        idx:        r.idx,
        id:         r.id,
        name:       r.name,
        role:       r.mtype === 'healler' ? '치료사' : r.mtype === 'iadmin' ? '기관관리자' : r.mtype,
        instt_code: r.instt_code,
        regist_date: fmtDate(r.regist_date) ?? '-',
      })))
    }

    // POST /api/admin/approve — 승인 또는 반려
    if (path === '/api/admin/approve' && method === 'POST') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const body = (await request.json().catch(() => ({}))) as {
        idx?: number; action?: 'approve' | 'reject'
        instt_code?: string; reject_title?: string; reject_reason?: string
      }
      if (!body.idx || !body.action) return err(400, '필수 항목 누락')

      // 회원 정보 조회 (SMS 발송용)
      const [memberRows] = await conn.query<RowDataPacket[]>(
        `SELECT m.name, m.phone, m.instt_code, i.inst_name
         FROM tb_member m
         LEFT JOIN tb_institution i ON i.code = m.instt_code
         WHERE m.idx = ? LIMIT 1`,
        [body.idx]
      )
      const member = memberRows[0] as { name: string; phone: string; instt_code: string; inst_name: string } | undefined

      if (body.action === 'approve') {
        const instt_code = (body.instt_code ?? '').trim()
        if (!instt_code) return err(400, '기관코드를 입력해주세요.')
        const oldCode = member?.instt_code ?? ''
        await conn.query(
          `UPDATE tb_member SET approval_status = NULL, instt_code = ?, code = REPLACE(code, ?, ?), update_date = NOW() WHERE idx = ?`,
          [instt_code, oldCode, instt_code, body.idx]
        )
        try { await conn.query(`UPDATE tb_institution SET code = ? WHERE code = ?`, [instt_code, oldCode]) } catch {}

        // 승인 SMS 발송
        if (member?.phone) {
          try {
            const [tplRows] = await conn.query<RowDataPacket[]>(
              `SELECT template_body FROM tb_sms_template WHERE template_key = 'approve' LIMIT 1`
            )
            const tplBody = (tplRows[0] as { template_body?: string } | undefined)?.template_body
            if (tplBody) {
              const msg = tplBody
                .replace(/\{name\}/g, member.name ?? '')
                .replace(/\{inst_name\}/g, member.inst_name ?? '')
                .replace(/\{instt_code\}/g, instt_code)
              await sendSmsAligo(env, member.phone, msg)
            }
          } catch { /* SMS 실패해도 승인은 유지 */ }
        }
      } else {
        const adminMemo = JSON.stringify({ title: body.reject_title ?? '', reason: body.reject_reason ?? '' })
        await conn.query(
          `UPDATE tb_member SET approval_status = '반려', admin_memo = ?, update_date = NOW() WHERE idx = ?`,
          [adminMemo, body.idx]
        )

        // 반려 SMS 발송
        if (member?.phone) {
          try {
            const [tplRows] = await conn.query<RowDataPacket[]>(
              `SELECT template_body FROM tb_sms_template WHERE template_key = 'reject' LIMIT 1`
            )
            const tplBody = (tplRows[0] as { template_body?: string } | undefined)?.template_body
            if (tplBody) {
              const msg = tplBody
                .replace(/\{name\}/g, member.name ?? '')
                .replace(/\{inst_name\}/g, member.inst_name ?? '')
                .replace(/\{reject_reason\}/g, body.reject_reason ?? '')
              await sendSmsAligo(env, member.phone, msg)
            }
          } catch { /* SMS 실패해도 반려는 유지 */ }
        }
      }
      return json({ ok: true })
    }

    // GET /api/admin/doctors?status=active|inactive|all&search=&page= — wowkiki 전체 의사 목록
    if (path === '/api/admin/doctors' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const status = url.searchParams.get('status') ?? 'all'
      const search = url.searchParams.get('search') ?? ''
      const page   = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit  = 20
      const offset = (page - 1) * limit

      let whereClause = `m.mtype = 'doctor' AND m.delete_yn = 'N'`
      if (status === 'inactive') whereClause = `m.mtype = 'doctor' AND m.delete_yn = 'Y'`
      else if (status === 'all') whereClause = `m.mtype = 'doctor'`

      const searchParams: string[] = []
      let searchClause = ''
      if (search) {
        searchClause = ` AND (m.name LIKE ? OR m.code LIKE ?)`
        const s = `%${search}%`
        searchParams.push(s, s)
      }

      const [[{ total }]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM tb_member m WHERE ${whereClause}${searchClause}`,
        searchParams
      ) as [RowDataPacket[], unknown]

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT m.idx, m.name, m.code, m.instt_code, m.regist_date,
                COALESCE(i.inst_name, m.instt_code) AS instt_name,
                (SELECT COUNT(*) FROM tb_member c WHERE c.mtype='child' AND c.doctor_code=m.code AND c.delete_yn='N') AS child_count
         FROM tb_member m
         LEFT JOIN tb_institution i ON i.code = m.instt_code
         WHERE ${whereClause}${searchClause}
         ORDER BY m.regist_date DESC
         LIMIT ? OFFSET ?`,
        [...searchParams, limit, offset]
      )
      return json({
        rows: (rows as RowDataPacket[]).map(r => ({
          idx:         r.idx,
          name:        r.name,
          code:        r.code ?? null,
          instt_name:  r.instt_name ?? r.instt_code,
          child_count: Number(r.child_count ?? 0),
          regist_date: fmtDate(r.regist_date) ?? '-',
        })),
        total: Number(total),
      })
    }

    // GET /api/admin/children-all?status=active|inactive|all&search=&page= — wowkiki 전체 아동 목록
    if (path === '/api/admin/children-all' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const status = url.searchParams.get('status') ?? 'active'
      const search = url.searchParams.get('search') ?? ''
      const page   = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit  = 20
      const offset = (page - 1) * limit

      let whereClause = `m.mtype = 'child' AND m.delete_yn = 'N'`
      if (status === 'inactive') whereClause = `m.mtype = 'child' AND m.delete_yn = 'Y'`
      else if (status === 'all') whereClause = `m.mtype = 'child'`

      const searchParams: string[] = []
      let searchClause = ''
      if (search) {
        searchClause = ` AND (m.name LIKE ? OR m.code LIKE ? OR m.id LIKE ?)`
        const s = `%${search}%`
        searchParams.push(s, s, s)
      }

      const [[{ total }]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM tb_member m WHERE ${whereClause}${searchClause}`,
        searchParams
      ) as [RowDataPacket[], unknown]

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT m.idx, m.id, m.code, m.name, m.birth_date, m.is_male_yn, m.instt_code, m.regist_date,
                COALESCE(i.inst_name, m.instt_code) AS instt_name,
                d.name AS doctor_name,
                t.name AS therapist_name,
                (SELECT DATE_FORMAT(MIN(start_date), '%Y.%m.%d') FROM tb_schedule WHERE child_id = m.id AND schedule_type = '1' AND start_date > NOW()) AS next_doctor_appt,
                (SELECT DATE_FORMAT(MIN(start_date), '%Y.%m.%d') FROM tb_schedule WHERE child_id = m.id AND schedule_type = '2' AND start_date > NOW()) AS next_therapy_appt
         FROM tb_member m
         LEFT JOIN tb_institution i ON i.code = m.instt_code
         LEFT JOIN tb_member d ON d.code = m.doctor_code AND d.mtype = 'doctor'
         LEFT JOIN tb_member t ON t.code = m.teacher_code AND t.mtype = 'healler'
         WHERE ${whereClause}${searchClause}
         ORDER BY m.regist_date DESC
         LIMIT ? OFFSET ?`,
        [...searchParams, limit, offset]
      )
      return json({
        rows: (rows as RowDataPacket[]).map(r => ({
          idx:               r.idx,
          code:              r.code ?? null,
          name:              r.name,
          age_label:         ageLabel(r.birth_date) ?? '-',
          birth_date:        fmtDate(r.birth_date) ?? '-',
          gender:            r.is_male_yn === 'Y' ? '남아' : r.is_male_yn === 'N' ? '여아' : '-',
          instt_name:        r.instt_name ?? r.instt_code,
          doctor_name:       r.doctor_name ?? '-',
          therapist_name:    r.therapist_name ?? '-',
          next_doctor_appt:  r.next_doctor_appt ?? '-',
          next_therapy_appt: r.next_therapy_appt ?? '-',
        })),
        total: Number(total),
      })
    }

    // GET /api/admin/therapists?status=active|inactive|all&search=&page=
    if (path === '/api/admin/therapists' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const status = url.searchParams.get('status') ?? 'all'
      const search = url.searchParams.get('search') ?? ''
      const page   = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit  = 20
      const offset = (page - 1) * limit

      let whereClause = `m.mtype = 'healler' AND m.delete_yn = 'N'`
      if (status === 'inactive') whereClause = `m.mtype = 'healler' AND m.delete_yn = 'Y'`
      else if (status === 'all') whereClause = `m.mtype = 'healler'`

      const searchParams: string[] = []
      let searchClause = ''
      if (search) {
        searchClause = ` AND (m.name LIKE ? OR m.code LIKE ? OR i.inst_name LIKE ?)`
        const s = `%${search}%`
        searchParams.push(s, s, s)
      }

      // child count subquery — healler_code 컬럼 없을 수도 있으므로 확인
      let childCountExpr = 'NULL'
      try {
        await conn.query(`SELECT healler_code FROM tb_member LIMIT 0`)
        childCountExpr = `(SELECT COUNT(*) FROM tb_member c WHERE c.mtype='child' AND c.healler_code=m.code AND c.delete_yn='N')`
      } catch { /* 컬럼 없음 */ }

      const [[{ total }]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM tb_member m LEFT JOIN tb_institution i ON i.code = m.instt_code WHERE ${whereClause}${searchClause}`,
        searchParams
      ) as [RowDataPacket[], unknown]

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT m.idx, m.name, m.code, m.instt_code, m.regist_date, m.approval_status,
                COALESCE(i.inst_name, m.instt_code) AS instt_name,
                ${childCountExpr} AS child_count
         FROM tb_member m
         LEFT JOIN tb_institution i ON i.code = m.instt_code
         WHERE ${whereClause}${searchClause}
         ORDER BY m.regist_date DESC
         LIMIT ? OFFSET ?`,
        [...searchParams, limit, offset]
      )
      return json({
        rows: (rows as RowDataPacket[]).map(r => ({
          idx:             r.idx,
          name:            r.name,
          code:            r.code ?? null,
          instt_code:      r.instt_code,
          instt_name:      r.instt_name ?? r.instt_code,
          child_count:     r.child_count !== null ? Number(r.child_count) : null,
          regist_date:     fmtDate(r.regist_date) ?? '-',
          approval_status: r.approval_status ?? null,
        })),
        total: Number(total),
      })
    }

    // POST /api/admin/therapists/approve — 치료사 일괄/단건 승인
    if (path === '/api/admin/therapists/approve' && method === 'POST') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const body = (await request.json().catch(() => ({}))) as { idxs?: number[] }
      if (!body.idxs || body.idxs.length === 0) return err(400, '필수 항목 누락')
      const [memberRows] = await conn.query<RowDataPacket[]>(
        `SELECT idx, name, phone FROM tb_member WHERE idx IN (${ph(body.idxs.length)}) AND mtype = 'healler' AND approval_status = '승인대기' AND delete_yn = 'N'`,
        body.idxs
      )
      if ((memberRows as RowDataPacket[]).length === 0) return json({ ok: true, approved: 0 })
      const approvedIdxs = (memberRows as RowDataPacket[]).map(r => (r as { idx: number }).idx)
      await conn.query(
        `UPDATE tb_member SET approval_status = NULL, update_date = NOW() WHERE idx IN (${ph(approvedIdxs.length)})`,
        approvedIdxs
      )
      // 승인 SMS
      for (const m of memberRows as RowDataPacket[]) {
        const member = m as { idx: number; name: string; phone: string | null }
        if (member.phone) {
          try {
            const [tplRows] = await conn.query<RowDataPacket[]>(
              `SELECT template_body FROM tb_sms_template WHERE template_key = 'approve' LIMIT 1`
            )
            const tplBody = (tplRows[0] as { template_body?: string } | undefined)?.template_body
            if (tplBody) {
              const msg = tplBody.replace(/\{name\}/g, member.name ?? '').replace(/\{inst_name\}/g, '').replace(/\{instt_code\}/g, '')
              await sendSmsAligo(env, member.phone, msg)
            }
          } catch { /* SMS 실패해도 승인 유지 */ }
        }
      }
      return json({ ok: true, approved: approvedIdxs.length })
    }

    // GET /api/admin/approval-history?memberIdx={idx} — 제출 이력 목록 (파일 데이터 제외)
    if (path === '/api/admin/approval-history' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const memberIdx = Number(url.searchParams.get('memberIdx') ?? 0)
      if (!memberIdx) return err(400, '필수 항목 누락')
      try {
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT idx, attempt_number, source_file_nm, submitted_at FROM tb_approval_history WHERE member_idx = ? ORDER BY attempt_number ASC`,
          [memberIdx]
        )
        return json((rows as RowDataPacket[]).map(r => ({
          idx:            r.idx,
          attempt_number: r.attempt_number,
          source_file_nm: r.source_file_nm ?? null,
          submitted_at:   fmtDateTime(r.submitted_at) ?? '-',
        })))
      } catch {
        return json([])
      }
    }

    // GET /api/admin/approval-file?historyIdx={idx} — 제출 파일 데이터 반환
    if (path === '/api/admin/approval-file' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const historyIdx = Number(url.searchParams.get('historyIdx') ?? 0)
      if (!historyIdx) return err(400, '필수 항목 누락')
      try {
        const [[row]] = await conn.query<RowDataPacket[]>(
          `SELECT source_file_nm, file_data FROM tb_approval_history WHERE idx = ? LIMIT 1`,
          [historyIdx]
        ) as [RowDataPacket[], unknown]
        if (!row || !row.file_data) return err(404, '파일을 찾을 수 없습니다.')
        return json({ source_file_nm: row.source_file_nm ?? null, file_data: row.file_data })
      } catch {
        return err(404, '파일을 찾을 수 없습니다.')
      }
    }

    // GET /api/admin/sms-templates
    if (path === '/api/admin/sms-templates' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT template_key, template_name, template_body FROM tb_sms_template ORDER BY idx`
      )
      return json({ templates: rows as RowDataPacket[] })
    }

    // PUT /api/admin/sms-template
    if (path === '/api/admin/sms-template' && method === 'PUT') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const body = (await request.json().catch(() => ({}))) as { template_key?: string; template_body?: string }
      if (!body.template_key || !body.template_body) return err(400, '필수 항목 누락')
      await conn.query(
        `UPDATE tb_sms_template SET template_body = ?, update_date = NOW() WHERE template_key = ?`,
        [body.template_body, body.template_key]
      )
      return json({ ok: true })
    }

    // GET /api/admin/institutions?status=pending|rejected|active|inactive
    if (path === '/api/admin/institutions' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const status = url.searchParams.get('status') ?? 'pending'
      let whereClause = ''
      if (status === 'pending')        whereClause = `approval_status = '승인대기'`
      else if (status === 'rejected')  whereClause = `approval_status = '반려'`
      else if (status === 'active')    whereClause = `approval_status IS NULL AND delete_yn = 'N'`
      else                             whereClause = `delete_yn = 'Y'`
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT m.idx, m.id, m.name, m.mtype, m.instt_code, m.regist_date, m.update_date, m.admin_memo,
                i.inst_name
         FROM tb_member m
         LEFT JOIN tb_institution i ON i.code = m.instt_code
         WHERE ${whereClause} AND m.mtype IN ('iadmin','healler')
         ORDER BY m.regist_date DESC`
      )
      const [[cnt]] = await conn.query<RowDataPacket[]>(
        `SELECT
           SUM(approval_status = '승인대기') AS pending,
           SUM(approval_status = '반려') AS rejected,
           SUM(approval_status IS NULL AND delete_yn = 'N') AS active,
           SUM(delete_yn = 'Y') AS inactive
         FROM tb_member WHERE mtype IN ('iadmin','healler')`
      ) as [RowDataPacket[], unknown]
      return json({
        rows: (rows as RowDataPacket[]).map(r => ({
          idx:           r.idx,
          id:            r.id,
          name:          r.name,
          inst_name:     r.inst_name ?? '',
          role:          r.mtype === 'healler' ? '치료사' : '기관관리자',
          instt_code:    r.instt_code,
          regist_date:   fmtDate(r.regist_date) ?? '-',
          rejected_date: fmtDate(r.update_date) ?? '-',
          rejected_reason: r.admin_memo ?? '-',
        })),
        counts: {
          pending:  Number(cnt?.pending  ?? 0),
          rejected: Number(cnt?.rejected ?? 0),
          active:   Number(cnt?.active   ?? 0),
          inactive: Number(cnt?.inactive ?? 0),
        }
      })
    }

    // GET /api/admin/institution-stats?instt_code={code} — 기관별 웹/앱 KPI
    if (path === '/api/admin/institution-stats' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const instt_code = url.searchParams.get('instt_code') ?? ''
      if (!instt_code) return err(400, '필수 항목 누락')
      const webMtypes = `'doctor','healler','iadmin'`
      const q = (mtypes: string, extra: string) => conn.query<RowDataPacket[]>(
        `SELECT
           SUM(regist_date >= DATE_FORMAT(NOW(),'%Y-%m-01')) AS mau,
           SUM(regist_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS wau,
           SUM(DATE(regist_date) = CURDATE()) AS dau
         FROM tb_member WHERE mtype IN (${mtypes}) AND delete_yn='N' AND instt_code=? ${extra}`,
        [instt_code]
      )
      const [[web]] = await q(webMtypes, '') as [RowDataPacket[], unknown]
      const [[app]] = await q(`'child'`, '') as [RowDataPacket[], unknown]
      return json({
        web: { mau: Number(web?.mau ?? 0), wau: Number(web?.wau ?? 0), dau: Number(web?.dau ?? 0) },
        app: { mau: Number(app?.mau ?? 0), wau: Number(app?.wau ?? 0), dau: Number(app?.dau ?? 0) },
      })
    }

    // GET /api/admin/stats-history?type=web|app&metric=dau|wau|mau&from=YYYY-MM-DD&to=YYYY-MM-DD
    if (path === '/api/admin/stats-history' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const type   = url.searchParams.get('type') ?? 'web'
      const metric = url.searchParams.get('metric') ?? 'dau'
      const from   = url.searchParams.get('from') ?? new Date(Date.now() - 90 * 864e5).toISOString().slice(0,10)
      const to     = url.searchParams.get('to')   ?? new Date().toISOString().slice(0,10)
      const mtypes = type === 'app' ? `'child'` : `'doctor','healler','iadmin'`
      let groupExpr = `DATE(regist_date)`
      let orderExpr = `DATE(regist_date) DESC`
      if (metric === 'wau') { groupExpr = `YEARWEEK(regist_date, 1)`; orderExpr = `YEARWEEK(regist_date, 1) DESC` }
      if (metric === 'mau') { groupExpr = `DATE_FORMAT(regist_date,'%Y-%m')`; orderExpr = `DATE_FORMAT(regist_date,'%Y-%m') DESC` }
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT ${groupExpr} AS period, COUNT(*) AS cnt
         FROM tb_member
         WHERE mtype IN (${mtypes}) AND delete_yn='N'
           AND DATE(regist_date) BETWEEN ? AND ?
         GROUP BY ${groupExpr}
         ORDER BY ${orderExpr}`,
        [from, to]
      )
      const periods = rows as Array<{ period: string; cnt: number }>
      const result = periods.map((r, i) => {
        const prev = periods[i + 1]?.cnt ?? r.cnt
        const change = r.cnt - prev
        return { period: String(r.period), count: r.cnt, change }
      })
      return json(result)
    }

    // GET /api/admin/stats-detail — 통계/로그용 MAU/WAU/DAU + 기관리스트
    if (path === '/api/admin/stats-detail' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const webMtypes = `'doctor','healler','iadmin'`
      const appMtype  = `'child'`
      const [[webMau]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_member WHERE mtype IN (${webMtypes}) AND delete_yn='N' AND regist_date >= DATE_FORMAT(NOW(),'%Y-%m-01')`
      ) as [RowDataPacket[], unknown]
      const [[webWau]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_member WHERE mtype IN (${webMtypes}) AND delete_yn='N' AND regist_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
      ) as [RowDataPacket[], unknown]
      const [[webDau]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_member WHERE mtype IN (${webMtypes}) AND delete_yn='N' AND DATE(regist_date) = CURDATE()`
      ) as [RowDataPacket[], unknown]
      const [[appMau]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_member WHERE mtype=${appMtype} AND delete_yn='N' AND regist_date >= DATE_FORMAT(NOW(),'%Y-%m-01')`
      ) as [RowDataPacket[], unknown]
      const [[appWau]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_member WHERE mtype=${appMtype} AND delete_yn='N' AND regist_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
      ) as [RowDataPacket[], unknown]
      const [[appDau]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_member WHERE mtype=${appMtype} AND delete_yn='N' AND DATE(regist_date) = CURDATE()`
      ) as [RowDataPacket[], unknown]
      const [instRows] = await conn.query<RowDataPacket[]>(
        `SELECT m.idx, m.instt_code, m.name AS contact_name, m.regist_date,
                COALESCE(i.instt_name, m.instt_code) AS instt_name,
                COALESCE(i.instt_type, '-') AS instt_type
         FROM tb_member m
         LEFT JOIN tb_institution i ON m.instt_code = i.instt_code
         WHERE m.mtype='iadmin' AND m.delete_yn='N' AND m.approval_status IS NULL
         ORDER BY m.regist_date DESC`
      ).catch(async () => {
        const [r] = await conn.query<RowDataPacket[]>(
          `SELECT idx, instt_code, name AS instt_name, '-' AS instt_type, regist_date
           FROM tb_member WHERE mtype='iadmin' AND delete_yn='N' AND approval_status IS NULL
           ORDER BY regist_date DESC`
        ); return r
      })
      return json({
        web: { mau: Number((webMau as {cnt:number}).cnt), wau: Number((webWau as {cnt:number}).cnt), dau: Number((webDau as {cnt:number}).cnt) },
        app: { mau: Number((appMau as {cnt:number}).cnt), wau: Number((appWau as {cnt:number}).cnt), dau: Number((appDau as {cnt:number}).cnt) },
        institutions: (instRows as RowDataPacket[]).map(r => ({
          idx:        r.idx,
          instt_code: r.instt_code,
          instt_name: r.instt_name,
          instt_type: r.instt_type,
          regist_date: fmtDate(r.regist_date) ?? '-',
        }))
      })
    }

    // GET /api/admin/institution-detail?idx={idx} — 기관 상세 정보
    if (path === '/api/admin/institution-detail' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const idx = Number(url.searchParams.get('idx') ?? 0)
      if (!idx) return err(400, '필수 항목 누락')
      const [[member]] = await conn.query<RowDataPacket[]>(
        `SELECT idx, id, name, email, phone, instt_code, regist_date FROM tb_member WHERE idx = ? AND mtype = 'iadmin' LIMIT 1`,
        [idx]
      ) as [RowDataPacket[], unknown]
      if (!member) return err(404, '기관을 찾을 수 없습니다.')
      // tb_institution 있으면 JOIN, 없으면 gracefully fallback
      let insttInfo: RowDataPacket | null = null
      try {
        const [[row]] = await conn.query<RowDataPacket[]>(
          `SELECT instt_name, instt_type, address FROM tb_institution WHERE instt_code = ? LIMIT 1`,
          [member.instt_code]
        ) as [RowDataPacket[], unknown]
        insttInfo = row ?? null
      } catch { /* tb_institution 없음 */ }
      // 사업자 등록증
      let certFileNm: string | null = null
      try {
        const [[cert]] = await conn.query<RowDataPacket[]>(
          `SELECT file_nm FROM tb_license_file WHERE member_idx = ? ORDER BY idx DESC LIMIT 1`,
          [idx]
        ) as [RowDataPacket[], unknown]
        certFileNm = cert?.file_nm ?? null
      } catch { /* tb_license_file 없음 */ }
      return json({
        idx:          member.idx,
        id:           member.id,
        instt_code:   member.instt_code,
        instt_name:   insttInfo?.instt_name ?? null,
        instt_type:   insttInfo?.instt_type ?? null,
        address:      insttInfo?.address ?? null,
        contact_name:  member.name,
        contact_email: member.email ?? null,
        contact_phone: member.phone ?? null,
        cert_file_nm:  certFileNm,
        regist_date:   fmtDate(member.regist_date) ?? '-',
      })
    }

    // GET /api/admin/institution-members?instt_code={code}&role=child|doctor|therapist&status=active|inactive|all
    if (path === '/api/admin/institution-members' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const instt_code = url.searchParams.get('instt_code') ?? ''
      const role       = url.searchParams.get('role') ?? 'child'
      const status     = url.searchParams.get('status') ?? 'all'
      if (!instt_code) return err(400, '필수 항목 누락')
      const mtypes = role === 'doctor' ? ['doctor'] : role === 'therapist' ? ['healler'] : ['child']
      let statusClause = ''
      if (status === 'active')   statusClause = `AND delete_yn = 'N'`
      else if (status === 'inactive') statusClause = `AND delete_yn = 'Y'`
      const isStaff = role === 'doctor' || role === 'therapist'
      const childCodeCol = role === 'doctor' ? 'doctor_code' : 'healler_code'
      let childCountExpr = `NULL`
      if (isStaff) {
        try {
          // verify column exists before embedding in query
          await conn.query(`SELECT ${childCodeCol} FROM tb_member LIMIT 0`)
          childCountExpr = `(SELECT COUNT(*) FROM tb_member c WHERE c.mtype='child' AND c.${childCodeCol}=m.code AND c.delete_yn='N')`
        } catch { /* column doesn't exist */ }
      }
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT m.idx, m.id, m.code, m.name, m.birth_date, m.is_male_yn, m.regist_date,
                ${childCountExpr} AS child_count
         FROM tb_member m
         WHERE m.instt_code = ? AND m.mtype IN (${ph(mtypes.length)}) ${statusClause}
         ORDER BY m.regist_date DESC`,
        [instt_code, ...mtypes]
      )
      return json((rows as RowDataPacket[]).map(r => ({
        idx:         r.idx,
        id:          r.id,
        code:        r.code ?? null,
        name:        r.name,
        birth_date:  fmtDate(r.birth_date) ?? null,
        is_male:     r.is_male_yn === 'Y',
        regist_date: fmtDate(r.regist_date) ?? '-',
        child_count: r.child_count !== null ? Number(r.child_count) : undefined,
      })))
    }

    // POST /api/admin/institutions/deactivate — 기관 비활성화 (선택한 idx 목록)
    if (path === '/api/admin/institutions/deactivate' && method === 'POST') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const body = (await request.json().catch(() => ({}))) as { idxs?: number[] }
      if (!body.idxs || body.idxs.length === 0) return err(400, '필수 항목 누락')
      await conn.query(
        `UPDATE tb_member SET delete_yn = 'Y', update_date = NOW() WHERE idx IN (${ph(body.idxs.length)})`,
        body.idxs
      )
      return json({ ok: true })
    }

    // GET /api/admin/staff-stats?member_idx={idx} — 의사/치료사 웹 KPI + 커스텀 횟수
    if (path === '/api/admin/staff-stats' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const member_idx = Number(url.searchParams.get('member_idx') ?? 0)
      if (!member_idx) return err(400, '필수 항목 누락')
      let web = { mau: 0, wau: 0, dau: 0, mau_change: 0, wau_change: 0, dau_change: 0 }
      let custom = { monthly: 0, weekly: 0, daily: 0, m_change: 0, w_change: 0, d_change: 0 }
      try {
        const [[r]] = await conn.query<RowDataPacket[]>(
          `SELECT
             SUM(login_date >= DATE_FORMAT(NOW(),'%Y-%m-01')) AS mau,
             SUM(login_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS wau,
             SUM(DATE(login_date) = CURDATE()) AS dau,
             SUM(login_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH),'%Y-%m-01')
               AND login_date < DATE_FORMAT(NOW(),'%Y-%m-01')) AS prev_mau,
             SUM(login_date >= DATE_SUB(NOW(), INTERVAL 14 DAY)
               AND login_date < DATE_SUB(NOW(), INTERVAL 7 DAY)) AS prev_wau,
             SUM(DATE(login_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)) AS prev_dau
           FROM tb_login_log WHERE member_idx = ?`,
          [member_idx]
        ) as [RowDataPacket[], unknown]
        const mau = Number(r?.mau ?? 0), wau = Number(r?.wau ?? 0), dau = Number(r?.dau ?? 0)
        web = {
          mau, wau, dau,
          mau_change: mau - Number(r?.prev_mau ?? 0),
          wau_change: wau - Number(r?.prev_wau ?? 0),
          dau_change: dau - Number(r?.prev_dau ?? 0),
        }
      } catch { /* tb_login_log 없음 */ }
      try {
        const [[c]] = await conn.query<RowDataPacket[]>(
          `SELECT
             SUM(activity_date >= DATE_FORMAT(NOW(),'%Y-%m-01')) AS monthly,
             SUM(activity_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS weekly,
             SUM(DATE(activity_date) = CURDATE()) AS daily,
             SUM(activity_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH),'%Y-%m-01')
               AND activity_date < DATE_FORMAT(NOW(),'%Y-%m-01')) AS prev_m,
             SUM(activity_date >= DATE_SUB(NOW(), INTERVAL 14 DAY)
               AND activity_date < DATE_SUB(NOW(), INTERVAL 7 DAY)) AS prev_w,
             SUM(DATE(activity_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)) AS prev_d
           FROM tb_custom_log WHERE member_idx = ?`,
          [member_idx]
        ) as [RowDataPacket[], unknown]
        const monthly = Number(c?.monthly ?? 0), weekly = Number(c?.weekly ?? 0), daily = Number(c?.daily ?? 0)
        custom = {
          monthly, weekly, daily,
          m_change: monthly - Number(c?.prev_m ?? 0),
          w_change: weekly  - Number(c?.prev_w ?? 0),
          d_change: daily   - Number(c?.prev_d ?? 0),
        }
      } catch { /* tb_custom_log 없음 */ }
      return json({ web, custom })
    }

    // GET /api/admin/staff-custom-history?member_idx={idx}&page=1&limit=20
    if (path === '/api/admin/staff-custom-history' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const member_idx = Number(url.searchParams.get('member_idx') ?? 0)
      const page  = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 20))
      if (!member_idx) return err(400, '필수 항목 누락')
      let items: unknown[] = [], total = 0
      try {
        const [[cnt]] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM tb_custom_log WHERE member_idx = ?`, [member_idx]
        ) as [RowDataPacket[], unknown]
        total = Number(cnt?.cnt ?? 0)
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT cl.idx, cl.activity_date, cl.status,
                  CONCAT(c.name, '(', COALESCE(c.code, '-'), ')') AS child_name_code
           FROM tb_custom_log cl
           LEFT JOIN tb_member c ON c.idx = cl.child_idx AND c.mtype = 'child'
           WHERE cl.member_idx = ? ORDER BY cl.activity_date DESC LIMIT ? OFFSET ?`,
          [member_idx, limit, (page - 1) * limit]
        )
        items = (rows as RowDataPacket[]).map(r => ({
          log_idx:         Number(r.idx),
          activity_dt:     fmtDateTime(r.activity_date) ?? '-',
          child_name_code: r.child_name_code ?? '-',
          status:          r.status ?? '-',
        }))
      } catch { /* tb_custom_log 없음 */ }
      return json({ items, total })
    }

    // GET /api/admin/custom-detail?log_idx={idx}
    if (path === '/api/admin/custom-detail' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const log_idx = Number(url.searchParams.get('log_idx') ?? 0)
      if (!log_idx) return err(400, '필수 항목 누락')
      let detail: Record<string, string | null> = {}
      try {
        const [[row]] = await conn.query<RowDataPacket[]>(
          `SELECT target_position, target_articulation, core_syllable,
                  word_age, age_consonant, can_read_korean, word_length, game_count
           FROM tb_custom_log WHERE idx = ?`,
          [log_idx]
        ) as [RowDataPacket[], unknown]
        if (row) {
          detail = {
            target_position:     row.target_position     ?? null,
            target_articulation: row.target_articulation ?? null,
            core_syllable:       row.core_syllable        ?? null,
            word_age:            row.word_age             ?? null,
            age_consonant:       row.age_consonant        ?? null,
            can_read:            row.can_read_korean      ?? null,
            word_length:         row.word_length          ?? null,
            game_count:          row.game_count != null ? String(row.game_count) + '회' : null,
          }
        }
      } catch { /* tb_custom_log 컬럼 없음 */ }
      return json(detail)
    }

    // GET /api/admin/staff-task-history?member_idx={idx}&page=1&limit=20
    if (path === '/api/admin/staff-task-history' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const member_idx = Number(url.searchParams.get('member_idx') ?? 0)
      const page  = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 20))
      if (!member_idx) return err(400, '필수 항목 누락')
      let items: unknown[] = [], total = 0
      try {
        const [[cnt]] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM tb_task_log WHERE member_idx = ?`, [member_idx]
        ) as [RowDataPacket[], unknown]
        total = Number(cnt?.cnt ?? 0)
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT tl.task_date, tl.task_content,
                  CONCAT(c.name, '(', COALESCE(c.code, '-'), ')') AS child_name_code
           FROM tb_task_log tl
           LEFT JOIN tb_member c ON c.idx = tl.child_idx AND c.mtype = 'child'
           WHERE tl.member_idx = ? ORDER BY tl.task_date DESC LIMIT ? OFFSET ?`,
          [member_idx, limit, (page - 1) * limit]
        )
        items = (rows as RowDataPacket[]).map(r => ({
          task_dt:         fmtDateTime(r.task_date) ?? '-',
          task_content:    r.task_content ?? '-',
          child_name_code: r.child_name_code ?? '-',
        }))
      } catch { /* tb_task_log 없음 */ }
      return json({ items, total })
    }

    // GET /api/admin/child-stats?member_idx={idx} — 아동 앱 MAU/WAU/DAU
    if (path === '/api/admin/child-stats' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const member_idx = Number(url.searchParams.get('member_idx') ?? 0)
      if (!member_idx) return err(400, '필수 항목 누락')
      let mau = 0, wau = 0, dau = 0, mau_change = 0, wau_change = 0, dau_change = 0
      try {
        const [[r]] = await conn.query<RowDataPacket[]>(
          `SELECT
             SUM(login_date >= DATE_FORMAT(NOW(),'%Y-%m-01')) AS mau,
             SUM(login_date >= DATE_SUB(NOW(), INTERVAL 7 DAY)) AS wau,
             SUM(DATE(login_date) = CURDATE()) AS dau,
             SUM(login_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH),'%Y-%m-01')
               AND login_date < DATE_FORMAT(NOW(),'%Y-%m-01')) AS prev_mau,
             SUM(login_date >= DATE_SUB(NOW(), INTERVAL 14 DAY)
               AND login_date < DATE_SUB(NOW(), INTERVAL 7 DAY)) AS prev_wau,
             SUM(DATE(login_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)) AS prev_dau
           FROM tb_login_log WHERE member_idx = ?`,
          [member_idx]
        ) as [RowDataPacket[], unknown]
        mau = Number(r?.mau ?? 0); wau = Number(r?.wau ?? 0); dau = Number(r?.dau ?? 0)
        mau_change = mau - Number(r?.prev_mau ?? 0)
        wau_change = wau - Number(r?.prev_wau ?? 0)
        dau_change = dau - Number(r?.prev_dau ?? 0)
      } catch { /* tb_login_log 없음 */ }
      return json({ mau, wau, dau, mau_change, wau_change, dau_change })
    }

    // GET /api/admin/child-login-history?member_idx={idx}&page=1&limit=20
    if (path === '/api/admin/child-login-history' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const member_idx = Number(url.searchParams.get('member_idx') ?? 0)
      const page  = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 20))
      if (!member_idx) return err(400, '필수 항목 누락')
      let items: unknown[] = [], total = 0
      try {
        const [[cnt]] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM tb_login_log WHERE member_idx = ?`, [member_idx]
        ) as [RowDataPacket[], unknown]
        total = Number(cnt?.cnt ?? 0)
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT login_date, ip_addr, access_env FROM tb_login_log
           WHERE member_idx = ? ORDER BY login_date DESC LIMIT ? OFFSET ?`,
          [member_idx, limit, (page - 1) * limit]
        )
        items = (rows as RowDataPacket[]).map(r => ({
          login_dt: fmtDateTime(r.login_date) ?? '-',
          ip:       r.ip_addr ?? '-',
          env:      r.access_env ?? 'APP',
        }))
      } catch { /* tb_login_log 없음 */ }
      return json({ items, total })
    }

    // GET /api/admin/child-content-history?member_idx={idx}&page=1&limit=20
    if (path === '/api/admin/child-content-history' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const member_idx = Number(url.searchParams.get('member_idx') ?? 0)
      const page  = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 20))
      if (!member_idx) return err(400, '필수 항목 누락')
      let items: unknown[] = [], total = 0
      try {
        const [[cnt]] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM tb_activity_log WHERE member_idx = ?`, [member_idx]
        ) as [RowDataPacket[], unknown]
        total = Number(cnt?.cnt ?? 0)
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT activity_date, activity_name, duration_min FROM tb_activity_log
           WHERE member_idx = ? ORDER BY activity_date DESC LIMIT ? OFFSET ?`,
          [member_idx, limit, (page - 1) * limit]
        )
        items = (rows as RowDataPacket[]).map(r => ({
          activity_dt:   fmtDateTime(r.activity_date) ?? '-',
          activity_name: r.activity_name ?? '-',
          duration_min:  Number(r.duration_min ?? 0),
        }))
      } catch { /* tb_activity_log 없음 */ }
      return json({ items, total })
    }

    // GET /api/me
    if (path === '/api/me' && method === 'GET') {
      const base = {
        id:              user.id,
        code:            user.code ?? null,
        name:            user.name,
        role:            mtypeToRole(user.mtype),
        institutionCode: user.instt_code,
        department:      user.depart_code ?? null,
        schedule:        null,
      }
      if (user.approval_status === '승인대기') {
        return json({ ...base, approvalStatus: 'pending' })
      }
      if (user.approval_status === '반려') {
        let rejectTitle = '', rejectReason = ''
        try {
          const m = JSON.parse((user as StaffRow & { admin_memo?: string }).admin_memo ?? '{}')
          rejectTitle = m.title ?? ''
          rejectReason = m.reason ?? ''
        } catch {}
        return json({ ...base, approvalStatus: 'rejected', rejectTitle, rejectReason })
      }
      return json(base)
    }

    // GET /api/dashboard (의사/치료사용)
    if (path === '/api/dashboard' && method === 'GET') {
      const staffCode = user.code || user.id
      let codeWhere = ''
      const codeArgs: unknown[] = []
      if (user.mtype === 'doctor') {
        codeWhere = 'AND c.doctor_code = ?'
        codeArgs.push(staffCode)
      } else if (user.mtype === 'healler') {
        codeWhere = 'AND c.teacher_code = ?'
        codeArgs.push(staffCode)
      }

      const [childRows] = await conn.query<RowDataPacket[]>(
        `SELECT
           c.idx          AS id,
           c.id           AS identifier,
           c.name,
           c.birth_date,
           c.regist_date,
           (SELECT r.analysislog
            FROM tb_childact_report r
            WHERE r.id = c.id AND r.use_type = 'training'
              AND DATE(r.act_date) = CURDATE()
            ORDER BY r.idx DESC LIMIT 1)              AS today_log,
           (SELECT r.analysislog
            FROM tb_childact_report r
            WHERE r.id = c.id AND r.use_type = 'training'
            ORDER BY r.act_date DESC, r.idx DESC LIMIT 1) AS latest_log,
           (SELECT DATEDIFF(CURDATE(), DATE(r.act_date))
            FROM tb_childact_report r
            WHERE r.id = c.id AND r.use_type = 'training'
            ORDER BY r.act_date DESC, r.idx DESC LIMIT 1) AS days_since_trained
         FROM tb_member c
         WHERE c.mtype = 'child' AND c.delete_yn = 'N' AND c.instt_code = ?
           ${codeWhere}
         ORDER BY c.idx`,
        [user.instt_code, ...codeArgs]
      )
      type DRow = RowDataPacket & { id: number; identifier: string; name: string; birth_date: unknown; regist_date: unknown; today_log: string|null; latest_log: string|null; days_since_trained: number|null }

      const thisMonth = new Date(); const lastMonth = new Date()
      lastMonth.setMonth(lastMonth.getMonth() - 1)

      let trainedToday = 0, trainedYesterday = 0, totalAccuracy = 0, accuracyCount = 0, noCustom = 0
      let newThisMonth = 0, newLastMonth = 0

      const [yesterdayRows] = await conn.query<RowDataPacket[]>(
        `SELECT DISTINCT id FROM tb_childact_report
         WHERE use_type = 'training' AND DATE(act_date) = CURDATE() - INTERVAL 1 DAY
           AND id IN (SELECT id FROM tb_member WHERE mtype='child' AND delete_yn='N' AND instt_code=? ${codeWhere.replace('c.doctor_code','doctor_code').replace('c.teacher_code','teacher_code')})`,
        [user.instt_code, ...codeArgs]
      )
      trainedYesterday = (yesterdayRows as RowDataPacket[]).length

      const children = (childRows as DRow[]).map(r => {
        const todayP  = parseAnalysislog(r.today_log)
        const latestP = parseAnalysislog(r.latest_log)
        const todayAcc = todayP.accuracy_pct
        const hasTrainedToday = r.today_log != null

        if (hasTrainedToday) trainedToday++
        if (todayAcc != null) { totalAccuracy += todayAcc; accuracyCount++ }
        if (!latestP.trained_sound) noCustom++

        const rd = r.regist_date instanceof Date ? r.regist_date : r.regist_date ? new Date(r.regist_date as string) : null
        if (rd) {
          if (rd.getFullYear() === thisMonth.getFullYear() && rd.getMonth() === thisMonth.getMonth()) newThisMonth++
          if (rd.getFullYear() === lastMonth.getFullYear() && rd.getMonth() === lastMonth.getMonth()) newLastMonth++
        }

        return {
          id:                r.id,
          identifier:        r.identifier,
          name:              r.name,
          birth_date:        fmtDate(r.birth_date),
          age_label:         ageLabel(r.birth_date),
          today_accuracy:    todayAcc,
          current_sound:     latestP.trained_sound ?? null,
          days_since_trained: r.days_since_trained ?? null,
        }
      })

      return json({
        stats: {
          total_children:      children.length,
          total_delta:         newThisMonth - newLastMonth,
          trained_today:       trainedToday,
          trained_today_delta: trainedToday - trainedYesterday,
          avg_accuracy:        accuracyCount > 0 ? Math.round(totalAccuracy / accuracyCount) : null,
          no_custom:           noCustom,
        },
        children,
      })
    }

    // GET /api/children/assigned
    if (path === '/api/children/assigned' && method === 'GET') {
      // 의사·치료사는 본인 배정 아동만, admin 은 기관 전체
      const staffCode = user.code || user.id
      let codeWhere = ''
      const codeArgs: unknown[] = []
      if (user.mtype === 'doctor') {
        codeWhere = 'AND c.doctor_code = ?'
        codeArgs.push(staffCode)
      } else if (user.mtype === 'healler') {
        codeWhere = 'AND c.teacher_code = ?'
        codeArgs.push(staffCode)
      }

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT
           c.idx          AS id,
           c.id           AS identifier,
           c.name         AS child_name,
           c.birth_date,
           c.is_male_yn,
           c.doctor_code,
           c.teacher_code,
           d.name         AS doctor_name,
           t.name         AS therapist_name,
           (SELECT DATE_FORMAT(s.start_date, '%Y.%m.%d')
            FROM tb_schedule s
            WHERE s.child_id = c.id AND s.schedule_type = '1' AND s.start_date > NOW()
            ORDER BY s.start_date LIMIT 1) AS next_doctor_appointment,
           (SELECT DATE_FORMAT(s.start_date, '%Y.%m.%d')
            FROM tb_schedule s
            WHERE s.child_id = c.id AND s.schedule_type = '2' AND s.start_date > NOW()
            ORDER BY s.start_date LIMIT 1) AS next_therapy_appointment
         FROM tb_member c
         LEFT JOIN tb_member d
           ON d.code = c.doctor_code AND d.mtype = 'doctor' AND d.delete_yn = 'N'
         LEFT JOIN tb_member t
           ON t.code = c.teacher_code AND t.mtype = 'healler' AND t.delete_yn = 'N'
         WHERE c.mtype = 'child'
           AND c.delete_yn = 'N'
           AND c.instt_code = ?
           ${codeWhere}
         ORDER BY c.idx`,
        [user.instt_code, ...codeArgs]
      )
      type AssignedRow = RowDataPacket & {
        id: number; identifier: string; child_name: string | null
        birth_date: unknown; is_male_yn: string | null
        doctor_code: string | null; teacher_code: string | null
        doctor_name: string | null; therapist_name: string | null
        next_doctor_appointment: string | null; next_therapy_appointment: string | null
      }
      return json((rows as AssignedRow[]).map(r => ({
        id: r.id,
        identifier: r.identifier,
        child_name: r.child_name,
        birth_date: fmtDate(r.birth_date),
        age_label: ageLabel(r.birth_date),
        gender: r.is_male_yn === 'Y' ? '남아' : r.is_male_yn === 'N' ? '여아' : null,
        app_login_id: r.identifier,
        doctor_code: r.doctor_code,
        teacher_code: r.teacher_code,
        doctor_name: r.doctor_name,
        therapist_name: r.therapist_name,
        next_doctor_appointment: r.next_doctor_appointment,
        next_therapy_appointment: r.next_therapy_appointment,
      })))
    }

    // GET /api/children/unassigned
    if (path === '/api/children/unassigned' && method === 'GET') {
      // 역할별로 "미배정" 기준을 다르게 적용해 배정 목록과 겹치지 않게 함
      // - 의사: doctor_code 가 없는 아동 (치료사 배정 여부 무관)
      // - 치료사: teacher_code 가 없는 아동
      // - 관리자: doctor_code AND teacher_code 모두 없는 아동
      let unassignedWhere: string
      if (user.mtype === 'doctor') {
        unassignedWhere = `AND (c.doctor_code IS NULL OR c.doctor_code = '')`
      } else if (user.mtype === 'healler') {
        unassignedWhere = `AND (c.teacher_code IS NULL OR c.teacher_code = '')`
      } else {
        unassignedWhere = `AND (c.doctor_code IS NULL OR c.doctor_code = '')
           AND (c.teacher_code IS NULL OR c.teacher_code = '')`
      }

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT
           c.idx        AS id,
           c.name,
           c.birth_date,
           c.id         AS app_login_id
         FROM tb_member c
         WHERE c.mtype = 'child'
           AND c.delete_yn = 'N'
           AND c.instt_code = ?
           ${unassignedWhere}
         ORDER BY c.idx`,
        [user.instt_code]
      )
      return json(
        (rows as Array<RowDataPacket & { birth_date: unknown }>).map(r => ({
          id:          r['id'],
          name:        r['name'],
          age_label:   ageLabel(r.birth_date),
          app_login_id: r['app_login_id']
        }))
      )
    }

    // POST /api/children/assign-to-me
    if (path === '/api/children/assign-to-me' && method === 'POST') {
      const isDoctor  = user.mtype === 'doctor'
      const isHealler = user.mtype === 'healler'
      if (!isDoctor && !isHealler) return err(403, '의사 또는 치료사만 배정할 수 있습니다.')
      const body = (await request.json().catch(() => ({}))) as { ids?: number[] }
      const ids  = body.ids ?? []
      if (!ids.length) return json({ moved: 0 })

      const staffCode  = user.code || user.id
      const codeCol    = isDoctor ? 'doctor_code' : 'teacher_code'
      const [result] = await conn.query<ResultSetHeader>(
        `UPDATE tb_member
         SET ${codeCol} = ?, update_date = NOW()
         WHERE idx IN (${ph(ids.length)})
           AND mtype = 'child'
           AND instt_code = ?
           AND (${codeCol} IS NULL OR ${codeCol} = '')`,
        [staffCode, ...ids, user.instt_code]
      )
      return json({ moved: result.affectedRows })
    }

    // GET /api/children/custom-list
    if (path === '/api/children/custom-list' && method === 'GET') {
      const staffCode = user.code || user.id
      let codeWhere = ''
      const codeArgs: unknown[] = []
      if (user.mtype === 'doctor') {
        codeWhere = 'AND c.doctor_code = ?'
        codeArgs.push(staffCode)
      } else if (user.mtype === 'healler') {
        codeWhere = 'AND c.teacher_code = ?'
        codeArgs.push(staffCode)
      }

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT
           c.idx         AS id,
           c.id          AS identifier,
           c.name,
           c.birth_date,
           c.is_male_yn,
           t.name AS therapist_name,
           (SELECT r.analysislog
            FROM tb_childact_report r
            WHERE r.id = c.id AND r.use_type = 'training'
            ORDER BY r.act_date DESC, r.idx DESC LIMIT 1) AS latest_training_log,
           (SELECT DATE_FORMAT(r.act_date, '%Y.%m.%d')
            FROM tb_childact_report r
            WHERE r.id = c.id AND r.use_type = 'diagnostic'
            ORDER BY r.act_date DESC, r.idx DESC LIMIT 1) AS last_diagnosis
         FROM tb_member c
         LEFT JOIN tb_member t
           ON t.code = c.teacher_code AND t.mtype = 'healler' AND t.delete_yn = 'N'
         WHERE c.mtype = 'child'
           AND c.delete_yn = 'N'
           AND c.instt_code = ?
           ${codeWhere}
         ORDER BY c.idx`,
        [user.instt_code, ...codeArgs]
      )
      type CRow = RowDataPacket & { id: number; identifier: string; name: string | null; birth_date: unknown; is_male_yn: string | null; therapist_name: string | null; latest_training_log: string | null; last_diagnosis: string | null }
      return json((rows as CRow[]).map(r => {
        const p = parseAnalysislog(r.latest_training_log)
        return {
          id:             r.id,
          identifier:     r.identifier,
          name:           r.name ?? null,
          birth_date:     fmtDate(r.birth_date),
          age_label:      ageLabel(r.birth_date),
          gender:         r.is_male_yn === 'Y' ? '남아' : r.is_male_yn === 'N' ? '여아' : null,
          therapist_name: r.therapist_name ?? null,
          current_sound:  p.summary,
          upcoming_sound: null,
          last_diagnosis: r.last_diagnosis
        }
      }))
    }

    // GET /api/children/:id/custom
    const customDetailMatch = path.match(/^\/api\/children\/(\d+)\/custom$/)
    if (customDetailMatch && method === 'GET') {
      const cid = Number(customDetailMatch[1])

      const [childRows] = await conn.query<RowDataPacket[]>(
        `SELECT
           c.idx AS id, c.id AS child_member_id,
           c.name, c.birth_date, c.is_male_yn,
           t.name AS therapist_name,
           d.name AS doctor_name
         FROM tb_member c
         LEFT JOIN tb_member t ON t.code = c.teacher_code AND t.mtype = 'healler' AND t.delete_yn = 'N'
         LEFT JOIN tb_member d ON d.code = c.doctor_code AND d.mtype = 'doctor' AND d.delete_yn = 'N'
         WHERE c.idx = ? AND c.mtype = 'child' AND c.instt_code = ?
         LIMIT 1`,
        [cid, user.instt_code]
      )
      if (!childRows[0]) return err(404, 'not found')
      const child = childRows[0] as { id: number; child_member_id: string; name: string | null; birth_date: unknown; is_male_yn: string | null; therapist_name: string | null; doctor_name: string | null }

      const [trainRows] = await conn.query<RowDataPacket[]>(
        `SELECT idx, act_date, analysislog
         FROM tb_childact_report
         WHERE id = ? AND use_type = 'training'
         ORDER BY act_date DESC, idx DESC LIMIT 1`,
        [child.child_member_id]
      )
      type TRow = RowDataPacket & { act_date: unknown; analysislog: string | null }
      const train = trainRows[0] as TRow | undefined
      const tp = train ? parseAnalysislog(train.analysislog) : null

      const [diagLogRows] = await conn.query<RowDataPacket[]>(
        `SELECT analysislog
         FROM tb_childact_report
         WHERE id = ? AND use_type = 'diagnostic'
         ORDER BY act_date DESC, idx DESC LIMIT 1`,
        [child.child_member_id]
      )
      const rawDiag = (diagLogRows[0] as { analysislog: string | null } | undefined)?.analysislog
      const diagReport: { pos: string; phoneme: string; type: string }[] = []
      if (rawDiag) {
        try {
          const log = JSON.parse(rawDiag) as { mispronunciations?: MispronEntry[] }
          const seen = new Set<string>()
          for (const m of log.mispronunciations ?? []) {
            for (const e of m.e_list ?? []) {
              if (!e.aim_joum || !e.e_ctgr) continue
              const key = `${e.pos}|${e.aim_joum}|${e.e_ctgr}`
              if (seen.has(key)) continue
              seen.add(key)
              diagReport.push({ pos: POS_LABEL[e.pos] ?? e.pos, phoneme: e.aim_joum, type: e.e_ctgr })
            }
          }
        } catch { /* analysislog parse 실패 무시 */ }
      }

      const [schedRows] = await conn.query<RowDataPacket[]>(
        `SELECT DAYOFWEEK(start_date) AS dow
         FROM tb_schedule
         WHERE child_id = ? AND schedule_type = '2'
           AND start_date > DATE_SUB(NOW(), INTERVAL 60 DAY)
         GROUP BY DAYOFWEEK(start_date)
         ORDER BY DAYOFWEEK(start_date)`,
        [child.child_member_id]
      )
      const DOW: Record<number, string> = { 1:'일',2:'월',3:'화',4:'수',5:'목',6:'금',7:'토' }
      const schedule = (schedRows as Array<{ dow: number }>).map(r => DOW[r.dow]).filter(Boolean)

      return json({
        id:             child.id,
        identifier:     child.child_member_id,
        name:           child.name ?? null,
        age_label:      ageLabel(child.birth_date),
        gender:         child.is_male_yn === 'Y' ? '남아' : child.is_male_yn === 'N' ? '여아' : null,
        therapist_name: child.therapist_name,
        doctor_name:    child.doctor_name,
        schedule,
        current: tp?.summary ? {
          sound: tp.summary,
          by:    child.doctor_name,
          at:    fmtDate(train?.act_date)
        } : null,
        reserved:    null,
        diagnosis_rows: diagReport
      })
    }

    // GET /api/children/:id
    const childIdMatch = path.match(/^\/api\/children\/(\d+)$/)
    if (childIdMatch && method === 'GET') {
      const cid = Number(childIdMatch[1])
      const [childRows] = await conn.query<RowDataPacket[]>(
        `SELECT
           c.idx                  AS id,
           c.id                   AS identifier,
           c.name,
           c.birth_date,
           c.id                   AS app_login_id,
           c.attribution          AS primary_diagnosis,
           c.regist_date          AS service_started_at,
           c.admin_memo,
           c.doctor_memo,
           c.teacher_memo,
           c.update_date,
           d.code                 AS doctor_id,
           d.name                 AS doctor_name,
           d.depart_code          AS doctor_department,
           t.code                 AS therapist_id,
           t.name                 AS therapist_name,
           t.depart_code          AS therapist_department,
           (SELECT DATE_FORMAT(s.start_date, '%Y.%m.%d')
            FROM tb_schedule s
            WHERE s.child_id = c.id AND s.schedule_type = '1' AND s.start_date > NOW()
            ORDER BY s.start_date LIMIT 1) AS next_doctor_appointment,
           (SELECT DATE_FORMAT(s.start_date, '%Y.%m.%d')
            FROM tb_schedule s
            WHERE s.child_id = c.id AND s.schedule_type = '2' AND s.start_date > NOW()
            ORDER BY s.start_date LIMIT 1) AS next_therapy_appointment
         FROM tb_member c
         LEFT JOIN tb_member d
           ON d.code = c.doctor_code AND d.mtype = 'doctor' AND d.delete_yn = 'N'
         LEFT JOIN tb_member t
           ON t.code = c.teacher_code AND t.mtype = 'healler' AND t.delete_yn = 'N'
         WHERE c.idx = ? AND c.mtype = 'child' AND c.instt_code = ?
         LIMIT 1`,
        [cid, user.instt_code]
      )
      type ChildR = RowDataPacket & {
        birth_date: unknown; service_started_at: unknown; update_date: unknown
        admin_memo: string|null; doctor_memo: string|null; teacher_memo: string|null
      }
      const child = childRows[0] as ChildR | undefined
      if (!child) return err(404, 'not found')

      const updatedAt = fmtDate(child.update_date) ?? '-'
      const { admin_memo, doctor_memo, teacher_memo, update_date, birth_date, service_started_at, ...rest } = child

      return json({
        child: {
          ...rest,
          birth_date:       fmtDate(birth_date),
          age_label:        ageLabel(birth_date),
          service_started_at: fmtDate(service_started_at),
          therapist_schedule: null
        },
        memos: [
          { type: 'admin',     content: admin_memo    ?? '', updated_at: updatedAt },
          { type: 'doctor',    content: doctor_memo   ?? '', updated_at: updatedAt },
          { type: 'therapist', content: teacher_memo  ?? '', updated_at: updatedAt }
        ]
      })
    }

    // PUT /api/children/:id/primary-diagnosis  (doctor only)
    const diagUpdateMatch = path.match(/^\/api\/children\/(\d+)\/primary-diagnosis$/)
    if (diagUpdateMatch && method === 'PUT') {
      if (user.mtype !== 'doctor') return err(403, 'doctor only')
      const cid = Number(diagUpdateMatch[1])
      if (!(await ownsChild(conn, cid, user))) return err(403, 'forbidden')
      const body = (await request.json().catch(() => ({}))) as { primary_diagnosis?: string }
      const val = (body.primary_diagnosis ?? '').toString().trim()
      if (!val) return err(400, 'primary_diagnosis required')
      await conn.query(
        `UPDATE tb_member SET attribution = ? WHERE idx = ? AND mtype = 'child'`,
        [val, cid]
      )
      return json({ ok: true })
    }

    // PUT /api/children/:id/assign-therapist  (doctor only, only if unassigned)
    const assignTherapistMatch = path.match(/^\/api\/children\/(\d+)\/assign-therapist$/)
    if (assignTherapistMatch && method === 'PUT') {
      if (user.mtype !== 'doctor') return err(403, 'doctor only')
      const cid = Number(assignTherapistMatch[1])
      if (!(await ownsChild(conn, cid, user))) return err(403, 'forbidden')
      const body = (await request.json().catch(() => ({}))) as { therapist_code?: string }
      const code = (body.therapist_code ?? '').toString().trim()
      if (!code) return err(400, 'therapist_code required')
      const [existing] = await conn.query<RowDataPacket[]>(
        `SELECT teacher_code FROM tb_member WHERE idx = ? AND mtype = 'child' LIMIT 1`, [cid]
      )
      if ((existing[0] as { teacher_code: string | null } | undefined)?.teacher_code) {
        return err(409, 'already assigned')
      }
      await conn.query(
        `UPDATE tb_member SET teacher_code = ? WHERE idx = ? AND mtype = 'child'`,
        [code, cid]
      )
      return json({ ok: true })
    }

    // GET /api/children/:id/diagnoses
    const diagListMatch = path.match(/^\/api\/children\/(\d+)\/diagnoses$/)
    if (diagListMatch && method === 'GET') {
      const cid = Number(diagListMatch[1])
      if (!(await ownsChild(conn, cid, user))) return err(403, 'forbidden')

      const [cidRows] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM tb_member WHERE idx = ? AND mtype = ? LIMIT 1', [cid, 'child']
      )
      const memberId = (cidRows[0] as { id: string } | undefined)?.id
      if (!memberId) return err(404, 'not found')

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT idx, act_date, analysislog
         FROM tb_childact_report
         WHERE id = ? AND use_type = 'diagnostic'
         ORDER BY act_date DESC, idx DESC`,
        [memberId]
      )
      return json((rows as Array<RowDataPacket & { idx: number; act_date: unknown; analysislog: string|null }>).map(r => {
        const p = parseAnalysislog(r.analysislog)
        return { id: r.idx, examined_at: fmtDate(r.act_date), duration_label: p.duration_label, accuracy_pct: p.accuracy_pct, summary: p.summary }
      }))
    }

    // GET /api/children/:id/treatments
    const treatListMatch = path.match(/^\/api\/children\/(\d+)\/treatments$/)
    if (treatListMatch && method === 'GET') {
      const cid = Number(treatListMatch[1])
      if (!(await ownsChild(conn, cid, user))) return err(403, 'forbidden')
      const [cidRows2] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM tb_member WHERE idx = ? AND mtype = ? LIMIT 1', [cid, 'child']
      )
      const mId = (cidRows2[0] as { id: string } | undefined)?.id
      if (!mId) return err(404, 'not found')

      const [trows] = await conn.query<RowDataPacket[]>(
        `SELECT idx, act_date, analysislog,
                JSON_LENGTH(JSON_EXTRACT(speechlog, '$.logLst')) AS speech_count
         FROM tb_childact_report
         WHERE id = ? AND use_type = 'training'
         ORDER BY act_date DESC, idx DESC`,
        [mId]
      )
      return json((trows as Array<RowDataPacket & { idx: number; act_date: unknown; analysislog: string|null; speech_count: number|null }>).map((r, i) => {
        const p = parseAnalysislog(r.analysislog)
        return {
          id:               r.idx,
          treated_at:       fmtDate(r.act_date),
          session_no:       trows.length - i,
          trained_sound:    p.trained_sound,
          tags_json:        p.tags_json,
          try_count:        p.try_count ?? r.speech_count ?? null,
          avg_accuracy_pct: p.accuracy_pct,
          duration_minutes: p.duration_minutes
        }
      }))
    }

    // PUT /api/children/:id/memos/:type
    const memoMatch = path.match(/^\/api\/children\/(\d+)\/memos\/(admin|doctor|therapist)$/)
    if (memoMatch && method === 'PUT') {
      const cid      = Number(memoMatch[1])
      const memoType = memoMatch[2] as Role
      if (mtypeToRole(user.mtype) !== memoType) return err(403, '자신의 유형 메모만 수정할 수 있습니다.')
      if (!(await ownsChild(conn, cid, user))) return err(403, 'forbidden')

      const body    = (await request.json().catch(() => ({}))) as { content?: string }
      const content = (body.content ?? '').toString()
      const colMap: Record<Role, string> = {
        admin: 'admin_memo', doctor: 'doctor_memo', therapist: 'teacher_memo'
      }

      await conn.query(
        `UPDATE tb_member SET ${colMap[memoType]} = ?, update_date = NOW()
         WHERE idx = ? AND mtype = 'child'`,
        [content, cid]
      )
      return json({ ok: true, updated_at: new Date().toISOString().replace('T', ' ').slice(0, 19) })
    }

    // GET /api/diagnoses/:id
    const diagDetailMatch = path.match(/^\/api\/diagnoses\/(\d+)$/)
    if (diagDetailMatch && method === 'GET') {
      const did = Number(diagDetailMatch[1])
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT
           r.idx                                AS id,
           c.idx                                AS child_id,
           c.id                                 AS identifier,
           DATE_FORMAT(r.act_date, '%Y.%m.%d') AS examined_at,
           r.analysislog
         FROM tb_childact_report r
         JOIN tb_member c ON c.id = r.id AND c.mtype = 'child' AND c.delete_yn = 'N'
         WHERE r.idx = ? AND c.instt_code = ?
         LIMIT 1`,
        [did, user.instt_code]
      )
      if (!rows[0]) return err(404, 'not found')
      const row = rows[0] as { id: number; child_id: number; identifier: string; examined_at: string; analysislog: string | null }
      const detail = parseAnalysislogDetail(row.analysislog)
      return json({ id: row.id, child_id: row.child_id, identifier: row.identifier, examined_at: row.examined_at, ...detail })
    }

    // GET /api/staff?type=doctor|therapist  — 같은 기관 스태프 목록
    if (path === '/api/staff' && method === 'GET') {
      const types = url.searchParams.getAll('type')
      const mtypes = types.flatMap(t =>
        t === 'doctor' ? ['doctor'] : t === 'therapist' ? ['healler'] : []
      )
      if (!mtypes.length) return err(400, 'type required')
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT code, name, mtype FROM tb_member
         WHERE mtype IN (${ph(mtypes.length)}) AND instt_code = ? AND delete_yn = 'N'
         ORDER BY name`,
        [...mtypes, user.instt_code]
      )
      return json((rows as Array<{ code: string; name: string; mtype: Mtype }>).map(r => ({
        code: r.code,
        name: r.name,
        role: mtypeToRole(r.mtype)
      })))
    }

    // GET /api/schedules?from=YYYY-MM-DD&to=YYYY-MM-DD
    if (path === '/api/schedules' && method === 'GET') {
      const from = url.searchParams.get('from') ?? ''
      const to   = url.searchParams.get('to')   ?? ''
      if (!from || !to) return err(400, 'from and to are required')
      const staffCode = user.code || user.id
      let codeWhere = ''
      const args: unknown[] = [user.instt_code, from, to]
      if (user.mtype === 'doctor') {
        codeWhere = staffCode !== user.id
          ? 'AND (s.doctor_code = ? OR s.doctor_code = ?)'
          : 'AND s.doctor_code = ?'
        args.push(staffCode)
        if (staffCode !== user.id) args.push(user.id)
      } else if (user.mtype === 'healler') {
        codeWhere = staffCode !== user.id
          ? 'AND (s.teacher_code = ? OR s.teacher_code = ?)'
          : 'AND s.teacher_code = ?'
        args.push(staffCode)
        if (staffCode !== user.id) args.push(user.id)
      }
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT s.schedule_id AS id,
                c.idx         AS child_idx,
                c.name        AS child_name,
                c.id          AS child_member_id,
                s.schedule_type,
                DATE_FORMAT(s.start_date, '%Y-%m-%dT%H:%i:%s') AS start_datetime,
                DATE_FORMAT(s.end_date,   '%Y-%m-%dT%H:%i:%s') AS end_datetime
         FROM tb_schedule s
         JOIN tb_member c ON c.id = s.child_id AND c.mtype = 'child' AND c.delete_yn = 'N'
         WHERE s.instt_code = ?
           AND s.start_date >= ? AND s.start_date < ?
           ${codeWhere}
         ORDER BY s.start_date`,
        args
      )
      return json(rows)
    }

    // POST /api/schedules
    if (path === '/api/schedules' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        child_idx?: number; start_datetime?: string; end_datetime?: string
        doctor_code?: string; teacher_code?: string; schedule_type?: string
      }
      if (!body.child_idx || !body.start_datetime || !body.end_datetime)
        return err(400, '필수 항목이 누락됐습니다.')
      const [childRows] = await conn.query<RowDataPacket[]>(
        `SELECT id FROM tb_member WHERE idx = ? AND mtype = 'child' AND instt_code = ? AND delete_yn = 'N' LIMIT 1`,
        [body.child_idx, user.instt_code]
      )
      const childRow = childRows[0] as { id: string } | undefined
      if (!childRow) return err(404, '아동을 찾을 수 없습니다.')
      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO tb_schedule
           (child_id, schedule_type, start_date, end_date, instt_code, doctor_code, teacher_code, regist_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [childRow.id, body.schedule_type ?? '2', body.start_datetime, body.end_datetime,
         user.instt_code, body.doctor_code ?? null, body.teacher_code ?? null]
      )
      return json({ id: result.insertId })
    }

    // GET /api/schedules/:id  and  DELETE /api/schedules/:id
    const scheduleIdMatch = path.match(/^\/api\/schedules\/(\d+)$/)
    if (scheduleIdMatch) {
      const sid = Number(scheduleIdMatch[1])
      if (method === 'GET') {
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT s.schedule_id AS id,
                  s.schedule_type,
                  c.idx         AS child_idx,
                  c.name        AS child_name,
                  c.id          AS child_member_id,
                  DATE_FORMAT(s.start_date, '%Y-%m-%dT%H:%i:%s') AS start_datetime,
                  DATE_FORMAT(s.end_date,   '%Y-%m-%dT%H:%i:%s') AS end_datetime,
                  s.doctor_code,
                  s.teacher_code,
                  COALESCE(sd.name, cd.name) AS doctor_name,
                  COALESCE(st.name, ct.name) AS therapist_name
           FROM tb_schedule s
           JOIN tb_member c   ON c.id   = s.child_id      AND c.mtype = 'child'   AND c.delete_yn = 'N'
           LEFT JOIN tb_member sd ON sd.code = s.doctor_code   AND sd.mtype = 'doctor'  AND sd.delete_yn = 'N'
           LEFT JOIN tb_member st ON st.code = s.teacher_code  AND st.mtype = 'healler' AND st.delete_yn = 'N'
           LEFT JOIN tb_member cd ON cd.code = c.doctor_code   AND cd.mtype = 'doctor'  AND cd.delete_yn = 'N'
           LEFT JOIN tb_member ct ON ct.code = c.teacher_code  AND ct.mtype = 'healler' AND ct.delete_yn = 'N'
           WHERE s.schedule_id = ? AND s.instt_code = ?
           LIMIT 1`,
          [sid, user.instt_code]
        )
        if (!rows[0]) return err(404, 'not found')
        return json(rows[0])
      }
      if (method === 'DELETE') {
        const [result] = await conn.query<ResultSetHeader>(
          `DELETE FROM tb_schedule WHERE schedule_id = ? AND instt_code = ?`,
          [sid, user.instt_code]
        )
        if (result.affectedRows === 0) return err(404, 'not found')
        return json({ ok: true })
      }
    }

    // GET /api/diagnoses/:id/recordings
    const recMatch = path.match(/^\/api\/diagnoses\/(\d+)\/recordings$/)
    if (recMatch && method === 'GET') {
      const did = Number(recMatch[1])

      // speechlog → 단어 순서(qzNth) + 최종 발화 round 번호
      const [repRows] = await conn.query<RowDataPacket[]>(
        'SELECT speechlog FROM tb_childact_report WHERE idx = ? LIMIT 1', [did]
      )
      const rawLog = (repRows[0] as { speechlog: string | null } | undefined)?.speechlog

      // 이 세션에 업로드된 모든 파일 (bf_idx 오름차순 = 업로드 순서)
      const [fileRows] = await conn.query<RowDataPacket[]>(
        `SELECT f.file_nm, f.source_file_nm, f.bf_idx
         FROM tb_data_list dl
         JOIN tb_data_file f ON f.data_idx = dl.data_idx
         WHERE dl.stfName = ?
         ORDER BY f.bf_idx`,
        [`idx_${did}`]
      )

      if (!rawLog || !fileRows.length) return json([])

      type LogEntry = { qzNth: number; wrd: string; file: string }
      let logLst: LogEntry[] = []
      try {
        logLst = (JSON.parse(rawLog) as { logLst?: LogEntry[] }).logLst ?? []
      } catch { return json([]) }

      type FileRow = RowDataPacket & { file_nm: string; source_file_nm: string; bf_idx: number }
      const files = fileRows as FileRow[]

      // 단어별로 파일 그룹핑 (업로드 순서 유지 → index = round-1)
      const filesByWord = new Map<string, FileRow[]>()
      for (const f of files) {
        const word = f.source_file_nm.replace(/\.wav$/i, '')
        if (!filesByWord.has(word)) filesByWord.set(word, [])
        filesByWord.get(word)!.push(f)
      }

      // 파일명 패턴: idx_{reportIdx}_{seq}_{round}_{word}_{pron}.wav
      // 같은 단어가 여러 번 등장하거나 round 가 2이상일 때를 대비해
      // 단어별 "소비한 파일 수" 포인터를 사용해 정확한 파일을 선택.
      const base = env.FILES_BASE_URL.replace(/\/$/, '')
      const wordPointer: Record<string, number> = {}
      const result = logLst
        .slice()
        .sort((a, b) => a.qzNth - b.qzNth)
        .flatMap((entry, i) => {
          const roundMatch = entry.file.match(/^idx_\d+_\d+_(\d+)_/)
          const round = roundMatch ? Number(roundMatch[1]) : 1
          const wordFiles = filesByWord.get(entry.wrd) ?? []
          const pointer = wordPointer[entry.wrd] ?? 0
          // 이번 qzNth 의 최종 발화 파일 = pointer + round - 1
          const target = pointer + round - 1
          const fileRow = wordFiles[target] ?? wordFiles[wordFiles.length - 1]
          // 다음 같은 단어 등장 시 이만큼 건너뜀
          wordPointer[entry.wrd] = pointer + round
          if (!fileRow) return []
          return [{ index: i + 1, word: entry.wrd, url: `${base}/dataCenter${fileRow.file_nm}` }]
        })

      return json(result)
    }

    // GET /api/treatments/:id/recordings  (must be before /api/treatments/:id)
    const treatRecMatch = path.match(/^\/api\/treatments\/(\d+)\/recordings$/)
    if (treatRecMatch && method === 'GET') {
      const tid = Number(treatRecMatch[1])
      const [repRows] = await conn.query<RowDataPacket[]>(
        `SELECT r.speechlog FROM tb_childact_report r
         JOIN tb_member c ON c.id = r.id AND c.mtype = 'child' AND c.delete_yn = 'N'
         WHERE r.idx = ? AND r.use_type = 'training' AND c.instt_code = ?
         LIMIT 1`, [tid, user.instt_code])
      const rawLog = (repRows[0] as { speechlog: string | null } | undefined)?.speechlog
      const [fileRows] = await conn.query<RowDataPacket[]>(
        `SELECT f.file_nm, f.source_file_nm, f.bf_idx
         FROM tb_data_list dl
         JOIN tb_data_file f ON f.data_idx = dl.data_idx
         WHERE dl.stfName = ? ORDER BY f.bf_idx`, [`idx_${tid}`])
      if (!rawLog || !fileRows.length) return json([])
      type TreatLogEntry = { qzNth: number; wrd: string; file: string }
      let treatLogLst: TreatLogEntry[] = []
      try { treatLogLst = (JSON.parse(rawLog) as { logLst?: TreatLogEntry[] }).logLst ?? [] } catch { return json([]) }
      type TreatFileRow = RowDataPacket & { file_nm: string; source_file_nm: string; bf_idx: number }
      const treatFiles = fileRows as TreatFileRow[]
      const treatFilesByWord = new Map<string, TreatFileRow[]>()
      for (const f of treatFiles) {
        const word = f.source_file_nm.replace(/\.wav$/i, '')
        if (!treatFilesByWord.has(word)) treatFilesByWord.set(word, [])
        treatFilesByWord.get(word)!.push(f)
      }
      const treatBase = env.FILES_BASE_URL.replace(/\/$/, '')
      const treatWordPointer: Record<string, number> = {}
      const treatResult = treatLogLst.slice().sort((a, b) => a.qzNth - b.qzNth).flatMap((entry, i) => {
        const roundMatch = entry.file.match(/^idx_\d+_\d+_(\d+)_/)
        const round = roundMatch ? Number(roundMatch[1]) : 1
        const wordFiles = treatFilesByWord.get(entry.wrd) ?? []
        const pointer = treatWordPointer[entry.wrd] ?? 0
        const target = pointer + round - 1
        const fileRow = wordFiles[target] ?? wordFiles[wordFiles.length - 1]
        treatWordPointer[entry.wrd] = pointer + round
        if (!fileRow) return []
        return [{ index: i + 1, word: entry.wrd, url: `${treatBase}/dataCenter${fileRow.file_nm}` }]
      })
      return json(treatResult)
    }

    // GET /api/treatments/:id
    const treatDetailMatch = path.match(/^\/api\/treatments\/(\d+)$/)
    if (treatDetailMatch && method === 'GET') {
      const tid = Number(treatDetailMatch[1])
      const [trows] = await conn.query<RowDataPacket[]>(
        `SELECT r.idx, r.id AS child_member_id, r.act_date, r.analysislog,
                JSON_LENGTH(JSON_EXTRACT(r.speechlog, '$.logLst')) AS speech_count
         FROM tb_childact_report r
         JOIN tb_member c ON c.id = r.id AND c.mtype = 'child' AND c.delete_yn = 'N'
         WHERE r.idx = ? AND r.use_type = 'training' AND c.instt_code = ?
         LIMIT 1`, [tid, user.instt_code])
      if (!trows[0]) return err(404, 'not found')
      type TreatDetailRow = RowDataPacket & { idx: number; child_member_id: string; act_date: unknown; analysislog: string | null; speech_count: number | null }
      const trow = trows[0] as TreatDetailRow
      const tp = parseAnalysislog(trow.analysislog)
      const [sessRows] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_childact_report
         WHERE id = ? AND use_type = 'training'
           AND (act_date < ? OR (act_date = ? AND idx <= ?))`,
        [trow.child_member_id, trow.act_date, trow.act_date, tid])
      const sessionNo = (sessRows[0] as { cnt: number }).cnt
      const [childRow2] = await conn.query<RowDataPacket[]>(
        `SELECT regist_date FROM tb_member WHERE id = ? AND mtype = 'child' LIMIT 1`,
        [trow.child_member_id])
      const serviceStartedAt = (childRow2[0] as { regist_date: unknown } | undefined)?.regist_date
      const [weekRows] = await conn.query<RowDataPacket[]>(
        `SELECT act_date, analysislog,
                JSON_LENGTH(JSON_EXTRACT(speechlog, '$.logLst')) AS speech_count
         FROM tb_childact_report
         WHERE id = ? AND use_type = 'training' AND YEARWEEK(act_date, 1) = YEARWEEK(?, 1)`,
        [trow.child_member_id, trow.act_date])
      const weekMap: Record<number, { acc: number[]; tries: number[]; mins: number[] }> = {}
      for (const wr of weekRows as Array<{ act_date: unknown; analysislog: string | null; speech_count: number | null }>) {
        const d = wr.act_date instanceof Date ? wr.act_date : new Date(wr.act_date as string)
        const wdow = d.getDay()
        if (!weekMap[wdow]) weekMap[wdow] = { acc: [], tries: [], mins: [] }
        const wp = parseAnalysislog(wr.analysislog)
        if (wp.accuracy_pct != null) weekMap[wdow].acc.push(wp.accuracy_pct)
        const tryCount = wp.try_count ?? wr.speech_count ?? null
        if (tryCount != null) weekMap[wdow].tries.push(tryCount)
        if (wp.duration_minutes != null) weekMap[wdow].mins.push(wp.duration_minutes)
      }
      const tdAvg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0
      const tdSum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)
      const DOW_KR = ['일', '월', '화', '수', '목', '금', '토']
      const weekly = [1, 2, 3, 4, 5, 6, 0].map(d => {
        const e = weekMap[d] ?? { acc: [], tries: [], mins: [] }
        return { day: DOW_KR[d], accuracy: tdAvg(e.acc), tries: tdSum(e.tries), minutes: tdSum(e.mins) }
      })
      return json({
        id: trow.idx, identifier: trow.child_member_id,
        service_started_at: fmtDate(serviceStartedAt),
        treated_at: fmtDate(trow.act_date), session_no: sessionNo,
        trained_sound: tp.trained_sound, accuracy_pct: tp.accuracy_pct,
        try_count: tp.try_count ?? trow.speech_count ?? null, duration_minutes: tp.duration_minutes,
        tags: tp.tags_json ? (JSON.parse(tp.tags_json) as string[]) : [],
        weekly
      })
    }

    // GET /api/faq
    if (path === '/api/faq' && method === 'GET') {
      const gubun  = url.searchParams.get('gubun')  ?? ''
      const search = url.searchParams.get('search') ?? ''

      const whereArgs: unknown[] = []
      let where = `WHERE BOARD_ID = 'faq'`
      if (gubun === '기타') {
        where += ` AND (GUBUN = '기타' OR GUBUN = '' OR GUBUN IS NULL)`
      } else if (gubun) {
        where += ' AND GUBUN = ?'; whereArgs.push(gubun)
      }
      if (search) { where += ' AND BOARD_TITLE LIKE ?'; whereArgs.push(`%${search}%`) }

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT BOARD_KEY, BOARD_TITLE, GUBUN FROM tb_board_list ${where} ORDER BY BOARD_KEY ASC`,
        whereArgs
      )
      return json({ items: rows })
    }

    // GET /api/faq/:id
    const faqDetailMatch = path.match(/^\/api\/faq\/(\d+)$/)
    if (faqDetailMatch && method === 'GET') {
      const fid = Number(faqDetailMatch[1])

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT BOARD_KEY, BOARD_TITLE, BOARD_CONTENT, REPLY_MEMO, GUBUN
         FROM tb_board_list WHERE BOARD_KEY = ? AND BOARD_ID = 'faq' LIMIT 1`, [fid]
      )
      if (!rows[0]) return err(404, 'not found')

      const [fileRows] = await conn.query<RowDataPacket[]>(
        `SELECT BF_IDX, ATTACH_NM, FILE_NM, REPLY_YN FROM tb_board_file
         WHERE BOARD_KEY = ? AND ATTACH_TYPE = 'I' ORDER BY BF_IDX`, [fid]
      )
      type FRow = { BF_IDX: number; ATTACH_NM: string; FILE_NM: string; REPLY_YN: string }
      const files = fileRows as FRow[]

      return json({
        ...rows[0],
        question_images: files.filter(f => f.REPLY_YN === 'N').map(({ BF_IDX, ATTACH_NM, FILE_NM }) => ({ BF_IDX, ATTACH_NM, FILE_NM })),
        answer_images:   files.filter(f => f.REPLY_YN === 'Y').map(({ BF_IDX, ATTACH_NM, FILE_NM }) => ({ BF_IDX, ATTACH_NM, FILE_NM }))
      })
    }

    // GET /api/notices
    if (path === '/api/notices' && method === 'GET') {
      const page     = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
      const gubun    = url.searchParams.get('gubun') ?? ''
      const search   = url.searchParams.get('search') ?? ''
      const pageSize = 10

      const whereArgs: unknown[] = []
      let where = `WHERE BOARD_ID = 'notice'`
      if (gubun)  { where += ' AND GUBUN = ?';            whereArgs.push(gubun) }
      if (search) { where += ' AND BOARD_TITLE LIKE ?';  whereArgs.push(`%${search}%`) }

      const [[countRow]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM tb_board_list ${where}`, whereArgs
      ) as [Array<{ total: number }>, unknown]

      const [catRows] = await conn.query<RowDataPacket[]>(
        `SELECT DISTINCT GUBUN FROM tb_board_list WHERE BOARD_ID = 'notice' AND GUBUN IS NOT NULL AND GUBUN != '' ORDER BY GUBUN`
      )

      const offset = (page - 1) * pageSize
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT BOARD_KEY, GUBUN, BOARD_FIXED, BOARD_TITLE,
                DATE_FORMAT(BOARD_SAVE_DATE, '%Y.%m.%d') AS reg_date, BOARD_READ_COUNT
         FROM tb_board_list ${where}
         ORDER BY BOARD_FIXED DESC, BOARD_SAVE_DATE DESC, BOARD_KEY DESC
         LIMIT ? OFFSET ?`,
        [...whereArgs, pageSize, offset]
      )

      return json({
        total: countRow.total,
        categories: (catRows as Array<{ GUBUN: string }>).map(r => r.GUBUN),
        items: rows
      })
    }

    // GET /api/notices/:id
    const noticeDetailMatch = path.match(/^\/api\/notices\/(\d+)$/)
    if (noticeDetailMatch && method === 'GET') {
      const nid = Number(noticeDetailMatch[1])

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT BOARD_KEY, GUBUN, BOARD_FIXED, BOARD_TITLE, BOARD_CONTENT,
                DATE_FORMAT(BOARD_SAVE_DATE, '%Y.%m.%d') AS reg_date, BOARD_READ_COUNT
         FROM tb_board_list WHERE BOARD_KEY = ? AND BOARD_ID = 'notice' LIMIT 1`, [nid]
      )
      if (!rows[0]) return err(404, 'not found')

      const [fileRows] = await conn.query<RowDataPacket[]>(
        `SELECT BF_IDX, FILE_NM, ATTACH_TYPE, FILE_SIZE FROM tb_board_file
         WHERE BOARD_KEY = ? AND REPLY_YN = 'N' ORDER BY BF_IDX`, [nid]
      )

      return json({ ...rows[0], attachments: fileRows })
    }

    // POST /api/notices/:id/view
    const noticeViewMatch = path.match(/^\/api\/notices\/(\d+)\/view$/)
    if (noticeViewMatch && method === 'POST') {
      const nid = Number(noticeViewMatch[1])
      await conn.query(
        `UPDATE tb_board_list SET BOARD_READ_COUNT = BOARD_READ_COUNT + 1
         WHERE BOARD_KEY = ? AND BOARD_ID = 'notice'`, [nid]
      )
      return json({ ok: true })
    }

    // ── Admin endpoints ──────────────────────────────────────────────────────
    const isAdmin = ['iadmin', 'sadmin', 'wadmin'].includes(user.mtype)

    // GET /api/admin/children
    if (path === '/api/admin/children' && method === 'GET') {
      if (!isAdmin) return err(403, 'admin only')
      const search = url.searchParams.get('search') ?? ''
      const args: unknown[] = ['child', user.instt_code, 'N']
      let searchWhere = ''
      if (search) { searchWhere = ' AND (c.name LIKE ? OR c.id LIKE ?)'; args.push(`%${search}%`, `%${search}%`) }
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT c.idx, c.id AS identifier, c.name, c.birth_date, c.is_male_yn,
                c.regist_date, c.doctor_code, c.teacher_code,
                d.name AS doctor_name, t.name AS therapist_name
         FROM tb_member c
         LEFT JOIN tb_member d ON d.code = c.doctor_code AND d.mtype = 'doctor' AND d.delete_yn = 'N'
         LEFT JOIN tb_member t ON t.code = c.teacher_code AND t.mtype = 'healler' AND t.delete_yn = 'N'
         WHERE c.mtype = ? AND c.instt_code = ? AND c.delete_yn = ? ${searchWhere}
         ORDER BY c.regist_date DESC, c.idx DESC`,
        args
      )
      const nowMs = Date.now()
      const NEW_MS = 7 * 24 * 3600 * 1000
      type CRow = RowDataPacket & { idx: number; identifier: string; name: string; birth_date: unknown; is_male_yn: string | null; regist_date: unknown; doctor_code: string | null; teacher_code: string | null; doctor_name: string | null; therapist_name: string | null }
      return json((rows as CRow[]).map(r => {
        const rd = r.regist_date instanceof Date ? r.regist_date : r.regist_date ? new Date(r.regist_date as string) : null
        return {
          id: r.idx, identifier: r.identifier, name: r.name,
          birth_date: fmtDate(r.birth_date), age_label: ageLabel(r.birth_date),
          gender: r.is_male_yn === 'Y' ? '남아' : r.is_male_yn === 'N' ? '여아' : '-',
          regist_date: rd ? rd.toISOString().slice(0, 16).replace('T', ' ') : null,
          is_new: rd ? (nowMs - rd.getTime()) < NEW_MS : false,
          doctor_code: r.doctor_code, doctor_name: r.doctor_name,
          teacher_code: r.teacher_code, therapist_name: r.therapist_name,
        }
      }))
    }

    // DELETE /api/admin/children (bulk soft-delete)
    if (path === '/api/admin/children' && method === 'DELETE') {
      if (!isAdmin) return err(403, 'admin only')
      const body = (await request.json().catch(() => ({}))) as { ids?: number[] }
      const ids = body.ids ?? []
      if (!ids.length) return json({ deleted: 0 })
      const [result] = await conn.query<ResultSetHeader>(
        `UPDATE tb_member SET delete_yn = 'Y', update_date = NOW()
         WHERE idx IN (${ph(ids.length)}) AND mtype = 'child' AND instt_code = ?`,
        [...ids, user.instt_code]
      )
      return json({ deleted: result.affectedRows })
    }

    // DELETE /api/admin/members (bulk soft-delete)
    if (path === '/api/admin/members' && method === 'DELETE') {
      if (!isAdmin) return err(403, 'admin only')
      const body = (await request.json().catch(() => ({}))) as { ids?: number[] }
      const ids = body.ids ?? []
      if (!ids.length) return json({ deleted: 0 })
      const [result] = await conn.query<ResultSetHeader>(
        `UPDATE tb_member SET delete_yn = 'Y', update_date = NOW()
         WHERE idx IN (${ph(ids.length)}) AND mtype IN ('doctor', 'healler') AND instt_code = ?`,
        [...ids, user.instt_code]
      )
      return json({ deleted: result.affectedRows })
    }

    // PUT /api/admin/members/restore
    if (path === '/api/admin/members/restore' && method === 'PUT') {
      if (!isAdmin) return err(403, 'admin only')
      const body = (await request.json().catch(() => ({}))) as { ids?: number[] }
      const ids = body.ids ?? []
      if (!ids.length) return json({ restored: 0 })
      const [result] = await conn.query<ResultSetHeader>(
        `UPDATE tb_member SET delete_yn = 'N', update_date = NOW()
         WHERE idx IN (${ph(ids.length)}) AND instt_code = ? AND delete_yn = 'Y'`,
        [...ids, user.instt_code]
      )
      return json({ restored: result.affectedRows })
    }

    // PUT /api/admin/children/restore (bulk restore)
    if (path === '/api/admin/children/restore' && method === 'PUT') {
      if (!isAdmin) return err(403, 'admin only')
      const body = (await request.json().catch(() => ({}))) as { ids?: number[] }
      const ids = body.ids ?? []
      if (!ids.length) return json({ restored: 0 })
      const [result] = await conn.query<ResultSetHeader>(
        `UPDATE tb_member SET delete_yn = 'N', update_date = NOW()
         WHERE idx IN (${ph(ids.length)}) AND mtype = 'child' AND instt_code = ? AND delete_yn = 'Y'`,
        [...ids, user.instt_code]
      )
      return json({ restored: result.affectedRows })
    }

    // GET /api/admin/children/:id
    const adminChildDetailMatch = path.match(/^\/api\/admin\/children\/(\d+)$/)
    if (adminChildDetailMatch && method === 'GET') {
      if (!isAdmin) return err(403, 'admin only')
      const cid = Number(adminChildDetailMatch[1])
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT c.idx, c.id AS identifier, c.name, c.birth_date, c.is_male_yn,
                c.regist_date, c.doctor_code, c.teacher_code,
                d.name AS doctor_name, d.depart_code AS doctor_department,
                t.name AS therapist_name, t.depart_code AS therapist_department
         FROM tb_member c
         LEFT JOIN tb_member d ON d.code = c.doctor_code AND d.mtype = 'doctor' AND d.delete_yn = 'N'
         LEFT JOIN tb_member t ON t.code = c.teacher_code AND t.mtype = 'healler' AND t.delete_yn = 'N'
         WHERE c.idx = ? AND c.instt_code = ? AND c.mtype = 'child' AND c.delete_yn = 'N'`,
        [cid, user.instt_code]
      )
      if (!rows.length) return err(404, 'not found')
      type DRow = RowDataPacket & { idx: number; identifier: string; name: string; birth_date: unknown; is_male_yn: string | null; regist_date: unknown; doctor_code: string | null; doctor_name: string | null; doctor_department: string | null; teacher_code: string | null; therapist_name: string | null; therapist_department: string | null }
      const r = rows[0] as DRow
      return json({
        id: r.idx, identifier: r.identifier, name: r.name,
        birth_date: fmtDate(r.birth_date), age_label: ageLabel(r.birth_date),
        gender: r.is_male_yn === 'Y' ? '남아' : r.is_male_yn === 'N' ? '여아' : '-',
        regist_date: fmtDate(r.regist_date),
        doctor_code: r.doctor_code, doctor_name: r.doctor_name, doctor_department: r.doctor_department,
        teacher_code: r.teacher_code, therapist_name: r.therapist_name, therapist_department: r.therapist_department,
      })
    }

    // GET /api/admin/children/:id/schedules?year=&month=
    const adminChildSchedMatch = path.match(/^\/api\/admin\/children\/(\d+)\/schedules$/)
    if (adminChildSchedMatch && method === 'GET') {
      if (!isAdmin) return err(403, 'admin only')
      const cid = Number(adminChildSchedMatch[1])
      const year = Number(url.searchParams.get('year') ?? new Date().getFullYear())
      const month = Number(url.searchParams.get('month') ?? new Date().getMonth() + 1)
      const fromStr = `${year}-${String(month).padStart(2, '0')}-01`
      const [schedRows] = await conn.query<RowDataPacket[]>(
        `SELECT s.schedule_id AS id, s.schedule_type,
                DATE_FORMAT(s.start_date, '%Y-%m-%dT%H:%i:%s') AS start_datetime,
                DATE_FORMAT(s.end_date,   '%Y-%m-%dT%H:%i:%s') AS end_datetime
         FROM tb_schedule s
         JOIN tb_member c ON c.id = s.child_id AND c.idx = ? AND c.instt_code = ?
         WHERE s.instt_code = ?
           AND s.start_date >= ?
           AND s.start_date < DATE_ADD(?, INTERVAL 1 MONTH)
         ORDER BY s.start_date`,
        [cid, user.instt_code, user.instt_code, fromStr, fromStr]
      )
      return json(schedRows)
    }

    // PUT /api/admin/children/:id/assign
    const adminAssignMatch = path.match(/^\/api\/admin\/children\/(\d+)\/assign$/)
    if (adminAssignMatch && method === 'PUT') {
      if (!isAdmin) return err(403, 'admin only')
      const cid = Number(adminAssignMatch[1])
      const body = (await request.json().catch(() => ({}))) as { doctor_code?: string | null; teacher_code?: string | null }
      const sets: string[] = ['update_date = NOW()']
      const args: unknown[] = []
      if ('doctor_code' in body) { sets.unshift('doctor_code = ?'); args.push(body.doctor_code ?? null) }
      if ('teacher_code' in body) { sets.unshift('teacher_code = ?'); args.push(body.teacher_code ?? null) }
      args.push(cid, user.instt_code)
      await conn.query(
        `UPDATE tb_member SET ${sets.join(', ')} WHERE idx = ? AND mtype = 'child' AND instt_code = ?`, args
      )
      return json({ ok: true })
    }

    // GET /api/admin/staff?type=doctor|therapist&search=
    if (path === '/api/admin/staff' && method === 'GET') {
      if (!isAdmin) return err(403, 'admin only')
      const type = url.searchParams.get('type') ?? ''
      const search = url.searchParams.get('search') ?? ''
      const mtype = type === 'doctor' ? 'doctor' : 'healler'
      const args: unknown[] = [mtype, user.instt_code, 'N']
      let searchWhere = ''
      if (search) { searchWhere = ' AND (name LIKE ? OR COALESCE(depart_code,\'\') LIKE ?)'; args.push(`%${search}%`, `%${search}%`) }
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT code, name, depart_code FROM tb_member
         WHERE mtype = ? AND instt_code = ? AND delete_yn = ? ${searchWhere}
         ORDER BY name`,
        args
      )
      return json(rows)
    }

    // GET /api/admin/members?type=doctor|therapist&search=
    if (path === '/api/admin/members' && method === 'GET') {
      if (!isAdmin) return err(403, 'admin only')
      const type = url.searchParams.get('type') ?? 'doctor'
      const search = url.searchParams.get('search') ?? ''
      const mtype = type === 'doctor' ? 'doctor' : 'healler'
      const args: unknown[] = [mtype, user.instt_code, 'N']
      let searchWhere = ''
      if (search) {
        searchWhere = ' AND (m.name LIKE ? OR m.code LIKE ? OR COALESCE(m.depart_code,\'\') LIKE ?)'
        args.push(`%${search}%`, `%${search}%`, `%${search}%`)
      }
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT m.idx, m.code, m.name, m.depart_code, m.instt_code, m.status_yn,
                DATEDIFF(NOW(), m.regist_date) <= 30 AS is_new
         FROM tb_member m
         WHERE m.mtype = ? AND m.instt_code = ? AND m.delete_yn = ? ${searchWhere}
         ORDER BY m.name`,
        args
      )
      type MRow = RowDataPacket & { idx: number; code: string; name: string; depart_code: string|null; instt_code: string|null; status_yn: string|null; is_new: number }
      return json((rows as MRow[]).map(r => ({
        id: r.idx,
        code: r.code,
        name: r.name,
        depart_code: r.depart_code,
        instt_code: r.instt_code,
        status: r.status_yn === 'Y' ? '재직' : '휴직',
        is_new: Boolean(r.is_new),
      })))
    }

    // GET /api/admin/members/:id
    const adminMemberDetailMatch = path.match(/^\/api\/admin\/members\/(\d+)$/)
    if (adminMemberDetailMatch && method === 'GET') {
      if (!isAdmin) return err(403, 'admin only')
      const mid = Number(adminMemberDetailMatch[1])
      const [mrows] = await conn.query<RowDataPacket[]>(
        `SELECT idx, code, name, depart_code, instt_code, mtype, status_yn,
                DATEDIFF(NOW(), regist_date) <= 30 AS is_new
         FROM tb_member WHERE idx = ? AND instt_code = ? AND delete_yn = 'N'`,
        [mid, user.instt_code]
      )
      if (!mrows.length) return err(404, 'not found')
      const m = mrows[0] as RowDataPacket & { idx:number; code:string; name:string; depart_code:string|null; instt_code:string|null; mtype:string; status_yn:string|null; is_new:number }
      let diagDays: string | null = null
      try {
        const [drows] = await conn.query<RowDataPacket[]>('SELECT diag_days FROM tb_member WHERE idx = ?', [mid])
        diagDays = (drows[0] as RowDataPacket & { diag_days: string | null })?.diag_days ?? null
      } catch { /* diag_days column not yet created */ }
      const isDoctor = m.mtype === 'doctor'
      const childWhere = isDoctor ? 'c.doctor_code = ?' : 'c.teacher_code = ?'
      const [crows] = await conn.query<RowDataPacket[]>(
        `SELECT c.idx AS id, c.id AS identifier, c.name, c.birth_date, c.is_male_yn, c.regist_date,
                s_d.start_date AS next_doctor_appointment,
                s_t.start_date AS next_therapy_appointment,
                t.name AS therapist_name
         FROM tb_member c
         LEFT JOIN (SELECT child_id, MIN(start_date) AS start_date FROM tb_schedule WHERE schedule_type='1' AND start_date > NOW() GROUP BY child_id) s_d ON s_d.child_id = c.id
         LEFT JOIN (SELECT child_id, MIN(start_date) AS start_date FROM tb_schedule WHERE schedule_type='2' AND start_date > NOW() GROUP BY child_id) s_t ON s_t.child_id = c.id
         LEFT JOIN tb_member t ON t.code = c.teacher_code AND t.mtype = 'healler'
         WHERE c.mtype = 'child' AND c.instt_code = ? AND c.delete_yn = 'N' AND ${childWhere}
         ORDER BY c.name`,
        [user.instt_code, m.code]
      )
      type CRow = RowDataPacket & { id:number; identifier:string; name:string; birth_date:unknown; is_male_yn:string|null; regist_date:unknown; next_doctor_appointment:unknown; next_therapy_appointment:unknown; therapist_name:string|null }
      return json({
        member: {
          id: m.idx, code: m.code, name: m.name,
          depart_code: m.depart_code, instt_code: m.instt_code,
          mtype: m.mtype === 'doctor' ? 'doctor' : 'therapist',
          status: m.status_yn === 'Y' ? '재직' : '휴직',
          is_new: Boolean(m.is_new),
          diag_days: diagDays,
        },
        children: (crows as CRow[]).map(r => ({
          id: r.id, identifier: r.identifier, name: r.name,
          birth_date: fmtDate(r.birth_date), age_label: ageLabel(r.birth_date),
          gender: r.is_male_yn === 'Y' ? '남아' : r.is_male_yn === 'N' ? '여아' : '-',
          next_doctor_appointment: fmtDate(r.next_doctor_appointment),
          next_therapy_appointment: fmtDate(r.next_therapy_appointment),
          therapist_name: r.therapist_name,
          regist_date: fmtDate(r.regist_date),
        })),
      })
    }

    // PUT /api/admin/members/:id  (requires: ALTER TABLE tb_member ADD COLUMN diag_days VARCHAR(50) NULL DEFAULT NULL)
    const adminMemberUpdateMatch = path.match(/^\/api\/admin\/members\/(\d+)$/)
    if (adminMemberUpdateMatch && method === 'PUT') {
      if (!isAdmin) return err(403, 'admin only')
      const mid = Number(adminMemberUpdateMatch[1])
      const body = await request.json() as { name?: string; depart_code?: string | null; status?: '재직' | '휴직'; diag_days?: string | null }
      const sets: string[] = []
      const args: unknown[] = []
      if (body.name !== undefined) { sets.push('name = ?'); args.push(body.name.trim()) }
      if ('depart_code' in body) { sets.push('depart_code = ?'); args.push(body.depart_code || null) }
      if (body.status !== undefined) { sets.push('status_yn = ?'); args.push(body.status === '재직' ? 'Y' : 'N') }
      if (sets.length > 0) {
        sets.push('update_date = NOW()')
        await conn.query(`UPDATE tb_member SET ${sets.join(', ')} WHERE idx = ? AND instt_code = ? AND delete_yn = 'N'`, [...args, mid, user.instt_code])
      }
      if ('diag_days' in body) {
        try {
          await conn.query('UPDATE tb_member SET diag_days = ? WHERE idx = ? AND instt_code = ?', [body.diag_days || null, mid, user.instt_code])
        } catch { /* diag_days column not yet created */ }
      }
      return json({ ok: true })
    }

    // GET /api/admin/deleted-members
    if (path === '/api/admin/deleted-members' && method === 'GET') {
      if (!isAdmin) return err(403, 'admin only')
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT idx, code, name, depart_code, instt_code, mtype, status_yn, update_date AS deleted_at
         FROM tb_member
         WHERE mtype IN ('doctor', 'healler') AND instt_code = ? AND delete_yn = 'Y'
         ORDER BY update_date DESC`,
        [user.instt_code]
      )
      type DMRow = RowDataPacket & { idx: number; code: string; name: string; depart_code: string | null; instt_code: string | null; mtype: string; status_yn: string | null; deleted_at: unknown }
      return json((rows as DMRow[]).map(r => ({
        id: r.idx, code: r.code, name: r.name,
        depart_code: r.depart_code, instt_code: r.instt_code,
        mtype: r.mtype === 'doctor' ? 'doctor' : 'therapist',
        status: r.status_yn === 'Y' ? '재직' : '휴직',
        deleted_at: fmtDate(r.deleted_at),
      })))
    }

    // GET /api/admin/deleted-children
    if (path === '/api/admin/deleted-children' && method === 'GET') {
      if (!isAdmin) return err(403, 'admin only')
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT idx, id AS identifier, name, birth_date, is_male_yn, update_date AS deleted_at
         FROM tb_member
         WHERE mtype = 'child' AND instt_code = ? AND delete_yn = 'Y'
         ORDER BY update_date DESC`,
        [user.instt_code]
      )
      type DRow = RowDataPacket & { idx: number; identifier: string; name: string; birth_date: unknown; is_male_yn: string | null; deleted_at: unknown }
      return json((rows as DRow[]).map(r => ({
        id: r.idx, identifier: r.identifier, name: r.name,
        birth_date: fmtDate(r.birth_date), age_label: ageLabel(r.birth_date),
        gender: r.is_male_yn === 'Y' ? '남아' : r.is_male_yn === 'N' ? '여아' : '-',
        regist_date: null, is_new: false,
        doctor_code: null, doctor_name: null, teacher_code: null, therapist_name: null,
        deleted_at: fmtDate(r.deleted_at),
      })))
    }

    // GET /api/admin/child-history?status=active|dormant|all&search=
    if (path === '/api/admin/child-history' && method === 'GET') {
      if (!isAdmin) return err(403, 'admin only')
      const status = url.searchParams.get('status') ?? 'all'
      const search = url.searchParams.get('search') ?? ''
      const args: unknown[] = ['child', user.instt_code, 'N']
      let statusWhere = ''
      if (status === 'active')  { statusWhere = " AND c.status_yn = 'Y'" }
      if (status === 'dormant') { statusWhere = " AND c.status_yn = 'N'" }
      let searchWhere = ''
      if (search) { searchWhere = ' AND (c.name LIKE ? OR c.id LIKE ?)'; args.push(`%${search}%`, `%${search}%`) }
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT c.idx, c.id AS identifier, c.name, c.birth_date, c.is_male_yn,
                c.regist_date, c.doctor_code, c.teacher_code,
                d.name AS doctor_name, t.name AS therapist_name,
                (SELECT DATE_FORMAT(s.start_date, '%Y.%m.%d')
                 FROM tb_schedule s
                 WHERE s.child_id = c.id AND s.schedule_type = '1' AND s.start_date > NOW()
                 ORDER BY s.start_date LIMIT 1) AS next_doctor_appointment,
                (SELECT DATE_FORMAT(s.start_date, '%Y.%m.%d')
                 FROM tb_schedule s
                 WHERE s.child_id = c.id AND s.schedule_type = '2' AND s.start_date > NOW()
                 ORDER BY s.start_date LIMIT 1) AS next_therapy_appointment
         FROM tb_member c
         LEFT JOIN tb_member d ON d.code = c.doctor_code AND d.mtype = 'doctor' AND d.delete_yn = 'N'
         LEFT JOIN tb_member t ON t.code = c.teacher_code AND t.mtype = 'healler' AND t.delete_yn = 'N'
         WHERE c.mtype = ? AND c.instt_code = ? AND c.delete_yn = ? ${statusWhere}${searchWhere}
         ORDER BY c.regist_date DESC, c.idx DESC`,
        args
      )
      type HRow = RowDataPacket & { idx: number; identifier: string; name: string; birth_date: unknown; is_male_yn: string | null; regist_date: unknown; doctor_code: string | null; teacher_code: string | null; doctor_name: string | null; therapist_name: string | null; next_doctor_appointment: string | null; next_therapy_appointment: string | null }
      const nowMs = Date.now()
      const NEW_MS = 7 * 24 * 3600 * 1000
      return json((rows as HRow[]).map(r => {
        const rd = r.regist_date instanceof Date ? r.regist_date : r.regist_date ? new Date(r.regist_date as string) : null
        return {
          id: r.idx, identifier: r.identifier, name: r.name,
          birth_date: fmtDate(r.birth_date), age_label: ageLabel(r.birth_date),
          gender: r.is_male_yn === 'Y' ? '남아' : r.is_male_yn === 'N' ? '여아' : '-',
          regist_date: rd ? rd.toISOString().slice(0, 16).replace('T', ' ') : null,
          is_new: rd ? (nowMs - rd.getTime()) < NEW_MS : false,
          doctor_code: r.doctor_code, doctor_name: r.doctor_name,
          teacher_code: r.teacher_code, therapist_name: r.therapist_name,
          next_doctor_appointment: r.next_doctor_appointment,
          next_therapy_appointment: r.next_therapy_appointment,
        }
      }))
    }

    // GET /api/admin/dashboard
    if (path === '/api/admin/dashboard' && method === 'GET') {
      if (!isAdmin) return err(403, 'admin only')
      const inst = user.instt_code

      const [[statsRows]] = await conn.query<RowDataPacket[]>(
        `SELECT
           SUM(CASE WHEN mtype='doctor'  AND delete_yn='N' THEN 1 ELSE 0 END) AS doc_total,
           SUM(CASE WHEN mtype='healler' AND delete_yn='N' THEN 1 ELSE 0 END) AS th_total,
           SUM(CASE WHEN mtype='child'   AND delete_yn='N' THEN 1 ELSE 0 END) AS ch_total,
           SUM(CASE WHEN mtype='doctor'  AND delete_yn='N' AND YEAR(regist_date)=YEAR(NOW())               AND MONTH(regist_date)=MONTH(NOW())                                      THEN 1 ELSE 0 END) AS doc_this,
           SUM(CASE WHEN mtype='doctor'  AND delete_yn='N' AND YEAR(regist_date)=YEAR(DATE_SUB(NOW(),INTERVAL 1 MONTH)) AND MONTH(regist_date)=MONTH(DATE_SUB(NOW(),INTERVAL 1 MONTH)) THEN 1 ELSE 0 END) AS doc_last,
           SUM(CASE WHEN mtype='healler' AND delete_yn='N' AND YEAR(regist_date)=YEAR(NOW())               AND MONTH(regist_date)=MONTH(NOW())                                      THEN 1 ELSE 0 END) AS th_this,
           SUM(CASE WHEN mtype='healler' AND delete_yn='N' AND YEAR(regist_date)=YEAR(DATE_SUB(NOW(),INTERVAL 1 MONTH)) AND MONTH(regist_date)=MONTH(DATE_SUB(NOW(),INTERVAL 1 MONTH)) THEN 1 ELSE 0 END) AS th_last,
           SUM(CASE WHEN mtype='child'   AND delete_yn='N' AND YEAR(regist_date)=YEAR(NOW())               AND MONTH(regist_date)=MONTH(NOW())                                      THEN 1 ELSE 0 END) AS ch_this,
           SUM(CASE WHEN mtype='child'   AND delete_yn='N' AND YEAR(regist_date)=YEAR(DATE_SUB(NOW(),INTERVAL 1 MONTH)) AND MONTH(regist_date)=MONTH(DATE_SUB(NOW(),INTERVAL 1 MONTH)) THEN 1 ELSE 0 END) AS ch_last
         FROM tb_member WHERE instt_code = ?`,
        [inst]
      )
      type SR = { doc_total:number; th_total:number; ch_total:number; doc_this:number; doc_last:number; th_this:number; th_last:number; ch_this:number; ch_last:number }
      const s = statsRows as unknown as SR

      const [[docRows], [thRows], [cRows]] = await Promise.all([
        conn.query<RowDataPacket[]>(
          `SELECT idx, code, name, depart_code, DATE_FORMAT(regist_date,'%Y.%m.%d') AS regist_date
           FROM tb_member WHERE mtype='doctor' AND instt_code=? AND delete_yn='N'
           ORDER BY regist_date DESC, idx DESC LIMIT 5`, [inst]),
        conn.query<RowDataPacket[]>(
          `SELECT idx, code, name, depart_code, DATE_FORMAT(regist_date,'%Y.%m.%d') AS regist_date
           FROM tb_member WHERE mtype='healler' AND instt_code=? AND delete_yn='N'
           ORDER BY regist_date DESC, idx DESC LIMIT 5`, [inst]),
        conn.query<RowDataPacket[]>(
          `SELECT idx, id AS identifier, name, doctor_code, DATE_FORMAT(regist_date,'%Y.%m.%d') AS regist_date
           FROM tb_member WHERE mtype='child' AND instt_code=? AND delete_yn='N'
           ORDER BY regist_date DESC, idx DESC LIMIT 5`, [inst]),
      ])

      return json({
        stats: {
          doctors:    { total: Number(s.doc_total)||0, delta: (Number(s.doc_this)||0)-(Number(s.doc_last)||0), new_count: Number(s.doc_this)||0 },
          therapists: { total: Number(s.th_total)||0,  delta: (Number(s.th_this)||0)-(Number(s.th_last)||0),  new_count: Number(s.th_this)||0 },
          children:   { total: Number(s.ch_total)||0,  delta: (Number(s.ch_this)||0)-(Number(s.ch_last)||0),  new_count: Number(s.ch_this)||0 },
        },
        new_doctors:    (docRows as RowDataPacket[]).map(r => ({ id: r.idx, code: r.code, name: r.name, depart_code: r.depart_code ?? null, regist_date: r.regist_date ?? null })),
        new_therapists: (thRows  as RowDataPacket[]).map(r => ({ id: r.idx, code: r.code, name: r.name, depart_code: r.depart_code ?? null, regist_date: r.regist_date ?? null })),
        new_children:   (cRows   as RowDataPacket[]).map(r => ({ id: r.idx, identifier: r.identifier, name: r.name, regist_date: r.regist_date ?? null, has_doctor: Boolean(r.doctor_code) })),
      })
    }

    // GET /api/support
    if (path === '/api/support' && method === 'GET') {
      const dateFrom = url.searchParams.get('from') ?? ''
      const dateTo   = url.searchParams.get('to')   ?? ''

      let where = `WHERE idx = ? AND delete_yn = 'N'`
      const args: unknown[] = [user.idx]
      if (dateFrom && dateTo) {
        where += ' AND regist_date >= ? AND regist_date <= DATE_ADD(?, INTERVAL 1 DAY)'
        args.push(dateFrom, dateTo)
      }

      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT cs_idx, s_title, s_type,
                DATE_FORMAT(regist_date, '%Y.%m.%d') AS regist_date,
                reply_yn,
                DATE_FORMAT(reply_date, '%Y.%m.%d') AS reply_date
         FROM tb_support ${where}
         ORDER BY cs_idx DESC`,
        args
      )
      return json({ items: rows })
    }

    // POST /api/support
    if (path === '/api/support' && method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        email?: string; s_type?: string; s_title?: string; memo?: string
        files?: { name: string; size: number }[]
      }
      const s_title = (body.s_title ?? '').trim()
      const memo    = (body.memo    ?? '').trim()
      if (!s_title || !memo) return err(400, '제목과 내용을 입력해주세요.')

      const [result] = await conn.query<ResultSetHeader>(
        `INSERT INTO tb_support
           (idx, s_title, memo, code, s_type, email, name, status, reply_yn, delete_yn, regist_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, '01', 'N', 'N', NOW())`,
        [user.idx, s_title, memo, user.instt_code,
         body.s_type ?? '01', body.email ?? '', user.name]
      )
      const csIdx = result.insertId

      const files = body.files ?? []
      for (const f of files) {
        await conn.query(
          `INSERT INTO tb_support_file (cs_idx, file_nm, file_size, source_file_nm, reply_yn, reg_date)
           VALUES (?, '', ?, ?, 'N', NOW())`,
          [csIdx, f.size, f.name]
        )
      }

      return json({ id: csIdx })
    }

    // GET|DELETE /api/support/:id
    const supportIdMatch = path.match(/^\/api\/support\/(\d+)$/)
    if (supportIdMatch) {
      const sid = Number(supportIdMatch[1])

      if (method === 'GET') {
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT cs_idx, s_title, memo, s_type, email, name,
                  DATE_FORMAT(regist_date, '%Y.%m.%d') AS regist_date,
                  reply_yn, reply_memo,
                  DATE_FORMAT(reply_date, '%Y.%m.%d') AS reply_date
           FROM tb_support
           WHERE cs_idx = ? AND idx = ? AND delete_yn = 'N'
           LIMIT 1`,
          [sid, user.idx]
        )
        if (!rows[0]) return err(404, 'not found')

        const [fileRows] = await conn.query<RowDataPacket[]>(
          `SELECT sf_idx, file_nm, source_file_nm, file_size, reply_yn
           FROM tb_support_file WHERE cs_idx = ? ORDER BY sf_idx`,
          [sid]
        )
        type SFile = RowDataPacket & { sf_idx: number; file_nm: string; source_file_nm: string; file_size: number | null; reply_yn: string }
        const files = fileRows as SFile[]
        return json({
          ...rows[0],
          question_files: files.filter(f => f.reply_yn === 'N').map(({ sf_idx, file_nm, source_file_nm, file_size }) => ({ sf_idx, file_nm, source_file_nm, file_size })),
          answer_files:   files.filter(f => f.reply_yn === 'Y').map(({ sf_idx, file_nm, source_file_nm, file_size }) => ({ sf_idx, file_nm, source_file_nm, file_size }))
        })
      }

      if (method === 'DELETE') {
        const [chkRows] = await conn.query<RowDataPacket[]>(
          `SELECT reply_yn FROM tb_support WHERE cs_idx = ? AND idx = ? AND delete_yn = 'N' LIMIT 1`,
          [sid, user.idx]
        )
        if (!chkRows[0]) return err(404, 'not found')
        if ((chkRows[0] as { reply_yn: string }).reply_yn === 'Y')
          return err(400, '이미 답변된 문의는 취소할 수 없습니다.')
        await conn.query(
          `UPDATE tb_support SET delete_yn = 'Y' WHERE cs_idx = ? AND idx = ?`,
          [sid, user.idx]
        )
        return json({ ok: true })
      }
    }

    // GET /api/admin/db-schema?table=xxx  (임시 디버그)
    if (path === '/api/admin/db-schema' && method === 'GET') {
      const table = url.searchParams.get('table') ?? 'tb_board_list'
      const rows = await conn.query(`SHOW COLUMNS FROM \`${table}\``)
      return json({ columns: rows })
    }

    // GET /api/admin/notices?page=1&limit=20&search=
    if (path === '/api/admin/notices' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const page  = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 20))
      const search = url.searchParams.get('search') ?? ''
      const whereArgs: unknown[] = []
      let where = `WHERE BOARD_ID = 'notice'`
      if (search) { where += ' AND BOARD_TITLE LIKE ?'; whereArgs.push(`%${search}%`) }
      let items: unknown[] = [], total = 0
      try {
        const [[cnt]] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM tb_board_list ${where}`, whereArgs
        ) as [RowDataPacket[], unknown]
        total = Number(cnt?.cnt ?? 0)
        // 확장 컬럼(BOARD_OPEN, BOARD_TARGET, WRITE_ID) 시도, 없으면 fallback
        let rows: RowDataPacket[] = []
        const [r] = await conn.query<RowDataPacket[]>(
          `SELECT BOARD_KEY, GUBUN, BOARD_FIXED, BOARD_TITLE, BOARD_READ_COUNT, REPLY_MEMO,
                  DATE_FORMAT(BOARD_SAVE_DATE, '%Y.%m.%d') AS created_at,
                  BOARD_USER_NAME AS author_name
           FROM tb_board_list
           ${where} ORDER BY BOARD_FIXED DESC, BOARD_SAVE_DATE DESC, BOARD_KEY DESC
           LIMIT ? OFFSET ?`,
          [...whereArgs, limit, (page - 1) * limit]
        )
        rows = r as RowDataPacket[]
        items = rows.map(r => ({
          idx:          Number(r.BOARD_KEY),
          is_pinned:    r.BOARD_FIXED === 'Y',
          status:       '공개',
          target_roles: r.REPLY_MEMO ?? '',
          notice_type:  r.GUBUN ?? '',
          title:        r.BOARD_TITLE ?? '',
          views:        Number(r.BOARD_READ_COUNT ?? 0),
          created_at:   r.created_at ?? '-',
          author_name:  r.author_name ?? '-',
        }))
      } catch { /* tb_board_list 없음 */ }
      return json({ items, total })
    }

    // POST /api/admin/notices — 공지 작성
    if (path === '/api/admin/notices' && method === 'POST') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const body = await request.json() as {
        is_pinned?: boolean; target_roles?: string; notice_type?: string
        title?: string; content?: string; status?: string
      }
      if (!body.title?.trim()) return err(400, '제목을 입력해주세요.')
      const pinnedVal = body.is_pinned ? 'Y' : 'N'

      // 실제 컬럼 목록 조회 후 안전하게 INSERT
      type ColInfo = { Field: string; Null: string; Default: string | null; Extra: string; Type: string }
      const [colRows] = await conn.query<RowDataPacket[]>(`SHOW COLUMNS FROM tb_board_list`) as [ColInfo[], unknown]
      const colSet = new Set(colRows.map(c => c.Field))

      const cols: string[] = ['BOARD_ID']
      const vals: unknown[] = ['notice']

      const maybeNum = (col: string, val: number) => {
        if (colSet.has(col)) { cols.push(col); vals.push(val) }
      }
      const maybeStr = (col: string, val: string) => {
        if (colSet.has(col)) { cols.push(col); vals.push(val) }
      }

      maybeNum('BOARD_REF', 0)
      maybeNum('BOARD_STEP', 0)
      maybeNum('BOARD_REF_LEVEL', 0)
      maybeStr('BOARD_FIXED', pinnedVal)
      maybeStr('REPLY_MEMO', body.target_roles ?? '')   // 노출대상 저장
      maybeStr('GUBUN', (body.notice_type ?? '').substring(0, 10))
      maybeStr('BOARD_TITLE', body.title)
      maybeStr('BOARD_CONTENT', body.content ?? '')
      maybeStr('BOARD_USER_ID', String(user.id ?? ''))
      maybeStr('BOARD_USER_NAME', String(user.name ?? user.id ?? ''))

      // NOT NULL + no default 인 컬럼에 빠진 게 있으면 0/''/NOW() 으로 채우기
      for (const c of colRows) {
        if (cols.includes(c.Field)) continue
        if (c.Null === 'NO' && c.Default === null && c.Extra !== 'auto_increment') {
          const colType = c.Type ?? ''
          cols.push(c.Field)
          vals.push(colType.includes('int') ? 0 : '')
        }
      }

      const placeholders = vals.slice(1).map(() => '?')
      const sql = `INSERT INTO tb_board_list (${cols.join(', ')}) VALUES ('notice', ${placeholders.join(', ')})`
      try {
        await conn.query(sql, vals.slice(1))
        return json({ ok: true })
      } catch (e) {
        return err(500, `공지 저장 실패: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // GET /api/admin/notices/:id — 단건 조회
    const noticeItemMatch = path.match(/^\/api\/admin\/notices\/(\d+)$/)
    if (noticeItemMatch && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const id = Number(noticeItemMatch[1])
      const [[row]] = await conn.query<RowDataPacket[]>(
        `SELECT BOARD_KEY, GUBUN, BOARD_FIXED, BOARD_TITLE, BOARD_CONTENT, REPLY_MEMO
         FROM tb_board_list WHERE BOARD_ID = 'notice' AND BOARD_KEY = ? LIMIT 1`, [id]
      ) as [RowDataPacket[], unknown]
      if (!row) return err(404, '공지를 찾을 수 없습니다.')
      return json({
        idx:          Number(row.BOARD_KEY),
        is_pinned:    row.BOARD_FIXED === 'Y',
        notice_type:  row.GUBUN ?? '',
        title:        row.BOARD_TITLE ?? '',
        content:      row.BOARD_CONTENT ?? '',
        status:       'public',
        target_roles: row.REPLY_MEMO ?? '',
      })
    }

    // PUT /api/admin/notices/:id — 수정
    if (noticeItemMatch && method === 'PUT') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const id = Number(noticeItemMatch[1])
      const body = await request.json() as {
        is_pinned?: boolean; target_roles?: string; notice_type?: string
        title?: string; content?: string; status?: string
      }
      if (!body.title?.trim()) return err(400, '제목을 입력해주세요.')
      const pinnedVal = body.is_pinned ? 'Y' : 'N'
      await conn.query(
        `UPDATE tb_board_list SET BOARD_FIXED=?, REPLY_MEMO=?, GUBUN=?, BOARD_TITLE=?, BOARD_CONTENT=?, UPDATE_DATE=NOW()
         WHERE BOARD_ID='notice' AND BOARD_KEY=?`,
        [pinnedVal, body.target_roles ?? '', (body.notice_type ?? '').substring(0, 10),
         body.title, body.content ?? '', id]
      )
      return json({ ok: true })
    }

    // DELETE /api/admin/notices  body: { idxs: number[] }
    if (path === '/api/admin/notices' && method === 'DELETE') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const body = await request.json() as { idxs?: number[] }
      if (!body.idxs?.length) return err(400, '필수 항목 누락')
      try {
        await conn.query(
          `DELETE FROM tb_board_list WHERE BOARD_ID = 'notice' AND BOARD_KEY IN (${body.idxs.map(() => '?').join(',')})`,
          body.idxs
        )
      } catch { /* 무시 */ }
      return json({ ok: true })
    }

    // ── 1:1 문의사항 CRUD (admin) ────────────────────────────
    // GET /api/admin/cs
    if (path === '/api/admin/cs' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const page  = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 20))
      const search = url.searchParams.get('search') ?? ''
      const whereArgs: unknown[] = []
      let where = `WHERE s.delete_yn = 'N'`
      if (search) { where += ` AND (s.s_title LIKE ? OR s.name LIKE ?)`; whereArgs.push(`%${search}%`, `%${search}%`) }
      const [[cnt]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_support s ${where}`, whereArgs
      ) as [RowDataPacket[], unknown]
      const total = Number((cnt as RowDataPacket).cnt ?? 0)
      const [[ucnt]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_support WHERE delete_yn='N' AND reply_yn='N'`
      ) as [RowDataPacket[], unknown]
      const unanswered = Number((ucnt as RowDataPacket).cnt ?? 0)
      const [rows] = await conn.query<RowDataPacket[]>(
        `SELECT s.cs_idx, s.s_type, s.name, m.id AS user_id, s.reply_yn, s.s_title,
                DATE_FORMAT(s.regist_date, '%Y.%m.%d') AS regist_date,
                DATE_FORMAT(s.reply_date, '%Y.%m.%d') AS reply_date
         FROM tb_support s LEFT JOIN tb_member m ON s.idx = m.idx
         ${where} ORDER BY s.cs_idx DESC LIMIT ? OFFSET ?`,
        [...whereArgs, limit, (page - 1) * limit]
      ) as [RowDataPacket[], unknown]
      return json({ items: rows, total, unanswered })
    }

    // GET|DELETE /api/admin/cs/files/:sf_idx — 파일 다운로드/삭제
    // 필요 DB: ALTER TABLE tb_support_file ADD COLUMN IF NOT EXISTS file_data LONGTEXT NULL;
    const adminCsFileMatch = path.match(/^\/api\/admin\/cs\/files\/(\d+)$/)
    if (adminCsFileMatch) {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const sfIdx = Number(adminCsFileMatch[1])
      if (method === 'GET') {
        try {
          const [[row]] = await conn.query<RowDataPacket[]>(
            `SELECT source_file_nm, file_data FROM tb_support_file WHERE sf_idx = ? LIMIT 1`,
            [sfIdx]
          ) as [RowDataPacket[], unknown]
          if (!row) return err(404, '파일을 찾을 수 없습니다.')
          if (!row.file_data) return err(404, '파일 데이터가 없습니다.')
          return json({ source_file_nm: row.source_file_nm, file_data: row.file_data })
        } catch { return err(404, '파일을 찾을 수 없습니다.') }
      }
      if (method === 'DELETE') {
        try {
          await conn.query(`DELETE FROM tb_support_file WHERE sf_idx = ? AND reply_yn = 'Y'`, [sfIdx])
          return json({ ok: true })
        } catch { return err(500, '파일 삭제 실패') }
      }
    }

    // GET|PUT /api/admin/cs/:id
    const adminCsMatch = path.match(/^\/api\/admin\/cs\/(\d+)$/)
    if (adminCsMatch) {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const id = Number(adminCsMatch[1])

      if (method === 'GET') {
        const [[csRow]] = await conn.query<RowDataPacket[]>(
          `SELECT s.cs_idx, s.s_title, s.memo, s.s_type, s.email, s.name, m.id AS user_id,
                  DATE_FORMAT(s.regist_date, '%Y.%m.%d') AS regist_date,
                  s.reply_yn, s.reply_memo,
                  DATE_FORMAT(s.reply_date, '%Y.%m.%d') AS reply_date
           FROM tb_support s LEFT JOIN tb_member m ON s.idx = m.idx
           WHERE s.cs_idx = ? AND s.delete_yn = 'N' LIMIT 1`,
          [id]
        ) as [RowDataPacket[], unknown]
        if (!csRow) return err(404, '문의사항을 찾을 수 없습니다.')
        const [csFiles] = await conn.query<RowDataPacket[]>(
          `SELECT sf_idx, file_nm, source_file_nm, file_size, reply_yn FROM tb_support_file WHERE cs_idx = ? ORDER BY sf_idx`,
          [id]
        ) as [RowDataPacket[], unknown]
        type CSFile = { sf_idx: number; file_nm: string; source_file_nm: string; file_size: number | null; reply_yn: string }
        const cfiles = csFiles as CSFile[]
        return json({
          ...csRow,
          question_files: cfiles.filter(f => f.reply_yn === 'N').map(({ sf_idx, file_nm, source_file_nm, file_size }) => ({ sf_idx, file_nm, source_file_nm, file_size })),
          answer_files:   cfiles.filter(f => f.reply_yn === 'Y').map(({ sf_idx, file_nm, source_file_nm, file_size }) => ({ sf_idx, file_nm, source_file_nm, file_size })),
        })
      }

      if (method === 'PUT') {
        const body = await request.json() as {
          reply_memo?: string
          answer_files?: { name: string; size: number; data: string }[]
        }
        if (!body.reply_memo?.trim()) return err(400, '답변 내용을 입력해주세요.')
        try {
          await conn.query(
            `UPDATE tb_support SET reply_yn='Y', reply_memo=?, reply_date=NOW() WHERE cs_idx=? AND delete_yn='N'`,
            [body.reply_memo, id]
          )
          if (body.answer_files?.length) {
            for (const f of body.answer_files) {
              try {
                await conn.query(
                  `INSERT INTO tb_support_file (cs_idx, file_nm, file_size, source_file_nm, reply_yn, file_data, reg_date)
                   VALUES (?, '', ?, ?, 'Y', ?, NOW())`,
                  [id, f.size, f.name, f.data ?? null]
                )
              } catch {
                await conn.query(
                  `INSERT INTO tb_support_file (cs_idx, file_nm, file_size, source_file_nm, reply_yn, reg_date)
                   VALUES (?, '', ?, ?, 'Y', NOW())`,
                  [id, f.size, f.name]
                )
              }
            }
          }
          return json({ ok: true, replier: String(user.name ?? user.id ?? '') })
        } catch (e) {
          return err(500, `답변 저장 실패: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }

    // ── FAQ CRUD ─────────────────────────────────────────────
    // GET /api/admin/faq?page=1&limit=20&search=
    if (path === '/api/admin/faq' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const page  = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const limit = Math.min(100, Number(url.searchParams.get('limit') ?? 20))
      const search = url.searchParams.get('search') ?? ''
      const whereArgs: unknown[] = []
      let where = `WHERE BOARD_ID = 'faq'`
      if (search) { where += ' AND BOARD_TITLE LIKE ?'; whereArgs.push(`%${search}%`) }
      let items: unknown[] = [], total = 0
      try {
        const [[cnt]] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM tb_board_list ${where}`, whereArgs
        ) as [RowDataPacket[], unknown]
        total = Number(cnt?.cnt ?? 0)
        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT BOARD_KEY, GUBUN, BOARD_FIXED, BOARD_TITLE, BOARD_READ_COUNT, REPLY_MEMO,
                  DATE_FORMAT(BOARD_SAVE_DATE, '%Y.%m.%d') AS created_at,
                  BOARD_USER_NAME AS author_name
           FROM tb_board_list ${where}
           ORDER BY BOARD_SAVE_DATE DESC, BOARD_KEY DESC LIMIT ? OFFSET ?`,
          [...whereArgs, limit, (page - 1) * limit]
        ) as [RowDataPacket[], unknown]
        items = (rows as RowDataPacket[]).map(r => ({
          idx:          Number(r.BOARD_KEY),
          status:       r.BOARD_FIXED === 'N' ? '비공개' : '공개',
          target_roles: r.REPLY_MEMO ?? '',
          category:     r.GUBUN ?? '',
          title:        r.BOARD_TITLE ?? '',
          views:        Number(r.BOARD_READ_COUNT ?? 0),
          created_at:   r.created_at ?? '-',
          author_name:  r.author_name ?? '-',
        }))
      } catch { /* 무시 */ }
      return json({ items, total })
    }

    // POST /api/admin/faq
    if (path === '/api/admin/faq' && method === 'POST') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const body = await request.json() as {
        status?: string; target_roles?: string; category?: string
        title?: string; content?: string
      }
      if (!body.title?.trim()) return err(400, '제목을 입력해주세요.')
      const fixedVal = body.status === 'private' ? 'N' : 'Y'
      type ColInfo2 = { Field: string; Null: string; Default: string | null; Extra: string; Type: string }
      const [colRows2] = await conn.query<RowDataPacket[]>(`SHOW COLUMNS FROM tb_board_list`) as [ColInfo2[], unknown]
      const colSet2 = new Set((colRows2 as ColInfo2[]).map(c => c.Field))
      const cols2: string[] = ['BOARD_ID']
      const vals2: unknown[] = ['faq']
      const mNum = (col: string, val: number) => { if (colSet2.has(col)) { cols2.push(col); vals2.push(val) } }
      const mStr = (col: string, val: string) => { if (colSet2.has(col)) { cols2.push(col); vals2.push(val) } }
      mNum('BOARD_REF', 0); mNum('BOARD_STEP', 0); mNum('BOARD_REF_LEVEL', 0)
      mStr('BOARD_FIXED', fixedVal)
      mStr('REPLY_MEMO', body.target_roles ?? '')
      mStr('GUBUN', (body.category ?? '').substring(0, 20))
      mStr('BOARD_TITLE', body.title)
      mStr('BOARD_CONTENT', body.content ?? '')
      mStr('BOARD_USER_ID', String(user.id ?? ''))
      mStr('BOARD_USER_NAME', String(user.name ?? user.id ?? ''))
      for (const c of (colRows2 as ColInfo2[])) {
        if (cols2.includes(c.Field)) continue
        if (c.Null === 'NO' && c.Default === null && c.Extra !== 'auto_increment') {
          cols2.push(c.Field); vals2.push(c.Type?.includes('int') ? 0 : '')
        }
      }
      const sql2 = `INSERT INTO tb_board_list (${cols2.join(', ')}) VALUES ('faq', ${vals2.slice(1).map(() => '?').join(', ')})`
      try {
        await conn.query(sql2, vals2.slice(1))
        return json({ ok: true })
      } catch (e) {
        return err(500, `FAQ 저장 실패: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // GET /api/admin/faq/:id
    const faqItemMatch = path.match(/^\/api\/admin\/faq\/(\d+)$/)
    if (faqItemMatch && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const id = Number(faqItemMatch[1])
      const [[row2]] = await conn.query<RowDataPacket[]>(
        `SELECT BOARD_KEY, GUBUN, BOARD_FIXED, BOARD_TITLE, BOARD_CONTENT, REPLY_MEMO
         FROM tb_board_list WHERE BOARD_ID = 'faq' AND BOARD_KEY = ? LIMIT 1`, [id]
      ) as [RowDataPacket[], unknown]
      if (!row2) return err(404, 'FAQ를 찾을 수 없습니다.')
      return json({
        idx:          Number(row2.BOARD_KEY),
        status:       row2.BOARD_FIXED === 'N' ? 'private' : 'public',
        category:     row2.GUBUN ?? '',
        title:        row2.BOARD_TITLE ?? '',
        content:      row2.BOARD_CONTENT ?? '',
        target_roles: row2.REPLY_MEMO ?? '',
      })
    }

    // PUT /api/admin/faq/:id
    if (faqItemMatch && method === 'PUT') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const id = Number(faqItemMatch[1])
      const body = await request.json() as {
        status?: string; target_roles?: string; category?: string
        title?: string; content?: string
      }
      if (!body.title?.trim()) return err(400, '제목을 입력해주세요.')
      await conn.query(
        `UPDATE tb_board_list SET BOARD_FIXED=?, REPLY_MEMO=?, GUBUN=?, BOARD_TITLE=?, BOARD_CONTENT=?, UPDATE_DATE=NOW()
         WHERE BOARD_ID='faq' AND BOARD_KEY=?`,
        [body.status === 'private' ? 'N' : 'Y', body.target_roles ?? '',
         (body.category ?? '').substring(0, 20), body.title, body.content ?? '', id]
      )
      return json({ ok: true })
    }

    // DELETE /api/admin/faq
    if (path === '/api/admin/faq' && method === 'DELETE') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const body = await request.json() as { idxs?: number[] }
      if (!body.idxs?.length) return err(400, '필수 항목 누락')
      await conn.query(
        `DELETE FROM tb_board_list WHERE BOARD_ID = 'faq' AND BOARD_KEY IN (${body.idxs.map(() => '?').join(',')})`,
        body.idxs
      )
      return json({ ok: true })
    }

    // GET /api/admin/institution-entities?page=1&search=
    if (path === '/api/admin/institution-entities' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
      const PAGE_SIZE = 20
      const search = (url.searchParams.get('search') ?? '').trim()
      const sArgs = search ? [`%${search}%`, `%${search}%`] : []
      const sClause = search ? `AND (m.instt_code LIKE ? OR i.inst_name LIKE ?)` : ''

      let items: unknown[] = [], total = 0
      try {
        const [[cntRow]] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(DISTINCT m.instt_code) AS cnt
           FROM tb_member m
           LEFT JOIN tb_institution i ON i.code = m.instt_code
           WHERE m.instt_code IS NOT NULL AND m.instt_code != ''
             AND m.delete_yn='N' AND m.approval_status IS NULL
             AND m.mtype IN ('iadmin','doctor','healler','child')
             ${sClause}`,
          sArgs
        ) as [RowDataPacket[], unknown]
        total = Number(cntRow?.cnt ?? 0)

        const [rows] = await conn.query<RowDataPacket[]>(
          `SELECT m.instt_code,
                  COALESCE(MAX(i.inst_name), m.instt_code) AS inst_name,
                  MAX(i.inst_type) AS inst_type,
                  MAX(i.address) AS address,
                  COUNT(DISTINCT CASE WHEN m.mtype='iadmin' THEN m.idx END) AS admin_count,
                  COUNT(DISTINCT CASE WHEN m.mtype='doctor' THEN m.idx END) AS doctor_count,
                  COUNT(DISTINCT CASE WHEN m.mtype='healler' THEN m.idx END) AS therapist_count,
                  COUNT(DISTINCT CASE WHEN m.mtype='child' THEN m.idx END) AS child_count,
                  DATE_FORMAT(MIN(CASE WHEN m.mtype='iadmin' THEN m.regist_date END), '%Y.%m.%d') AS regist_date
           FROM tb_member m
           LEFT JOIN tb_institution i ON i.code = m.instt_code
           WHERE m.instt_code IS NOT NULL AND m.instt_code != ''
             AND m.delete_yn='N' AND m.approval_status IS NULL
             AND m.mtype IN ('iadmin','doctor','healler','child')
             ${sClause}
           GROUP BY m.instt_code
           ORDER BY MIN(CASE WHEN m.mtype='iadmin' THEN m.regist_date END) DESC
           LIMIT ? OFFSET ?`,
          [...sArgs, PAGE_SIZE, (page - 1) * PAGE_SIZE]
        ) as [RowDataPacket[], unknown]

        items = (rows as RowDataPacket[]).map(r => ({
          instt_code:      r.instt_code,
          inst_name:       r.inst_name ?? '',
          inst_type:       r.inst_type ?? '-',
          address:         r.address ?? '-',
          admin_count:     Number(r.admin_count ?? 0),
          doctor_count:    Number(r.doctor_count ?? 0),
          therapist_count: Number(r.therapist_count ?? 0),
          child_count:     Number(r.child_count ?? 0),
          regist_date:     r.regist_date ?? '-',
        }))
      } catch { /* ignore schema differences */ }

      return json({ items, total })
    }

    // GET /api/admin/dashboard-data
    if (path === '/api/admin/dashboard-data' && method === 'GET') {
      if (!['sadmin', 'wadmin'].includes(user.mtype)) return err(403, 'forbidden')
      const webMtypes = `'doctor','healler','iadmin'`

      const [[inst]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(DISTINCT instt_code) AS cnt FROM tb_member WHERE mtype IN (${webMtypes}) AND delete_yn='N' AND approval_status IS NULL`
      ) as [RowDataPacket[], unknown]
      const [[web]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_member WHERE mtype IN (${webMtypes}) AND delete_yn='N' AND approval_status IS NULL`
      ) as [RowDataPacket[], unknown]
      const [[app]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_member WHERE mtype='child' AND delete_yn='N'`
      ) as [RowDataPacket[], unknown]
      const [[monthly]] = await conn.query<RowDataPacket[]>(
        `SELECT
           SUM(mtype IN (${webMtypes}) AND delete_yn='N' AND approval_status IS NULL AND regist_date >= DATE_FORMAT(NOW(),'%Y-%m-01')) AS new_web_this,
           SUM(mtype IN (${webMtypes}) AND delete_yn='N' AND approval_status IS NULL AND regist_date >= DATE_FORMAT(DATE_SUB(NOW(),INTERVAL 1 MONTH),'%Y-%m-01') AND regist_date < DATE_FORMAT(NOW(),'%Y-%m-01')) AS new_web_last,
           SUM(mtype='child' AND delete_yn='N' AND regist_date >= DATE_FORMAT(NOW(),'%Y-%m-01')) AS new_app_this,
           SUM(mtype='child' AND delete_yn='N' AND regist_date >= DATE_FORMAT(DATE_SUB(NOW(),INTERVAL 1 MONTH),'%Y-%m-01') AND regist_date < DATE_FORMAT(NOW(),'%Y-%m-01')) AS new_app_last
         FROM tb_member`
      ) as [RowDataPacket[], unknown]

      type MauSet = { mau:number; wau:number; dau:number; mau_change:number; wau_change:number; dau_change:number }
      let mau_stats: { web: MauSet; app: MauSet } = {
        web: { mau:0, wau:0, dau:0, mau_change:0, wau_change:0, dau_change:0 },
        app: { mau:0, wau:0, dau:0, mau_change:0, wau_change:0, dau_change:0 },
      }
      const buildMau = (ms: RowDataPacket, prefix: string): MauSet => ({
        mau: Number(ms[`${prefix}mau`] ?? 0),
        wau: Number(ms[`${prefix}wau`] ?? 0),
        dau: Number(ms[`${prefix}dau`] ?? 0),
        mau_change: Number(ms[`${prefix}mau`] ?? 0) - Number(ms[`${prefix}mau_prev`] ?? 0),
        wau_change: Number(ms[`${prefix}wau`] ?? 0) - Number(ms[`${prefix}wau_prev`] ?? 0),
        dau_change: Number(ms[`${prefix}dau`] ?? 0) - Number(ms[`${prefix}dau_prev`] ?? 0),
      })
      try {
        const [[ms]] = await conn.query<RowDataPacket[]>(
          `SELECT
             COUNT(DISTINCT CASE WHEN m.mtype IN (${webMtypes}) AND l.login_date >= DATE_FORMAT(NOW(),'%Y-%m-01') THEN l.member_idx END) AS web_mau,
             COUNT(DISTINCT CASE WHEN m.mtype IN (${webMtypes}) AND l.login_date >= DATE_SUB(NOW(),INTERVAL 7 DAY) THEN l.member_idx END) AS web_wau,
             COUNT(DISTINCT CASE WHEN m.mtype IN (${webMtypes}) AND DATE(l.login_date)=CURDATE() THEN l.member_idx END) AS web_dau,
             COUNT(DISTINCT CASE WHEN m.mtype IN (${webMtypes}) AND l.login_date >= DATE_FORMAT(DATE_SUB(NOW(),INTERVAL 1 MONTH),'%Y-%m-01') AND l.login_date < DATE_FORMAT(NOW(),'%Y-%m-01') THEN l.member_idx END) AS web_mau_prev,
             COUNT(DISTINCT CASE WHEN m.mtype IN (${webMtypes}) AND l.login_date >= DATE_SUB(NOW(),INTERVAL 14 DAY) AND l.login_date < DATE_SUB(NOW(),INTERVAL 7 DAY) THEN l.member_idx END) AS web_wau_prev,
             COUNT(DISTINCT CASE WHEN m.mtype IN (${webMtypes}) AND DATE(l.login_date)=DATE_SUB(CURDATE(),INTERVAL 1 DAY) THEN l.member_idx END) AS web_dau_prev,
             COUNT(DISTINCT CASE WHEN m.mtype='child' AND l.login_date >= DATE_FORMAT(NOW(),'%Y-%m-01') THEN l.member_idx END) AS app_mau,
             COUNT(DISTINCT CASE WHEN m.mtype='child' AND l.login_date >= DATE_SUB(NOW(),INTERVAL 7 DAY) THEN l.member_idx END) AS app_wau,
             COUNT(DISTINCT CASE WHEN m.mtype='child' AND DATE(l.login_date)=CURDATE() THEN l.member_idx END) AS app_dau,
             COUNT(DISTINCT CASE WHEN m.mtype='child' AND l.login_date >= DATE_FORMAT(DATE_SUB(NOW(),INTERVAL 1 MONTH),'%Y-%m-01') AND l.login_date < DATE_FORMAT(NOW(),'%Y-%m-01') THEN l.member_idx END) AS app_mau_prev,
             COUNT(DISTINCT CASE WHEN m.mtype='child' AND l.login_date >= DATE_SUB(NOW(),INTERVAL 14 DAY) AND l.login_date < DATE_SUB(NOW(),INTERVAL 7 DAY) THEN l.member_idx END) AS app_wau_prev,
             COUNT(DISTINCT CASE WHEN m.mtype='child' AND DATE(l.login_date)=DATE_SUB(CURDATE(),INTERVAL 1 DAY) THEN l.member_idx END) AS app_dau_prev
           FROM tb_login_log l JOIN tb_member m ON m.idx=l.member_idx AND m.delete_yn='N'`
        ) as [RowDataPacket[], unknown]
        mau_stats = { web: buildMau(ms as RowDataPacket, 'web_'), app: buildMau(ms as RowDataPacket, 'app_') }
      } catch {
        // fallback: use regist_date instead of login_date
        try {
          const [[ms]] = await conn.query<RowDataPacket[]>(
            `SELECT
               SUM(mtype IN (${webMtypes}) AND delete_yn='N' AND approval_status IS NULL AND regist_date >= DATE_FORMAT(NOW(),'%Y-%m-01')) AS web_mau,
               SUM(mtype IN (${webMtypes}) AND delete_yn='N' AND approval_status IS NULL AND regist_date >= DATE_SUB(NOW(),INTERVAL 7 DAY)) AS web_wau,
               SUM(mtype IN (${webMtypes}) AND delete_yn='N' AND approval_status IS NULL AND DATE(regist_date)=CURDATE()) AS web_dau,
               SUM(mtype IN (${webMtypes}) AND delete_yn='N' AND approval_status IS NULL AND regist_date >= DATE_FORMAT(DATE_SUB(NOW(),INTERVAL 1 MONTH),'%Y-%m-01') AND regist_date < DATE_FORMAT(NOW(),'%Y-%m-01')) AS web_mau_prev,
               SUM(mtype IN (${webMtypes}) AND delete_yn='N' AND approval_status IS NULL AND regist_date >= DATE_SUB(NOW(),INTERVAL 14 DAY) AND regist_date < DATE_SUB(NOW(),INTERVAL 7 DAY)) AS web_wau_prev,
               SUM(mtype IN (${webMtypes}) AND delete_yn='N' AND approval_status IS NULL AND DATE(regist_date)=DATE_SUB(CURDATE(),INTERVAL 1 DAY)) AS web_dau_prev,
               SUM(mtype='child' AND delete_yn='N' AND regist_date >= DATE_FORMAT(NOW(),'%Y-%m-01')) AS app_mau,
               SUM(mtype='child' AND delete_yn='N' AND regist_date >= DATE_SUB(NOW(),INTERVAL 7 DAY)) AS app_wau,
               SUM(mtype='child' AND delete_yn='N' AND DATE(regist_date)=CURDATE()) AS app_dau,
               SUM(mtype='child' AND delete_yn='N' AND regist_date >= DATE_FORMAT(DATE_SUB(NOW(),INTERVAL 1 MONTH),'%Y-%m-01') AND regist_date < DATE_FORMAT(NOW(),'%Y-%m-01')) AS app_mau_prev,
               SUM(mtype='child' AND delete_yn='N' AND regist_date >= DATE_SUB(NOW(),INTERVAL 14 DAY) AND regist_date < DATE_SUB(NOW(),INTERVAL 7 DAY)) AS app_wau_prev,
               SUM(mtype='child' AND delete_yn='N' AND DATE(regist_date)=DATE_SUB(CURDATE(),INTERVAL 1 DAY)) AS app_dau_prev
             FROM tb_member`
          ) as [RowDataPacket[], unknown]
          mau_stats = { web: buildMau(ms as RowDataPacket, 'web_'), app: buildMau(ms as RowDataPacket, 'app_') }
        } catch { /* ignore */ }
      }

      const [[pendingCnt]] = await conn.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS cnt FROM tb_member WHERE approval_status='승인대기' AND delete_yn='N'`
      ) as [RowDataPacket[], unknown]
      const [pendingRows] = await conn.query<RowDataPacket[]>(
        `SELECT m.idx, m.name, m.mtype, m.instt_code, DATE_FORMAT(m.regist_date,'%Y.%m.%d') AS regist_date,
                i.inst_name
         FROM tb_member m
         LEFT JOIN tb_institution i ON i.code = m.instt_code
         WHERE m.approval_status='승인대기' AND m.delete_yn='N'
         ORDER BY m.regist_date DESC LIMIT 5`
      ) as [RowDataPacket[], unknown]

      let inquiries: unknown[] = [], unanswered_total = 0
      try {
        const [[ucnt]] = await conn.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM tb_support WHERE delete_yn='N' AND reply_yn='N'`
        ) as [RowDataPacket[], unknown]
        unanswered_total = Number(ucnt?.cnt ?? 0)
        const [iqRows] = await conn.query<RowDataPacket[]>(
          `SELECT s.cs_idx, s.name, s.s_title, DATE_FORMAT(s.regist_date,'%Y.%m.%d') AS regist_date, s.s_type
           FROM tb_support s WHERE s.delete_yn='N' AND s.reply_yn='N'
           ORDER BY s.cs_idx DESC LIMIT 5`
        ) as [RowDataPacket[], unknown]
        inquiries = iqRows
      } catch { /* no support table */ }

      let pinned_notices: unknown[] = [], recent_notices: unknown[] = []
      try {
        const [pRows] = await conn.query<RowDataPacket[]>(
          `SELECT BOARD_KEY AS idx, BOARD_TITLE AS title, DATE_FORMAT(BOARD_SAVE_DATE,'%Y.%m.%d') AS created_at
           FROM tb_board_list WHERE BOARD_ID='notice' AND BOARD_FIXED='Y'
           ORDER BY BOARD_SAVE_DATE DESC LIMIT 5`
        ) as [RowDataPacket[], unknown]
        pinned_notices = pRows
        const [rRows] = await conn.query<RowDataPacket[]>(
          `SELECT BOARD_KEY AS idx, BOARD_TITLE AS title, DATE_FORMAT(BOARD_SAVE_DATE,'%Y.%m.%d') AS created_at
           FROM tb_board_list WHERE BOARD_ID='notice' AND (BOARD_FIXED IS NULL OR BOARD_FIXED='N')
           ORDER BY BOARD_SAVE_DATE DESC LIMIT 5`
        ) as [RowDataPacket[], unknown]
        recent_notices = rRows
      } catch { /* no notice table */ }

      return json({
        stats: {
          total_institutions: Number((inst as {cnt:number}).cnt),
          total_web_users:    Number((web  as {cnt:number}).cnt),
          total_app_users:    Number((app  as {cnt:number}).cnt),
          new_web_this_month: Number((monthly as RowDataPacket)?.new_web_this ?? 0),
          new_web_last_month: Number((monthly as RowDataPacket)?.new_web_last ?? 0),
          new_app_this_month: Number((monthly as RowDataPacket)?.new_app_this ?? 0),
          new_app_last_month: Number((monthly as RowDataPacket)?.new_app_last ?? 0),
        },
        mau_stats,
        pending_total: Number((pendingCnt as RowDataPacket).cnt ?? 0),
        pending_approvals: (pendingRows as RowDataPacket[]).map(r => ({
          idx:        r.idx,
          name:       r.name,
          inst_name:  r.inst_name ?? '',
          role:       r.mtype === 'healler' ? '치료사' : r.mtype === 'iadmin' ? '기관관리자' : r.mtype,
          instt_code: r.instt_code,
          regist_date: r.regist_date,
        })),
        unanswered_total,
        inquiries,
        pinned_notices,
        recent_notices,
      })
    }

    return err(404, `Unknown route: ${method} ${path}`)

  } catch (e: unknown) {
    return err(500, e instanceof Error ? e.message : 'internal error')
  }
}
