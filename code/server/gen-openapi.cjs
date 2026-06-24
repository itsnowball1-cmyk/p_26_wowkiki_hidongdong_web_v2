/* eslint-disable */
// api.ts 의 손수 작성된 라우터(if (path === ...) / path.match)를 파싱해 OpenAPI 3.0 스펙을
// server/openapi.gen.ts 로 생성한다. 라우트가 바뀌면 `node server/gen-openapi.cjs` 재실행.
//
// 인증: getCurrentUser 가 x-user-id 헤더(사용자 로그인 id)로 조회 → 그 라인 이후 라우트는 보호됨.
const fs = require('fs')
const path = require('path')

const SRC = path.join(__dirname, 'api.ts')
const OUT = path.join(__dirname, 'openapi.gen.ts')
const lines = fs.readFileSync(SRC, 'utf8').split(/\r?\n/)
const authLineIdx = lines.findIndex(l => l.includes('const user = await getCurrentUser'))
const authBoundary = authLineIdx === -1 ? Infinity : authLineIdx

// Unity 레거시 평문 엔드포인트(블록형이라 파서가 놓침) — 명시적으로 포함
const LEGACY_PATHS = [
  '/test', '/alogin', '/signup', '/member_list', '/samename_child_list',
  '/child_detail', '/child_actlog_list', '/child_actlog_detail',
  '/save_child_actlog', '/load_trainingset', '/save_trainingset',
  '/generate-uuid', '/storage/fileup_duck', '/storage/filedown_duck'
]

// 정규식 라우트 → OpenAPI path 템플릿 + 파라미터 목록
function tmplFromRegex(reBody) {
  let t = reBody.replace(/^\^/, '').replace(/\$$/, '').replace(/\\\//g, '/')
  const params = []
  let i = 0
  t = t.replace(/\(([^)]*)\)/g, (_m, g) => {
    i++
    let name
    if (/^\\d\+$/.test(g)) name = i === 1 ? 'id' : `id${i}`
    else if (/\|/.test(g)) name = 'type'
    else name = `p${i}`
    params.push({ name, enum: /\|/.test(g) ? g.split('|') : null, integer: /^\\d\+$/.test(g) })
    return `{${name}}`
  })
  return { template: t, params }
}

function tagFor(p) {
  if (p.startsWith('/api/auth')) return 'auth'
  if (p.startsWith('/api/admin')) return 'admin'
  if (p.startsWith('/api/children')) return 'children'
  if (p.startsWith('/api/diagnoses')) return 'diagnoses'
  if (p.startsWith('/api/treatments')) return 'treatments'
  if (p.startsWith('/api/schedules')) return 'schedules'
  if (p.startsWith('/api/mypage') || p === '/api/me') return 'mypage'
  if (p.startsWith('/api/support')) return 'support'
  if (p.startsWith('/api/notices') || p.startsWith('/api/faq')) return 'content'
  if (p.startsWith('/api/terms')) return 'terms'
  if (p.startsWith('/api/')) return 'misc'
  return 'legacy'
}

const routes = [] // {method, path, line}
const seen = new Set()
function add(method, p, line) {
  const key = `${method} ${p}`
  if (seen.has(key)) return
  seen.add(key)
  routes.push({ method, path: p, line })
}

let lastMatch = null      // {var, template, params}
let blockTemplate = null  // 중첩 if(VAR){ if(method===) } 추적
let blockParams = null

for (let i = 0; i < lines.length; i++) {
  const l = lines[i]

  // const VAR = path.match(/.../)
  let m = l.match(/const\s+(\w+)\s*=\s*path\.match\(\/(.+?)\/\)/)
  if (m) { const r = tmplFromRegex(m[2]); lastMatch = { var: m[1], ...r }; blockTemplate = null; blockParams = null; continue }

  // if (path === 'X' && method === 'M')
  m = l.match(/if\s*\(\s*path\s*===\s*'([^']+)'\s*&&\s*method\s*===\s*'(\w+)'/)
  if (m) { add(m[2], m[1], i); blockTemplate = null; continue }

  // if (VAR && method === 'M')
  m = l.match(/if\s*\(\s*(\w+)\s*&&\s*method\s*===\s*'(\w+)'/)
  if (m && lastMatch && m[1] === lastMatch.var) { add(m[2], lastMatch.template, i); continue }

  // if (VAR) {  → 중첩 메서드 블록 시작
  m = l.match(/if\s*\(\s*(\w+)\s*\)\s*\{/)
  if (m && lastMatch && m[1] === lastMatch.var) { blockTemplate = lastMatch.template; blockParams = lastMatch.params; continue }

  // if (path === 'X') {  (메서드 없는 블록 — 레거시 또는 중첩)
  m = l.match(/if\s*\(\s*path\s*===\s*'([^']+)'\s*\)\s*\{/)
  if (m) { blockTemplate = m[1]; blockParams = []; continue }

  // if (method === 'M')  (중첩 블록 내부)
  m = l.match(/if\s*\(\s*method\s*===\s*'(\w+)'/)
  if (m && blockTemplate) { add(m[1], blockTemplate, i); continue }

  // if (path === 'X') return ...  (레거시 단일행, method 없음 → POST 로 가정)
  m = l.match(/if\s*\(\s*path\s*===\s*'(\/[^']+)'\s*\)/)
  if (m && !/&&/.test(l)) { add('POST', m[1], i); continue }
}

// 레거시 경로 보강 (POST 로 가정, 레거시 태그)
for (const lp of LEGACY_PATHS) add('POST', lp, 0)

routes.sort((a, b) => a.line - b.line)

// 핵심 엔드포인트 enrich (필요 시 여기 추가)
const ENRICH = {
  'POST /api/auth/login': {
    summary: '로그인',
    requestBody: obj({ role: str('staff|doctor|admin 등'), id: str('로그인 ID/전화번호'), password: str() }, ['id', 'password']),
    responses: { '200': okObj('사용자 정보(id, code, name, role, mtype, idx, institutionCode …)'), '401': errResp() }
  },
  'GET /api/me': { summary: '현재 로그인 사용자', responses: { '200': okObj('내 정보'), '401': errResp() } },
  'GET /api/children/{id}/custom': {
    summary: '아동별 커스텀 상세(진단 리포트·취약 후보·trainingset)',
    responses: { '200': okObj('CustomDetailDto: diagnosis_rows[], weak_phonemes[], trainingset, current …'), '401': errResp(), '404': errResp() }
  },
  'PUT /api/children/{id}/custom': {
    summary: 'trainingset 저장(있으면 UPDATE, 없으면 INSERT)',
    requestBody: obj({ idx: int('있으면 update'), aim_joum: str(), pos: str(), coreword: str(), tr_words: { type: 'array', items: { type: 'string' } }, suit_age: int(), growth_grade: int('0=완전습득..3=출현'), is_ojoum_del_yn: yn(), is_only_noun_yn: yn(), is_cvcword_del_yn: yn(), min_len: int(), max_len: int(), can_read_yn: yn(), orderby_evowels_yn: yn(), orderby_ewords_yn: yn() }, ['aim_joum', 'pos']),
    responses: { '200': okObj('{ idx, action: insert|update }'), '401': errResp() }
  },
  'POST /api/children/{id}/custom/extract': {
    summary: '필터 기반 치료 단어 추출(DataMgr_Joum 파이프라인)',
    requestBody: obj({ aim_joum: str(), pos: str('어두초성|어중초성|어중종성|어말종성'), suit_age: int(), growth_grade: int('0..3'), is_ojoum_del_yn: yn(), is_only_noun_yn: yn(), is_cvcword_del_yn: yn(), min_len: int(), max_len: int(), orderby_ewords_yn: yn() }, ['aim_joum', 'pos']),
    responses: { '200': okObj('{ coreword, tr_words[] }'), '400': errResp() }
  }
}
function str(d) { return d ? { type: 'string', description: d } : { type: 'string' } }
function int(d) { return d ? { type: 'integer', description: d } : { type: 'integer' } }
function yn() { return { type: 'string', enum: ['Y', 'N'] } }
function obj(props, required) { return { required: true, content: { 'application/json': { schema: { type: 'object', properties: props, ...(required ? { required } : {}) } } } } }
function okObj(d) { return { description: d, content: { 'application/json': { schema: { type: 'object' } } } } }
function errResp() { return { description: 'error', content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } } } }

// paths 객체 구성
const paths = {}
for (const r of routes) {
  const isPublic = r.line < authBoundary || r.path === '/api/auth/login' || tagFor(r.path) === 'legacy' || ['/api/terms/current', '/api/db-ping'].includes(r.path)
  const op = {
    tags: [tagFor(r.path)],
    operationId: `${r.method.toLowerCase()}_${r.path.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '')}`,
    ...(isPublic ? {} : { security: [{ xUserId: [] }] })
  }
  // path 파라미터
  const pmatch = [...r.path.matchAll(/\{(\w+)\}/g)].map(x => x[1])
  if (pmatch.length) {
    op.parameters = pmatch.map(name => ({ name, in: 'path', required: true, schema: { type: name.startsWith('id') ? 'integer' : 'string' } }))
  }
  // enrich
  const e = ENRICH[`${r.method} ${r.path}`]
  if (e) {
    if (e.summary) op.summary = e.summary
    if (e.requestBody) op.requestBody = e.requestBody
    if (e.responses) op.responses = e.responses
    if (e.parameters) op.parameters = [...(op.parameters || []), ...e.parameters]
  }
  if (!op.responses) {
    op.responses = { '200': { description: 'OK' }, ...(isPublic ? {} : { '401': errResp() }) }
    if (['POST', 'PUT'].includes(r.method) && !e) {
      op.requestBody = { required: false, content: { 'application/json': { schema: { type: 'object', additionalProperties: true, description: '본문 스키마 미정의 — 소스(api.ts) 참조' } } } }
    }
  }
  if (!op.summary) op.summary = `${r.method} ${r.path}`
  paths[r.path] = paths[r.path] || {}
  paths[r.path][r.method.toLowerCase()] = op
}

const tags = [...new Set(routes.map(r => tagFor(r.path)))].map(t => ({ name: t }))

const spec = {
  openapi: '3.0.3',
  info: {
    title: '하이동동 API',
    version: '1.0.0',
    description: '아동 조음치료 웹앱 API. 인증은 로그인 후 받은 사용자 `id` 를 `x-user-id` 헤더로 전달.\n\n' +
      '테스트 방법:\n1) `POST /api/auth/login` 으로 로그인해 응답의 `id` 확인\n2) 우측 상단 **Authorize** → `x-user-id` 에 그 id 입력\n3) 보호 엔드포인트에서 **Try it out**\n\n' +
      `엔드포인트 ${routes.length}개. 본문/쿼리 스키마가 미정의(object)인 항목은 소스(api.ts) 기준으로 직접 입력 필요.`
  },
  servers: [{ url: '/', description: '현재 호스트' }],
  tags,
  components: {
    securitySchemes: { xUserId: { type: 'apiKey', in: 'header', name: 'x-user-id', description: '로그인한 사용자의 id' } }
  },
  paths
}

const banner = '// AUTO-GENERATED by server/gen-openapi.cjs — 직접 수정 금지. 라우트 변경 시 재생성.\n' +
  '/* eslint-disable */\n'
fs.writeFileSync(OUT, banner + 'export const openapiSpec = ' + JSON.stringify(spec, null, 2) + ' as const\n')
console.log(`generated ${OUT}`)
console.log(`routes: ${routes.length}, public: ${routes.filter(r => r.line < authBoundary).length}, tags: ${tags.length}`)
const byTag = {}
for (const r of routes) { const t = tagFor(r.path); byTag[t] = (byTag[t] || 0) + 1 }
console.log('by tag:', JSON.stringify(byTag))
