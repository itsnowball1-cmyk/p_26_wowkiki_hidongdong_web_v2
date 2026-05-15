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

function ageLabel(birthDate: unknown): string | null {
  if (!birthDate) return null
  const bd = birthDate instanceof Date ? birthDate : new Date(birthDate as string)
  if (isNaN(bd.getTime())) return null
  return `만 ${Math.floor((Date.now() - bd.getTime()) / (365.25 * 24 * 3600 * 1000))}세`
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
    `SELECT idx, id, code, mtype, name, instt_code, depart_code
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
    `SELECT idx, id, code, mtype, pw, name, instt_code, depart_code
     FROM tb_member
     WHERE id = ? AND mtype IN (${ph(mtypes.length)}) AND delete_yn = 'N'
     LIMIT 1`,
    [id, ...mtypes]
  )
  const row = rows[0]
  if (!row || row.pw !== pw) return err(401, LOGIN_FAIL_MSG)

  return json({
    id:              row.id,
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
      }
      const { role, id, pw, name, phone, email, instt_code, depart_code } = body
      if (!role || !id || !pw || !name || !instt_code) return err(400, '필수 항목이 누락되었습니다.')
      if (role !== 'doctor' && role !== 'therapist') return err(400, '유효하지 않은 역할입니다.')

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

      await conn.query(
        `INSERT INTO tb_member (id, pw, code, mtype, name, phone, email, instt_code, depart_code, delete_yn, regist_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'N', NOW())`,
        [id, pw, code, mtype, name, phone ?? null, email ?? null, instt_code, depart_code ?? null]
      )
      return json({ ok: true, code })
    }

    // MariaDB 연결 확인용 — 전환 완료 후 제거
    if (path === '/api/db-ping' && method === 'GET') {
      const [[{ v }]] = await conn.query('SELECT ? AS v', ['pong']) as [Array<{ v: string }>, unknown]
      return json({ ok: true, echo: v })
    }

    // ── 인증 필요 ────────────────────────────────────────────────────────────

    const user = await getCurrentUser(conn, request)
    if (!user) return err(401, 'unauthorized')

    // GET /api/me
    if (path === '/api/me' && method === 'GET') {
      return json({
        id:              user.id,
        name:            user.name,
        role:            mtypeToRole(user.mtype),
        institutionCode: user.instt_code,
        department:      user.depart_code ?? null,
        schedule:        null
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
      return json(rows)
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
           c.idx AS id,
           c.id  AS identifier,
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
      type CRow = RowDataPacket & { id: number; identifier: string; therapist_name: string | null; latest_training_log: string | null; last_diagnosis: string | null }
      return json((rows as CRow[]).map(r => {
        const p = parseAnalysislog(r.latest_training_log)
        return {
          id:             r.id,
          identifier:     r.identifier,
          therapist_name: r.therapist_name ?? '-',
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
      const child = childRows[0] as { id: number; child_member_id: string; therapist_name: string | null; doctor_name: string | null }

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
           d.idx                  AS doctor_id,
           d.name                 AS doctor_name,
           d.depart_code          AS doctor_department,
           t.idx                  AS therapist_id,
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

      const updatedAt = fmtDate(child.update_date) ?? new Date().toISOString().slice(0, 10).replace(/-/g, '.')
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
        codeWhere = 'AND s.doctor_code = ?'; args.push(staffCode)
      } else if (user.mtype === 'healler') {
        codeWhere = 'AND s.teacher_code = ?'; args.push(staffCode)
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
                  d.name        AS doctor_name,
                  t.name        AS therapist_name
           FROM tb_schedule s
           JOIN tb_member c  ON c.id  = s.child_id     AND c.mtype = 'child'   AND c.delete_yn = 'N'
           LEFT JOIN tb_member d ON d.code = s.doctor_code  AND d.mtype = 'doctor'  AND d.delete_yn = 'N'
           LEFT JOIN tb_member t ON t.code = s.teacher_code AND t.mtype = 'healler' AND t.delete_yn = 'N'
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

    return err(404, `Unknown route: ${method} ${path}`)

  } catch (e: unknown) {
    return err(500, e instanceof Error ? e.message : 'internal error')
  }
}
