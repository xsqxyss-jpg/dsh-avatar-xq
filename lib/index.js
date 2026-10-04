/**
 * dsh-avatar-xq — 消息头像（host 半边）
 *
 * 只做一件事：把头像配置存成 JSON，并给浏览器一个读写口。
 *   GET  /api/dsh-avatar-xq        → { config: {...} }
 *   POST /api/dsh-avatar-xq        → 覆盖保存
 *
 * 为什么不走插件 Config（schemastery）：客户端写 config 的路径没找到可靠先例，
 * 而 dsh-hud 的「webServer 前缀路由 + JSON 文件」是本机验证过的成熟模式，
 * 配置落在 $DSH_HOME/storages/dsh-avatar-xq/config.json，跨会话跨重启都在。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const name = 'dsh-avatar-xq'
export const inject = ['webServer']

/** 与客户端 DEFAULTS 保持一致；缺字段时兜底。 */
export const DEFAULTS = {
  enabled: true,
  size: 42,
  gap: 12,
  radius: 0,
  leftInset: 0,
  rightInset: 0,
  assistant: '',
  user: '',
}

/** 单个 data URI 上限（8MB）—— 防止有人 POST 一坨巨图把 JSON 撑爆。 */
const MAX_DATA_URI = 8 * 1024 * 1024

function configPath() {
  const home = process.env.DSH_HOME || join(process.cwd(), '.dsh')
  return join(home, 'storages', 'dsh-avatar-xq', 'config.json')
}

function readConfig() {
  const file = configPath()
  if (!existsSync(file)) return { ...DEFAULTS }
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    return sanitize(raw)
  } catch (error) {
    console.error('[dsh-avatar-xq] config unreadable, falling back to defaults: ' + (error instanceof Error ? error.message : String(error)))
    return { ...DEFAULTS }
  }
}

/** 只收白名单里的标量/字符串，其余一律丢弃；data URI 超限或非 data: 开头直接扔掉。 */
function sanitize(input) {
  const out = { ...DEFAULTS }
  if (typeof input !== 'object' || input === null) return out
  if (typeof input.enabled === 'boolean') out.enabled = input.enabled
  if (Number.isFinite(input.size)) out.size = clamp(input.size, 16, 96)
  if (Number.isFinite(input.gap)) out.gap = clamp(input.gap, 0, 48)
  if (Number.isFinite(input.radius)) out.radius = clamp(input.radius, 0, 48)
  if (Number.isFinite(input.leftInset)) out.leftInset = clamp(input.leftInset, 0, 32)
  if (Number.isFinite(input.rightInset)) out.rightInset = clamp(input.rightInset, 0, 32)
  for (const key of ['assistant', 'user']) {
    const value = input[key]
    if (typeof value === 'string' && value.length <= MAX_DATA_URI && (value === '' || value.startsWith('data:image/'))) {
      out[key] = value
    }
  }
  return out
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function writeConfig(next) {
  const file = configPath()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(next, null, 2), 'utf8')
}

function writeJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

export function apply(ctx) {
  const webServer = ctx.webServer
  if (webServer === undefined) return
  try {
    ctx.effect(() => webServer.register({
      kind: 'prefix',
      path: '/api/dsh-avatar-xq',
      handler: async (req, res) => {
        try {
          if (req.method === 'GET') {
            writeJson(res, 200, { config: readConfig(), defaults: DEFAULTS })
            return
          }
          if (req.method === 'POST') {
            const chunks = []
            let size = 0
            for await (const chunk of req) {
              size += chunk.length
              if (size > MAX_DATA_URI * 2) {
                writeJson(res, 413, { error: 'payload too large' })
                return
              }
              chunks.push(chunk)
            }
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
            const next = sanitize(body)
            writeConfig(next)
            writeJson(res, 200, { config: next })
            return
          }
          writeJson(res, 405, { error: 'method not allowed' })
        } catch (error) {
          writeJson(res, 500, { error: error instanceof Error ? error.message : String(error) })
        }
      },
    }), 'dsh-avatar-xq: config route')
    console.error('[dsh-avatar-xq] route registered -> ' + configPath())
  } catch (error) {
    console.error('[dsh-avatar-xq] register failed: ' + (error instanceof Error ? error.message : String(error)))
  }
}
