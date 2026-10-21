/**
 * dsh-shotcut —— 聊天输入框旁的剪刀截图（host 半身）。
 *
 * 只依赖 node:* 与相对路径导入（本包可能以 link: 方式装在 DSH home 之外，
 * 裸 @deepseek-ai/* 导入会因 realpath 解析而 MODULE_NOT_FOUND）。
 *
 * 职责：把 capture.py 同步到工作目录、被动响应 HTTP 路由
 *   GET /dshot/capture?keepSelf=0|1  -> {ok,w,h,url,bytes,ms,hide,hideway,error}
 *   GET /dshot/img?t=<seq>           -> PNG 字节
 *   GET /dshot/log?m=<json>          -> 写一行报告
 *   GET /dshot/ping                  -> 状态
 * 抓屏本身在 Python 里完成（含"本页临时全透明让开"），所以这里没有沙箱包装开销。
 *
 * @module dsh-shotcut
 */
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 诊断名。 */
export const name = 'shotcut'
/** 硬依赖：注册 HTTP 路由要用 webServer。 */
export const inject = ['webServer']

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = path.resolve(HERE, '..')
const DEFAULT_WORK = 'D:\\tools\\dshot'
const DEFAULT_PY =
  'C:\\Users\\86133\\.dsh\\dsh-runtimes\\dsh-primary-runtime\\dependencies\\python\\python.exe'
const PY_ALTS = ['python', 'py']

function pad2(n) {
  return (n < 10 ? '0' : '') + n
}

/**
 * 插件入口。
 * @param ctx - 宿主上下文（含 webServer）。
 * @param config - profile 补丁行里的 config：workDir / pythonPath。
 */
export function apply(ctx, config = {}) {
  const work = typeof config.workDir === 'string' && config.workDir ? config.workDir : DEFAULT_WORK
  const pyList = [config.pythonPath, DEFAULT_PY]
    .filter((v) => typeof v === 'string' && v !== '')
    .concat(PY_ALTS)

  fs.mkdirSync(work, { recursive: true })
  const script = path.join(work, 'capture.py')
  const shot = path.join(work, 'shot.png')
  const report = path.join(work, 'report.txt')

  // 脚本按内容同步：包升级后自动覆盖工作目录里的旧脚本。
  try {
    const src = fs.readFileSync(path.join(PKG_ROOT, 'capture.py'), 'utf8')
    let cur = ''
    try {
      cur = fs.readFileSync(script, 'utf8')
    } catch {}
    if (cur !== src) fs.writeFileSync(script, src, 'utf8')
  } catch (error) {
    ctx.logger?.warn?.('[shotcut] capture.py 同步失败: ' + error.message)
  }

  const st = { bytes: null, w: 0, h: 0, seq: 0, py: null, log: [], fails: [] }

  function logLine(s) {
    const d = new Date()
    const t = pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) + '.' + String(d.getMilliseconds())
    st.log.push(t + ' ' + s)
    if (st.log.length > 300) st.log.shift()
  }

  function writeReport() {
    const head = JSON.stringify(
      {
        py: st.py,
        seq: st.seq,
        w: st.w,
        h: st.h,
        hasBytes: !!st.bytes,
        bytes: st.bytes ? st.bytes.length : 0,
        work,
        fails: st.fails,
      },
      null,
      1,
    )
    try {
      fs.writeFileSync(report, head + '\n\n--- log ---\n' + st.log.join('\n') + '\n', 'utf8')
    } catch {}
  }

  /**
   * 跑一次抓屏。
   * @param keep - true 表示不动窗口（连本页一起截）。
   */
  function shoot(keep) {
    return new Promise((resolve) => {
      const list = st.py ? [st.py] : pyList
      let i = 0
      const next = (lastErr) => {
        if (i >= list.length) {
          const msg = String(lastErr || 'python 不可用')
          st.fails.push(msg.slice(0, 200))
          logLine('shoot FAILED ' + msg)
          writeReport()
          resolve({ ok: false, error: msg })
          return
        }
        const exe = list[i++]
        execFile(
          exe,
          [script, shot, keep ? '1' : '0'],
          { timeout: 60000, windowsHide: true, maxBuffer: 1 << 20 },
          (err, stdout, stderr) => {
            if (err) {
              next('运行抓屏脚本失败（' + exe + '）：' + String((err && err.message) || err))
              return
            }
            let info = null
            try {
              const rows = String(stdout).split(/\r?\n/).filter(Boolean)
              info = JSON.parse(rows[rows.length - 1])
            } catch {}
            if (!info || info.ok !== true) {
              const detail = (info && info.error) || String(stdout).slice(0, 160) || String(stderr).slice(0, 160)
              next('抓屏脚本报错（' + exe + '）：' + detail)
              return
            }
            try {
              const buf = fs.readFileSync(shot)
              if (!(buf.length > 100 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)) {
                next('抓屏结果不是有效的 PNG 图片')
                return
              }
              st.py = exe
              st.bytes = buf
              st.w = info.w
              st.h = info.h
              st.seq += 1
              logLine(
                'shoot ok ' + info.w + 'x' + info.h + ' png=' + buf.length + ' ms=' + info.ms +
                  ' hide=' + (info.hide ? '1' : '0') + '/' + info.hideway,
              )
              writeReport()
              resolve({
                ok: true,
                url: '/dshot/img?t=' + st.seq,
                w: info.w,
                h: info.h,
                bytes: buf.length,
                ms: info.ms,
                hide: info.hide,
                hideway: info.hideway,
              })
            } catch (error) {
              next('读取抓屏图片失败：' + String((error && error.message) || error))
            }
          },
        )
      }
      next('')
    })
  }

  function query(req) {
    try {
      return new URL(req.url, 'http://127.0.0.1').searchParams
    } catch {
      return new URLSearchParams()
    }
  }

  function json(res, code, obj) {
    const body = Buffer.from(JSON.stringify(obj), 'utf8')
    res.writeHead(code, {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': String(body.length),
    })
    res.end(body)
  }

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/dshot/capture',
        handler: (req, res) => {
          const keep = query(req).get('keepSelf') === '1'
          shoot(keep).then(
            (r) => json(res, r.ok ? 200 : 500, r),
            (e) => json(res, 500, { ok: false, error: '抓屏服务异常：' + String((e && e.message) || e) }),
          )
        },
      }),
    'shotcut: capture route',
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/dshot/img',
        handler: (req, res) => {
          if (!st.bytes) {
            res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
            res.end('no capture yet')
            return
          }
          res.writeHead(200, {
            'content-type': 'image/png',
            'cache-control': 'no-store, no-cache, must-revalidate',
            'content-length': String(st.bytes.length),
          })
          res.end(st.bytes)
        },
      }),
    'shotcut: image route',
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/dshot/log',
        handler: (req, res) => {
          const m = query(req).get('m') || ''
          if (m) {
            logLine('cli ' + m.slice(0, 400))
            writeReport()
          }
          json(res, 200, { ok: true })
        },
      }),
    'shotcut: log route',
  )

  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: '/dshot/ping',
        handler: (req, res) =>
          json(res, 200, {
            ok: true,
            py: st.py,
            seq: st.seq,
            w: st.w,
            h: st.h,
            hasBytes: !!st.bytes,
            work,
          }),
      }),
    'shotcut: ping route',
  )

  logLine('host ready (' + work + ')')
  writeReport()

  // 激活自检：抓一张但不动窗口（keepSelf=1），只验证 python/PIL/落盘链路是否通。
  ctx.effect(() => {
    const timer = setTimeout(() => {
      shoot(true).then(
        (r) => logLine('SELFTEST ' + JSON.stringify(r).slice(0, 240)),
        (e) => logLine('SELFTEST THREW ' + String((e && e.message) || e)),
      )
    }, 1500)
    return () => clearTimeout(timer)
  }, 'shotcut: selftest')
}
