import http from 'node:http'
import { handleRequest, type Env } from './api.js'

const PORT = Number(process.env.PORT ?? 4011)
const HOST = process.env.HOST ?? '0.0.0.0'

function requireEnv(name: keyof Env): string {
  const v = process.env[name]
  if (!v) {
    console.error(`[api] missing required env: ${name}`)
    process.exit(1)
  }
  return v
}

const env: Env = {
  DB_HOST:        requireEnv('DB_HOST'),
  DB_PORT:        requireEnv('DB_PORT'),
  DB_USER:        requireEnv('DB_USER'),
  DB_PASSWORD:    requireEnv('DB_PASSWORD'),
  DB_DATABASE:    requireEnv('DB_DATABASE'),
  FILES_BASE_URL: process.env.FILES_BASE_URL ?? '',
  FILES_ORIGIN:   process.env.FILES_ORIGIN ?? '',
  DATACENTER_DIR: process.env.DATACENTER_DIR ?? '',
  ALIGO_KEY:      process.env.ALIGO_KEY ?? '',
  ALIGO_USER_ID:  process.env.ALIGO_USER_ID ?? '',
  ALIGO_SENDER:   process.env.ALIGO_SENDER ?? ''
}

function nodeReqToWebRequest(req: http.IncomingMessage, rawBody: Buffer): Request {
  const host  = req.headers.host ?? `localhost:${PORT}`
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? 'http'
  const url   = `${proto}://${host}${req.url ?? '/'}`
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (v == null) continue
    if (Array.isArray(v)) for (const x of v) headers.append(k, x)
    else headers.set(k, v)
  }
  const method = (req.method ?? 'GET').toUpperCase()
  const init: RequestInit = { method, headers }
  // GET/HEAD 은 Web Request 본문을 가질 수 없다(스펙). Unity 클라이언트는 GET 에도
  // JSON 본문을 싣어 보내므로, 본문은 별도 rawBody 로 handleRequest 에 전달한다.
  if (method !== 'GET' && method !== 'HEAD' && rawBody.length > 0) {
    init.body = new Uint8Array(rawBody)
  }
  return new Request(url, init)
}

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  return Buffer.concat(chunks)
}

async function writeWebResponse(webRes: Response, res: http.ServerResponse): Promise<void> {
  res.statusCode = webRes.status
  webRes.headers.forEach((v, k) => res.setHeader(k, v))
  if (!webRes.body) { res.end(); return }
  const reader = webRes.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    res.write(value)
  }
  res.end()
}

const server = http.createServer(async (req, res) => {
  try {
    const rawBody = await readBody(req)
    const webReq = nodeReqToWebRequest(req, rawBody)
    const webRes = await handleRequest(webReq, env, rawBody)
    await writeWebResponse(webRes, res)
  } catch (e) {
    console.error('[api] handler error', e)
    if (!res.headersSent) { res.statusCode = 500; res.end('internal error') }
    else res.end()
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[api] listening on http://${HOST}:${PORT}`)
})

function shutdown(signal: NodeJS.Signals) {
  console.log(`[api] received ${signal}, shutting down`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
