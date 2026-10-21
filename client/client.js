/**
 * dsh-shotcut —— 浏览器半身（手写，无构建器）。
 *
 * 顶层是模块系统的惰性注册：__ModuleLoader__.load 只登记 factory，真正执行在
 * 需要时发生，所以所有副作用（注入 CSS、注册槽位）都必须写在 factory 内。
 * id 必须等于 package.json 的 name。
 *
 * 与 host 的通信走同源 HTTP（host 已注册 /dshot/* 路由），不用动态插件的 host.call。
 */
window.__ModuleLoader__.load({
  id: 'dsh-shotcut',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')

    var GREEN = '#00C375'
    var X_RED = '#E64340'
    var COLORS = ['#E64340', '#FFB300', '#2B7FFF', '#111111']
    var WIDTHS = [2, 4, 7]
    var MODE_KEY = 'dshot.hideSelf'
    var CAPTURE_URL = '/dshot/capture'
    var LOG_URL = '/dshot/log'

    var CSS_TEXT = [
      '.dshot-pair{display:inline-flex;align-items:center;gap:1px}',
      '.dshot-btn{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:inherit;cursor:pointer;padding:0;opacity:.75;transition:background .15s,opacity .15s}',
      '.dshot-btn:hover{background:rgba(127,127,127,.18);opacity:1}',
      '.dshot-btn[data-busy="1"]{opacity:.35;cursor:progress}',
      '.dshot-tg{width:22px;height:22px;opacity:.5}',
      '.dshot-tg[data-on="1"]{color:#00C375;opacity:1}',
      '.dshot-tg:hover{opacity:1}',
      '.dshot-root{position:fixed;inset:0;z-index:2147483000;pointer-events:auto;background:#0b0b0d;user-select:none;-webkit-user-select:none;overflow:hidden;touch-action:none}',
      '.dshot-bg{position:absolute;inset:-60px;background-position:center center;background-size:cover;background-repeat:no-repeat;filter:blur(38px) brightness(.70) saturate(.9);pointer-events:none}',
      '.dshot-frame{position:absolute;pointer-events:none;box-shadow:0 0 0 1px rgba(255,255,255,.22)}',
      '.dshot-watchdog{position:absolute;left:0;top:0;width:2px;height:2px;opacity:0;pointer-events:none;animation:dshot-watch 25s linear forwards}',
      '@keyframes dshot-watch{from{opacity:0}to{opacity:.02}}',
      '.dshot-meta{position:absolute;left:12px;bottom:10px;color:rgba(255,255,255,.62);font-size:12px;line-height:1.2;pointer-events:none;text-shadow:0 1px 2px rgba(0,0,0,.8)}',
      '.dshot-stage{position:absolute;display:block;pointer-events:none}',
      '.dshot-size{position:absolute;pointer-events:none;color:#fff;font-size:13px;line-height:1.15;white-space:nowrap;text-shadow:0 0 2px rgba(0,0,0,.95),0 0 4px rgba(0,0,0,.8),1px 1px 0 rgba(0,0,0,.65),-1px -1px 0 rgba(0,0,0,.65),1px -1px 0 rgba(0,0,0,.65),-1px 1px 0 rgba(0,0,0,.65)}',
      '.dshot-bar{position:absolute;display:flex;align-items:center;padding:3px 6px;border-radius:9px;background:#fff;box-shadow:0 4px 20px rgba(0,0,0,.34);pointer-events:auto;white-space:nowrap}',
      '.dshot-tb{display:inline-flex;align-items:center;justify-content:center;width:42px;height:42px;border:0;border-radius:6px;background:transparent;color:#3d3d3d;cursor:pointer;padding:0;flex:none}',
      '.dshot-tb:hover{background:#f1f1f1}',
      '.dshot-tb[data-on="1"]{background:#E6F7EE;color:#00C375}',
      '.dshot-tb:disabled{opacity:.3;cursor:default;background:transparent}',
      '.dshot-tb[data-red="1"]{color:#E64340}',
      '.dshot-tb[data-green="1"]{color:#07C160}',
      '.dshot-sep{width:1px;height:24px;background:#e8e8e8;margin:0 5px;flex:none}',
      '.dshot-panel{position:absolute;top:calc(100% + 11px);transform:translateX(-50%);display:flex;align-items:center;height:40px;padding:0 8px;border-radius:8px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.28);z-index:2}',
      '.dshot-panel:before{content:"";position:absolute;left:50%;top:-6px;margin-left:-6px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:6px solid #fff}',
      '.dshot-pdb{width:30px;height:30px;border:0;border-radius:5px;background:transparent;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0}',
      '.dshot-pdb:hover{background:#f1f1f1}',
      '.dshot-pdb[data-on="1"]{background:#E6F7EE}',
      '.dshot-dot{display:block;border-radius:50%;background:#8a8a8a}',
      '.dshot-pdb[data-on="1"] .dshot-dot{background:#00C375}',
      '.dshot-sw{width:18px;height:18px;margin:0 3px;border-radius:50%;border:1px solid rgba(0,0,0,.18);cursor:pointer;padding:0;box-sizing:border-box;flex:none}',
      '.dshot-sw[data-on="1"]{outline:2px solid #00C375;outline-offset:1px}',
      '.dshot-pill{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;margin-left:6px;border:0;border-radius:6px;background:#EDEDED;color:#07C160;font-size:12px;cursor:pointer;white-space:nowrap}',
      '.dshot-pill:hover{background:#e2e2e2}',
      '.dshot-esc{position:absolute;top:48px;right:14px;width:34px;height:34px;border:0;border-radius:8px;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;pointer-events:auto}',
      '.dshot-esc:hover{background:rgba(0,0,0,.72)}',
      '.dshot-txt{position:absolute;background:transparent;border:1px dashed rgba(255,255,255,.8);outline:none;min-width:60px;padding:0 2px;font-family:inherit;z-index:3}',
      '.dshot-toast{position:fixed;left:50%;transform:translateX(-50%);top:18px;z-index:2147483001;display:flex;align-items:center;gap:8px;padding:9px 13px;border-radius:9px;background:rgba(24,24,28,.97);border:1px solid rgba(255,255,255,.14);color:#fff;font-size:12px;max-width:min(560px,calc(100vw - 32px));box-shadow:0 10px 30px rgba(0,0,0,.45)}',
      '.dshot-toast[data-auto="1"]{animation:dshot-out 1.5s ease forwards}',
      '@keyframes dshot-out{0%{opacity:1}72%{opacity:1}100%{opacity:0}}',
      '.dshot-x{border:0;background:transparent;color:#fff;cursor:pointer;font-size:14px;line-height:1;padding:2px 4px}',
    ].join('')

    function clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v
    }
    function normRect(a, b) {
      return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
    }
    function inside(p, s) {
      return p.x >= s.x && p.x <= s.x + s.w && p.y >= s.y && p.y <= s.y + s.h
    }
    function pad2(n) {
      return (n < 10 ? '0' : '') + n
    }
    function readMode() {
      try {
        var v = window.localStorage.getItem(MODE_KEY)
        if (v === '0') return false
        if (v === '1') return true
      } catch (e) {}
      return true
    }
    function writeMode(v) {
      try {
        window.localStorage.setItem(MODE_KEY, v ? '1' : '0')
      } catch (e) {}
    }

    function Svg(kids) {
      return React.createElement(
        'svg',
        { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' },
        kids,
      )
    }
    function Pt(d, k) {
      return React.createElement('path', { key: k, d: d })
    }
    function Ci(cx, cy, r, k) {
      return React.createElement('circle', { key: k, cx: cx, cy: cy, r: r })
    }
    function Rc(x, y, w, h, k) {
      return React.createElement('rect', { key: k, x: x, y: y, width: w, height: h })
    }
    function Dt(cx, cy, k) {
      return React.createElement('circle', { key: k, cx: cx, cy: cy, r: 2.2, fill: 'currentColor', stroke: 'none' })
    }

    var ICON = {
      scissor: function () {
        return Svg([Ci(6, 6, 3, 'a'), Ci(6, 18, 3, 'b'), Pt('M20 4L8.12 15.88', 'c'), Pt('M14.47 14.48L20 20', 'd'), Pt('M8.12 8.12L12 12', 'e')])
      },
      eye: function () {
        return Svg([Pt('M2.2 12S6 5.6 12 5.6 21.8 12 21.8 12 18 18.4 12 18.4 2.2 12 2.2 12z', 'a'), Ci(12, 12, 3.1, 'b')])
      },
      eyeOff: function () {
        return Svg([
          Pt('M3.4 3.4l17.2 17.2', 'a'),
          Pt('M9.8 5.9A10.7 10.7 0 0112 5.6c6 0 9.8 6.4 9.8 6.4a18.4 18.4 0 01-3.2 3.9', 'b'),
          Pt('M6.2 7.7A18.2 18.2 0 002.2 12s3.8 6.4 9.8 6.4a10.9 10.9 0 004.3-.9', 'c'),
        ])
      },
      rect: function () {
        return Svg([Rc(3.5, 5, 17, 14, 'a')])
      },
      ellipse: function () {
        return Svg([Ci(12, 12, 8.2, 'a')])
      },
      arrow: function () {
        return Svg([Pt('M5 19L18.4 5.6', 'a'), Pt('M11.6 5.6H18.4V12.4', 'b')])
      },
      pen: function () {
        return Svg([Pt('M4.2 19.8l2.3-.6L18.2 7.5a1.92 1.92 0 00-2.7-2.7L3.8 16.5z', 'a'), Pt('M14.6 6.9l2.6 2.6', 'b')])
      },
      mosaic: function () {
        return Svg([Rc(3.5, 4, 17, 16, 'a'), Dt(8.5, 9, 'b'), Dt(12, 9, 'c'), Dt(15.5, 9, 'd'), Dt(8.5, 13, 'e'), Dt(12, 13, 'f'), Dt(15.5, 13, 'g')])
      },
      text: function () {
        return Svg([Rc(3.5, 4, 17, 16, 'a'), Pt('M9 9h6', 'b'), Pt('M12 9v7', 'c')])
      },
      undo: function () {
        return Svg([Pt('M9.5 14.5L4.5 9.5l5-5', 'a'), Pt('M4.5 9.5H14a5.5 5.5 0 010 11h-3', 'b')])
      },
      save: function () {
        return Svg([Pt('M12 3.2v9.6', 'a'), Pt('M8.2 9.2l3.8 3.8 3.8-3.8', 'b'), Pt('M4.5 14.5v4.3h15v-4.3', 'c')])
      },
      close: function () {
        return React.createElement(
          'svg',
          { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round' },
          [Pt('M6.6 6.6l10.8 10.8', 'a'), Pt('M17.4 6.6L6.6 17.4', 'b')],
        )
      },
      check: function () {
        return React.createElement(
          'svg',
          { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' },
          [Pt('M5 12.6l4.6 4.6L19 7', 'a')],
        )
      },
      mask: function () {
        return Svg([Pt('M4 8V4.5h3.5', 'a'), Pt('M20 8V4.5h-3.5', 'b'), Pt('M4 16v3.5h3.5', 'c'), Pt('M20 16v3.5h-3.5', 'd'), Dt(9.5, 10, 'e'), Dt(14.5, 10, 'f'), Dt(9.5, 14, 'g'), Dt(14.5, 14, 'h')])
      },
    }

    function apply(ctx) {
      ctx.effect(function () {
        var el = document.createElement('style')
        el.setAttribute('data-dsh-shotcut', '1')
        el.textContent = CSS_TEXT
        document.head.appendChild(el)
        return function () {
          if (el.parentNode) el.parentNode.removeChild(el)
        }
      })

      var state = { seq: 0, active: false, pending: false, src: null, bg: '', W: 0, H: 0, error: '' }
      var listeners = new Set()
      function emit() {
        listeners.forEach(function (l) {
          try {
            l()
          } catch (e) {}
        })
      }
      function patch(p) {
        for (var k in p) state[k] = p[k]
        emit()
      }
      function subscribe(l) {
        listeners.add(l)
        return function () {
          listeners.delete(l)
        }
      }
      function useTick() {
        var st = React.useState(0)
        var set = st[1]
        React.useEffect(function () {
          return subscribe(function () {
            set(function (n) {
              return n + 1
            })
          })
        }, [])
      }

      var busy = false
      var hideSelf = readMode()

      function log(o) {
        try {
          var u = LOG_URL + '?m=' + encodeURIComponent(JSON.stringify(o).slice(0, 400))
          fetch(u, { cache: 'no-store' }).catch(function () {})
        } catch (e) {}
      }

      function loadImage(url) {
        return new Promise(function (res, rej) {
          var img = new Image()
          img.onload = function () {
            res(img)
          }
          img.onerror = function () {
            rej(new Error('抓屏图片读取失败（路由 ' + url + '）'))
          }
          img.src = url
        })
      }

      function callCapture(keep) {
        return fetch(CAPTURE_URL + '?keepSelf=' + (keep ? '1' : '0'), { cache: 'no-store' }).then(function (r) {
          return r.json()
        })
      }

      function makeBackdrop(cv) {
        try {
          var bw = 96
          var bh = Math.max(1, Math.round((bw * cv.height) / cv.width))
          var sc = document.createElement('canvas')
          sc.width = bw
          sc.height = bh
          sc.getContext('2d').drawImage(cv, 0, 0, bw, bh)
          return sc.toDataURL('image/png')
        } catch (e) {
          return ''
        }
      }

      function findComposer() {
        var list = document.querySelectorAll('[contenteditable="true"]')
        var pick = null
        for (var i = 0; i < list.length; i++) {
          if (list[i].getClientRects().length > 0) pick = list[i]
        }
        return pick
      }

      function pasteIntoComposer(blob) {
        var el = findComposer()
        if (!el) return false
        try {
          var dt = new DataTransfer()
          dt.items.add(new File([blob], 'screenshot.png', { type: 'image/png' }))
          var ev = new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
          el.focus()
          el.dispatchEvent(ev)
          return true
        } catch (e) {
          return false
        }
      }

      function copyToClipboard(blob) {
        try {
          if (!navigator.clipboard || !window.ClipboardItem) return Promise.resolve(false)
          return navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(
            function () {
              return true
            },
            function () {
              return false
            },
          )
        } catch (e) {
          return Promise.resolve(false)
        }
      }

      function cancelPending() {
        if (!state.pending && !state.active) return
        busy = false
        log({ step: 'cancel' })
        patch({ seq: state.seq + 1, pending: false, active: false, src: null, error: '' })
      }

      function startCapture(invert) {
        if (busy || state.active) return
        busy = true
        var g = state.seq + 1
        var t0 = Date.now()
        var hide = invert ? !hideSelf : hideSelf
        patch({ seq: g, pending: true, active: false, src: null, error: '' })
        log({ step: 'click', hide: hide, vw: window.innerWidth, vh: window.innerHeight })
        var call = null
        try {
          call = callCapture(!hide)
        } catch (e) {
          call = Promise.reject(e)
        }
        var flow = call.then(function (r) {
          log({ step: 'host-return', ms: Date.now() - t0, r: r ? { ok: r.ok, w: r.w, h: r.h, bytes: r.bytes, hideway: r.hideway } : null })
          if (state.seq !== g) return null
          if (!r || r.ok !== true) throw new Error((r && r.error) || '抓屏失败')
          return loadImage(r.url).then(function (img) {
            var cv = document.createElement('canvas')
            cv.width = img.naturalWidth || r.w || 1
            cv.height = img.naturalHeight || r.h || 1
            cv.getContext('2d').drawImage(img, 0, 0)
            return cv
          })
        })
        flow.then(
          function (cv) {
            busy = false
            if (!cv || state.seq !== g) return
            patch({ src: cv, bg: makeBackdrop(cv), W: cv.width, H: cv.height, seq: state.seq + 1, active: true, pending: false, error: '' })
            log({ step: 'ready', ms: Date.now() - t0, w: cv.width, h: cv.height })
          },
          function (err) {
            busy = false
            var msg = (err && err.message) || String(err)
            log({ step: 'error', ms: Date.now() - t0, msg: msg })
            patch({ pending: false, active: false, error: msg })
          },
        )
      }

      function ShotButton() {
        useTick()
        var pend = state.pending
        return React.createElement('span', { className: 'dshot-pair' }, [
          React.createElement(
            'button',
            {
              key: 'sc',
              type: 'button',
              className: 'dshot-btn',
              title: hideSelf
                ? '截图（Alt+A）· 抓屏瞬间本页暂时透明（无动画、不改层级、不切焦点），可截到后面的内容'
                : '截图（Alt+A）· 不隐藏本页，连本页一起截',
              'aria-label': '截图',
              'data-busy': pend ? '1' : '0',
              disabled: pend,
              onClick: function (e) {
                e.preventDefault()
                e.stopPropagation()
                startCapture(!!(e && e.shiftKey))
              },
            },
            ICON.scissor(),
          ),
          React.createElement(
            'button',
            {
              key: 'tg',
              type: 'button',
              className: 'dshot-btn dshot-tg',
              title: hideSelf ? '截图时本页会暂时透明（可截到后面的内容）——点击改为不隐藏' : '截图时不隐藏本页（连本页一起截）——点击改为让开本页',
              'aria-label': '是否隐藏本页',
              'data-on': hideSelf ? '1' : '0',
              disabled: pend,
              onClick: function (e) {
                e.preventDefault()
                e.stopPropagation()
                hideSelf = !hideSelf
                writeMode(hideSelf)
                log({ step: 'mode', hideSelf: hideSelf })
                emit()
              },
            },
            hideSelf ? ICON.eyeOff() : ICON.eye(),
          ),
        ])
      }

      function ShotOverlay() {
        useTick()
        var rootRef = React.useRef(null)
        var cvRef = React.useRef(null)
        var barRef = React.useRef(null)
        var btnRef = React.useRef(null)
        var panelRef = React.useRef(null)
        var viewS = React.useState([window.innerWidth, window.innerHeight])
        var view = viewS[0]
        var setView = viewS[1]
        var selS = React.useState(null)
        var sel = selS[0]
        var setSel = selS[1]
        var toolS = React.useState('select')
        var tool = toolS[0]
        var setTool = toolS[1]
        var colorS = React.useState(COLORS[0])
        var color = colorS[0]
        var setColor = colorS[1]
        var lwS = React.useState(WIDTHS[1])
        var lw = lwS[0]
        var setLw = lwS[1]
        var stS = React.useState([])
        var strokes = stS[0]
        var setStrokes = stS[1]
        var redoS = React.useState([])
        var redo = redoS[0]
        var setRedo = redoS[1]
        var dragS = React.useState(null)
        var drag = dragS[0]
        var setDrag = dragS[1]
        var txtS = React.useState(null)
        var txt = txtS[0]
        var setTxt = txtS[1]
        var flS = React.useState(null)
        var flash = flS[0]
        var setFlash = flS[1]
        var barWS = React.useState(0)
        var barW = barWS[0]
        var setBarW = barWS[1]
        var posS = React.useState(0)
        var panelX = posS[0]
        var setPanelX = posS[1]

        var W = state.W
        var H = state.H
        var active = state.active
        var pending = state.pending
        var scale = W > 0 && H > 0 ? Math.min(view[0] / W, view[1] / H) : 1
        var dw = W * scale
        var dh = H * scale
        var ox = (view[0] - dw) / 2
        var oy = (view[1] - dh) / 2

        React.useEffect(
          function () {
            setSel(null)
            setStrokes([])
            setRedo([])
            setDrag(null)
            setTxt(null)
            setFlash(null)
            setTool('select')
          },
          [state.seq],
        )

        React.useEffect(function () {
          function onResize() {
            setView([window.innerWidth, window.innerHeight])
          }
          window.addEventListener('resize', onResize)
          return function () {
            window.removeEventListener('resize', onResize)
          }
        }, [])

        function renderOne(g, s) {
          g.save()
          g.lineJoin = 'round'
          g.lineCap = 'round'
          g.strokeStyle = s.color
          g.fillStyle = s.color
          g.lineWidth = s.lw
          if (s.type === 'rect') {
            g.strokeRect(s.x, s.y, s.w, s.h)
          } else if (s.type === 'ellipse') {
            g.beginPath()
            g.ellipse(s.x + s.w / 2, s.y + s.h / 2, Math.abs(s.w / 2), Math.abs(s.h / 2), 0, 0, Math.PI * 2)
            g.stroke()
          } else if (s.type === 'arrow') {
            var dx = s.x2 - s.x1
            var dy = s.y2 - s.y1
            if (Math.sqrt(dx * dx + dy * dy) >= 1) {
              g.beginPath()
              g.moveTo(s.x1, s.y1)
              g.lineTo(s.x2, s.y2)
              g.stroke()
              var a = Math.atan2(dy, dx)
              var hl = Math.max(10, s.lw * 4)
              g.beginPath()
              g.moveTo(s.x2, s.y2)
              g.lineTo(s.x2 - hl * Math.cos(a - 0.5), s.y2 - hl * Math.sin(a - 0.5))
              g.stroke()
              g.beginPath()
              g.moveTo(s.x2, s.y2)
              g.lineTo(s.x2 + hl * Math.cos(a + 0.5), s.y2 + hl * Math.sin(a + 0.5))
              g.stroke()
            }
          } else if (s.type === 'pen') {
            var p = s.pts || []
            if (p.length === 1) {
              g.beginPath()
              g.arc(p[0][0], p[0][1], Math.max(0.6, s.lw / 2), 0, Math.PI * 2)
              g.fill()
            } else if (p.length > 1) {
              g.beginPath()
              g.moveTo(p[0][0], p[0][1])
              for (var i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1])
              g.stroke()
            }
          } else if (s.type === 'text') {
            g.font = '600 ' + s.size + 'px ui-sans-serif,system-ui,"Segoe UI",sans-serif'
            g.textBaseline = 'top'
            g.shadowColor = 'rgba(0,0,0,.5)'
            g.shadowBlur = Math.max(2, s.size * 0.14)
            g.fillText(s.text, s.x, s.y)
          } else if (s.type === 'mosaic') {
            var src = state.src
            if (src) {
              var mx = clamp(Math.round(s.x), 0, W)
              var my = clamp(Math.round(s.y), 0, H)
              var mw = Math.round(Math.min(W - mx, s.w))
              var mh = Math.round(Math.min(H - my, s.h))
              if (mw >= 2 && mh >= 2) {
                var cols = Math.max(1, Math.round(mw / 13))
                var rows = Math.max(1, Math.round(mh / 13))
                var t = document.createElement('canvas')
                t.width = cols
                t.height = rows
                t.getContext('2d').drawImage(src, mx, my, mw, mh, 0, 0, cols, rows)
                g.save()
                g.imageSmoothingEnabled = false
                g.drawImage(t, 0, 0, cols, rows, mx, my, mw, mh)
                g.restore()
              }
            }
          }
          g.restore()
        }

        function renderAll(g, list) {
          for (var i = 0; i < list.length; i++) renderOne(g, list[i])
        }

        function draw() {
          var cv = cvRef.current
          var src = state.src
          if (!cv || !src) return
          var g = cv.getContext('2d')
          g.setTransform(1, 0, 0, 1, 0, 0)
          g.clearRect(0, 0, W, H)
          g.drawImage(src, 0, 0, W, H)
          var s = drag && drag.mode === 'new' ? drag.rect : sel
          if (s && s.w > 1 && s.h > 1) {
            g.save()
            g.fillStyle = 'rgba(0,0,0,.45)'
            g.fillRect(0, 0, W, s.y)
            g.fillRect(0, s.y + s.h, W, H - s.y - s.h)
            g.fillRect(0, s.y, s.x, s.h)
            g.fillRect(s.x + s.w, s.y, W - s.x - s.w, s.h)
            g.restore()
            g.save()
            g.beginPath()
            g.rect(s.x, s.y, s.w, s.h)
            g.clip()
            renderAll(g, strokes)
            if (drag && drag.preview) renderOne(g, drag.preview)
            g.restore()
            var blw = Math.max(1, 2 / scale)
            g.save()
            g.strokeStyle = GREEN
            g.lineWidth = blw
            g.strokeRect(s.x + blw / 2, s.y + blw / 2, Math.max(0, s.w - blw), Math.max(0, s.h - blw))
            g.restore()
            if (!(drag && drag.mode === 'new')) {
              var hs = Math.max(4, 9 / scale)
              var pts = [
                [s.x, s.y],
                [s.x + s.w / 2, s.y],
                [s.x + s.w, s.y],
                [s.x + s.w, s.y + s.h / 2],
                [s.x + s.w, s.y + s.h],
                [s.x + s.w / 2, s.y + s.h],
                [s.x, s.y + s.h],
                [s.x, s.y + s.h / 2],
              ]
              g.save()
              g.fillStyle = GREEN
              for (var i = 0; i < pts.length; i++) {
                var hx = pts[i][0] - hs / 2
                var hy = pts[i][1] - hs / 2
                if (typeof g.roundRect === 'function') {
                  g.beginPath()
                  g.roundRect(hx, hy, hs, hs, Math.max(0.5, 1.6 / scale))
                  g.fill()
                } else g.fillRect(hx, hy, hs, hs)
              }
              g.restore()
            }
          } else if (drag && drag.preview) {
            g.save()
            g.beginPath()
            g.rect(0, 0, W, H)
            g.clip()
            renderOne(g, drag.preview)
            g.restore()
          }
        }

        React.useEffect(function () {
          draw()
        })

        React.useEffect(
          function () {
            var b = barRef.current
            if (b) setBarW(b.offsetWidth)
            var p = panelRef.current
            var w = p ? p.offsetWidth : 170
            var act = btnRef.current
            if (!b || !act) {
              setPanelX(0)
              return
            }
            var x = act.offsetLeft + act.offsetWidth / 2
            setPanelX(clamp(x, w / 2 + 6, Math.max(w / 2 + 6, b.clientWidth - w / 2 - 6)))
          },
          [tool, view, sel, strokes, lw, color],
        )

        function toImg(e) {
          var r = cvRef.current.getBoundingClientRect()
          return { x: clamp((e.clientX - r.left) / scale, 0, W), y: clamp((e.clientY - r.top) / scale, 0, H) }
        }

        function hitHandle(p, s) {
          var tol = 11 / scale
          var xs = [
            [s.x, 'w'],
            [s.x + s.w / 2, ''],
            [s.x + s.w, 'e'],
          ]
          var ys = [
            [s.y, 'n'],
            [s.y + s.h / 2, ''],
            [s.y + s.h, 's'],
          ]
          for (var i = 0; i < 3; i++) {
            for (var j = 0; j < 3; j++) {
              if (!xs[i][1] && !ys[j][1]) continue
              if (Math.abs(p.x - xs[i][0]) <= tol && Math.abs(p.y - ys[j][0]) <= tol) return ys[j][1] + xs[i][1]
            }
          }
          return null
        }

        function resizeRect(o, hname, p) {
          var x1 = o.x
          var y1 = o.y
          var x2 = o.x + o.w
          var y2 = o.y + o.h
          if (hname.indexOf('w') >= 0) x1 = p.x
          else if (hname.indexOf('e') >= 0) x2 = p.x
          if (hname.indexOf('n') >= 0) y1 = p.y
          else if (hname.indexOf('s') >= 0) y2 = p.y
          x1 = clamp(x1, 0, W)
          x2 = clamp(x2, 0, W)
          y1 = clamp(y1, 0, H)
          y2 = clamp(y2, 0, H)
          return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) }
        }

        function commitText() {
          if (!txt) return
          var v = String(txt.value || '').replace(/\s+$/, '')
          if (v) {
            setStrokes(strokes.concat([{ type: 'text', x: txt.x, y: txt.y, text: v, color: color, lw: lw, size: Math.round(18 + lw * 3.5) }]))
            setRedo([])
          }
          setTxt(null)
        }

        function onDown(e) {
          if (e.button !== 0) return
          e.preventDefault()
          try {
            rootRef.current.setPointerCapture(e.pointerId)
          } catch (err) {}
          var p = toImg(e)
          if (txt) commitText()
          if (!sel) {
            setDrag({ mode: 'new', anchor: p, rect: { x: p.x, y: p.y, w: 0, h: 0 } })
            return
          }
          if (tool === 'select') {
            var hh = hitHandle(p, sel)
            if (hh) {
              setDrag({ mode: 'resize', handle: hh, orig: sel, anchor: p })
              return
            }
            if (inside(p, sel)) {
              setDrag({ mode: 'move', orig: sel, anchor: p })
              return
            }
            setDrag({ mode: 'new', anchor: p, rect: { x: p.x, y: p.y, w: 0, h: 0 } })
            return
          }
          if (tool === 'text') {
            if (inside(p, sel)) setTxt({ x: p.x, y: p.y, value: '' })
            return
          }
          if (!inside(p, sel)) {
            setDrag({ mode: 'new', anchor: p, rect: { x: p.x, y: p.y, w: 0, h: 0 } })
            return
          }
          var pv
          if (tool === 'pen') pv = { type: 'pen', pts: [[p.x, p.y]], color: color, lw: lw }
          else if (tool === 'arrow') pv = { type: 'arrow', x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: color, lw: lw }
          else if (tool === 'mosaic') pv = { type: 'mosaic', x: p.x, y: p.y, w: 0, h: 0, color: color, lw: lw }
          else pv = { type: tool, x: p.x, y: p.y, w: 0, h: 0, color: color, lw: lw }
          setDrag({ mode: 'draw', anchor: p, preview: pv })
        }

        function onMove(e) {
          if (!drag) return
          var p = toImg(e)
          if (drag.mode === 'new') {
            setDrag({ mode: 'new', anchor: drag.anchor, rect: normRect(drag.anchor, p) })
          } else if (drag.mode === 'move') {
            var dx = p.x - drag.anchor.x
            var dy = p.y - drag.anchor.y
            var o = drag.orig
            setSel({ x: clamp(o.x + dx, 0, Math.max(0, W - o.w)), y: clamp(o.y + dy, 0, Math.max(0, H - o.h)), w: o.w, h: o.h })
          } else if (drag.mode === 'resize') {
            setSel(resizeRect(drag.orig, drag.handle, p))
          } else if (drag.mode === 'draw') {
            var pv = drag.preview
            if (pv.type === 'pen') {
              setDrag({ mode: 'draw', anchor: drag.anchor, preview: { type: 'pen', pts: pv.pts.concat([[p.x, p.y]]), color: pv.color, lw: pv.lw } })
            } else if (pv.type === 'arrow') {
              setDrag({ mode: 'draw', anchor: drag.anchor, preview: { type: 'arrow', x1: pv.x1, y1: pv.y1, x2: p.x, y2: p.y, color: pv.color, lw: pv.lw } })
            } else if (pv.type === 'mosaic') {
              setDrag({ mode: 'draw', anchor: drag.anchor, preview: { type: 'mosaic', x: pv.x, y: pv.y, w: Math.abs(p.x - pv.x), h: Math.abs(p.y - pv.y), color: pv.color, lw: pv.lw } })
            } else {
              var r = normRect(pv, p)
              setDrag({ mode: 'draw', anchor: drag.anchor, preview: { type: pv.type, x: r.x, y: r.y, w: r.w, h: r.h, color: pv.color, lw: pv.lw } })
            }
          }
        }

        function onUp() {
          if (!drag) return
          var d = drag
          setDrag(null)
          if (d.mode === 'new') {
            setSel(d.rect.w > 4 && d.rect.h > 4 ? d.rect : null)
          } else if (d.mode === 'draw') {
            var pv = d.preview
            var ok = true
            if (pv.type === 'pen') ok = (pv.pts || []).length > 1
            else if (pv.type === 'arrow') ok = Math.abs(pv.x2 - pv.x1) + Math.abs(pv.y2 - pv.y1) > 4
            else ok = pv.w > 4 && pv.h > 4
            if (ok) {
              setStrokes(strokes.concat([pv]))
              setRedo([])
            }
          }
        }

        function buildOut() {
          var src = state.src
          var s = sel || { x: 0, y: 0, w: W, h: H }
          var x = Math.round(clamp(s.x, 0, W))
          var y = Math.round(clamp(s.y, 0, H))
          var w = Math.round(clamp(Math.min(s.w, W - x), 1, W))
          var h = Math.round(clamp(Math.min(s.h, H - y), 1, H))
          var cv = document.createElement('canvas')
          cv.width = w
          cv.height = h
          var g = cv.getContext('2d')
          g.drawImage(src, x, y, w, h, 0, 0, w, h)
          g.save()
          g.translate(-x, -y)
          renderAll(g, strokes)
          g.restore()
          return cv
        }

        function closeNow() {
          setDrag(null)
          setTxt(null)
          setFlash(null)
          patch({ active: false, src: null, error: '' })
        }

        function doFinish() {
          var cv = buildOut()
          if (typeof cv.toBlob !== 'function') {
            setFlash({ text: '当前浏览器不支持导出', auto: false })
            return
          }
          cv.toBlob(function (blob) {
            if (!blob) {
              setFlash({ text: '导出失败', auto: false })
              return
            }
            copyToClipboard(blob).then(function (copied) {
              var pasted = pasteIntoComposer(blob)
              log({ step: 'finish', w: cv.width, h: cv.height, copied: copied, pasted: pasted })
              if (pasted) setFlash({ text: '已插入输入框' + (copied ? '（同时已复制）' : ''), auto: true })
              else if (copied) setFlash({ text: '已复制，回输入框 Ctrl+V 粘贴', auto: true })
              else setFlash({ text: '插入失败，请用「保存」下载', auto: false })
            })
          }, 'image/png')
        }

        function doSave() {
          try {
            var cv = buildOut()
            var d = new Date()
            var name =
              '截图-' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-' + pad2(d.getHours()) + pad2(d.getMinutes()) + pad2(d.getSeconds()) + '.png'
            var a = document.createElement('a')
            a.download = name
            a.href = cv.toDataURL('image/png')
            document.body.appendChild(a)
            a.click()
            if (a.parentNode) a.parentNode.removeChild(a)
            log({ step: 'save', name: name })
            setFlash({ text: '已保存 ' + name, auto: true })
          } catch (err) {
            setFlash({ text: '保存失败：' + ((err && err.message) || String(err)), auto: false })
          }
        }

        function doUndo() {
          if (!strokes.length) return
          setRedo([strokes[strokes.length - 1]].concat(redo))
          setStrokes(strokes.slice(0, strokes.length - 1))
        }

        function doRedo() {
          if (!redo.length) return
          setStrokes(strokes.concat([redo[0]]))
          setRedo(redo.slice(1))
        }

        function doMaskAll() {
          if (!sel) return
          setStrokes(strokes.concat([{ type: 'mosaic', x: sel.x, y: sel.y, w: sel.w, h: sel.h, color: color, lw: lw }]))
          setRedo([])
          setTool('select')
        }

        React.useEffect(
          function () {
            if (!active && !pending) return
            function onKey(e) {
              var k = e.key || ''
              if (k === 'Escape') {
                e.preventDefault()
                e.stopPropagation()
                if (pending && !active) {
                  cancelPending()
                  return
                }
                if (txt) {
                  setTxt(null)
                  return
                }
                closeNow()
                return
              }
              if (!active) return
              if (k === 'Enter') {
                if (txt) return
                e.preventDefault()
                e.stopPropagation()
                doFinish()
                return
              }
              if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'Z')) {
                e.preventDefault()
                e.stopPropagation()
                if (e.shiftKey) doRedo()
                else doUndo()
                return
              }
              if ((e.ctrlKey || e.metaKey) && (k === 'y' || k === 'Y')) {
                e.preventDefault()
                e.stopPropagation()
                doRedo()
                return
              }
              if ((e.ctrlKey || e.metaKey) && !e.altKey && (k === 'a' || k === 'A')) {
                if (txt) return
                e.preventDefault()
                e.stopPropagation()
                setSel({ x: 0, y: 0, w: W, h: H })
              }
            }
            window.addEventListener('keydown', onKey, true)
            return function () {
              window.removeEventListener('keydown', onKey, true)
            }
          },
          [active, pending, txt, sel, strokes, redo, color, lw, tool],
        )

        if (!active && !pending && !state.error) return null

        if (pending && !active) {
          return React.createElement('div', {
            key: 'wd',
            className: 'dshot-watchdog',
            onAnimationEnd: function () {
              if (!state.pending) return
              log({ step: 'watchdog-timeout' })
              patch({ pending: false, error: '抓屏超时：host 25 秒未返回（已写入日志）' })
            },
          })
        }

        if (!active) {
          return React.createElement(
            'div',
            { className: 'dshot-toast' },
            React.createElement('span', null, state.error),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'dshot-x',
                title: '关闭',
                onClick: function () {
                  patch({ error: '' })
                },
              },
              '✕',
            ),
          )
        }

        function stop(e) {
          e.stopPropagation()
        }

        function tb(key, icon, title, on, fn, disabled, cls) {
          var props = {
            key: key,
            type: 'button',
            className: 'dshot-tb',
            title: title,
            'data-on': on ? '1' : '0',
            disabled: !!disabled,
            onPointerDown: stop,
            onClick: function (e) {
              e.preventDefault()
              e.stopPropagation()
              if (!disabled) fn()
            },
          }
          if (cls === 'x') props['data-red'] = '1'
          if (cls === 'ok') props['data-green'] = '1'
          if (on) props.ref = btnRef
          return React.createElement('button', props, icon)
        }

        function sep(key) {
          return React.createElement('div', { key: key, className: 'dshot-sep' })
        }
        function pick(name) {
          setTool(tool === name ? 'select' : name)
        }

        var bar = null
        if (sel) {
          bar = []
          bar.push(tb('rect', ICON.rect(), '矩形', tool === 'rect', function () { pick('rect') }))
          bar.push(tb('ellipse', ICON.ellipse(), '椭圆', tool === 'ellipse', function () { pick('ellipse') }))
          bar.push(tb('arrow', ICON.arrow(), '箭头', tool === 'arrow', function () { pick('arrow') }))
          bar.push(tb('pen', ICON.pen(), '画笔', tool === 'pen', function () { pick('pen') }))
          bar.push(tb('mosaic', ICON.mosaic(), '马赛克', tool === 'mosaic', function () { pick('mosaic') }))
          bar.push(tb('text', ICON.text(), '文字', tool === 'text', function () { pick('text') }))
          bar.push(sep('s1'))
          bar.push(tb('undo', ICON.undo(), '撤销 (Ctrl+Z)', false, doUndo, !strokes.length))
          bar.push(sep('s2'))
          bar.push(tb('save', ICON.save(), '保存为 PNG', false, doSave))
          bar.push(tb('cancel', ICON.close(), '取消 (Esc)', false, closeNow, false, 'x'))
          bar.push(tb('ok', ICON.check(), '完成 (Enter)', false, doFinish, false, 'ok'))
        }

        var panel = null
        if (sel && tool !== 'select') {
          panel = []
          for (var wi = 0; wi < WIDTHS.length; wi++) {
            ;(function (w0, i) {
              var d = [6, 9, 12][i]
              panel.push(
                React.createElement(
                  'button',
                  {
                    key: 'w' + i,
                    type: 'button',
                    className: 'dshot-pdb',
                    title: ['细', '中', '粗'][i],
                    'data-on': lw === w0 ? '1' : '0',
                    onPointerDown: stop,
                    onClick: function (e) {
                      e.preventDefault()
                      e.stopPropagation()
                      setLw(w0)
                    },
                  },
                  React.createElement('span', { className: 'dshot-dot', style: { width: d + 'px', height: d + 'px' } }),
                ),
              )
            })(WIDTHS[wi], wi)
          }
          panel.push(React.createElement('div', { key: 'ps', className: 'dshot-sep' }))
          for (var ci = 0; ci < COLORS.length; ci++) {
            ;(function (c) {
              panel.push(
                React.createElement('button', {
                  key: 'c' + c,
                  type: 'button',
                  className: 'dshot-sw',
                  title: '颜色',
                  style: { background: c },
                  'data-on': color === c ? '1' : '0',
                  onPointerDown: stop,
                  onClick: function (e) {
                    e.preventDefault()
                    e.stopPropagation()
                    setColor(c)
                  },
                }),
              )
            })(COLORS[ci])
          }
          if (tool === 'mosaic') {
            panel.push(
              React.createElement(
                'button',
                {
                  key: 'pill',
                  type: 'button',
                  className: 'dshot-pill',
                  onPointerDown: stop,
                  onClick: function (e) {
                    e.preventDefault()
                    e.stopPropagation()
                    doMaskAll()
                  },
                },
                ICON.mask(),
                '一键打码',
              ),
            )
          }
        }

        var children = []
        if (state.bg) {
          children.push(React.createElement('div', { key: 'bg', className: 'dshot-bg', style: { backgroundImage: 'url("' + state.bg + '")' } }))
        }
        children.push(
          React.createElement('canvas', {
            key: 'cv',
            ref: cvRef,
            className: 'dshot-stage',
            width: W,
            height: H,
            style: { left: ox + 'px', top: oy + 'px', width: dw + 'px', height: dh + 'px' },
          }),
        )
        children.push(
          React.createElement('div', {
            key: 'fr',
            className: 'dshot-frame',
            style: { left: ox + 'px', top: oy + 'px', width: dw + 'px', height: dh + 'px' },
          }),
        )

        children.push(
          React.createElement(
            'div',
            { key: 'meta', className: 'dshot-meta' },
            '桌面 ' + W + ' x ' + H + (sel ? '' : ' · 拖动框选想要的部分'),
          ),
        )

        if (sel) {
          children.push(
            React.createElement(
              'div',
              {
                key: 'size',
                className: 'dshot-size',
                style: {
                  left: clamp(ox + sel.x * scale, 2, Math.max(2, view[0] - 120)) + 'px',
                  top: (oy + sel.y * scale - 20 >= 2 ? oy + sel.y * scale - 20 : oy + sel.y * scale + 4) + 'px',
                },
              },
              Math.round(sel.w) + ' x ' + Math.round(sel.h),
            ),
          )
        }

        if (flash) {
          children.push(
            React.createElement(
              'div',
              {
                key: 'flash',
                className: 'dshot-toast',
                'data-auto': flash.auto ? '1' : '0',
                onAnimationEnd: function () {
                  if (flash.auto) closeNow()
                },
              },
              React.createElement('span', null, flash.text),
            ),
          )
        }

        if (txt) {
          children.push(
            React.createElement('input', {
              key: 'txt',
              className: 'dshot-txt',
              autoFocus: true,
              value: txt.value,
              style: {
                left: ox + txt.x * scale + 'px',
                top: oy + txt.y * scale + 'px',
                color: color,
                fontSize: Math.max(10, (18 + lw * 3.5) * scale) + 'px',
              },
              onPointerDown: stop,
              onPointerMove: stop,
              onPointerUp: stop,
              onChange: function (e) {
                setTxt({ x: txt.x, y: txt.y, value: e.target.value })
              },
              onKeyDown: function (e) {
                e.stopPropagation()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitText()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setTxt(null)
                }
              },
              onBlur: function () {
                commitText()
              },
            }),
          )
        }

        if (bar) {
          var barH = 48
          var bx = ox + (sel.x + sel.w) * scale - barW
          bx = clamp(bx, 8, Math.max(8, view[0] - barW - 8))
          var below = oy + (sel.y + sel.h) * scale + 8
          var by = below + barH <= view[1] - 8 ? below : oy + sel.y * scale - barH - 8
          by = clamp(by, 48, Math.max(48, view[1] - barH - 8))
          children.push(
            React.createElement(
              'div',
              {
                key: 'bar',
                className: 'dshot-bar',
                ref: barRef,
                style: { left: (barW ? bx : -9999) + 'px', top: by + 'px' },
                onPointerDown: stop,
                onPointerMove: stop,
                onPointerUp: stop,
                onDoubleClick: stop,
              },
              bar.concat(
                panel
                  ? [
                      React.createElement(
                        'div',
                        {
                          key: 'panel',
                          className: 'dshot-panel',
                          ref: panelRef,
                          style: { left: (panelX || 60) + 'px', visibility: panelX ? 'visible' : 'hidden' },
                        },
                        panel,
                      ),
                    ]
                  : [],
              ),
            ),
          )
        } else {
          children.push(
            React.createElement(
              'button',
              {
                key: 'esc',
                type: 'button',
                className: 'dshot-esc',
                title: '取消 (Esc)',
                onPointerDown: stop,
                onClick: function (e) {
                  e.preventDefault()
                  e.stopPropagation()
                  closeNow()
                },
              },
              ICON.close(),
            ),
          )
        }

        return React.createElement(
          'div',
          {
            className: 'dshot-root',
            ref: rootRef,
            style: { cursor: !sel || tool !== 'select' ? 'crosshair' : 'move' },
            onPointerDown: onDown,
            onPointerMove: onMove,
            onPointerUp: onUp,
            onPointerCancel: onUp,
            onDoubleClick: function (e) {
              e.preventDefault()
              if (sel) doFinish()
            },
            onContextMenu: function (e) {
              e.preventDefault()
              closeNow()
            },
          },
          children,
        )
      }

      ctx.effect(function () {
        function onKey(e) {
          if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
          var k = e.key || ''
          if (k === 'a' || k === 'A' || e.code === 'KeyA') {
            e.preventDefault()
            e.stopPropagation()
            startCapture(false)
          }
        }
        window.addEventListener('keydown', onKey, true)
        return function () {
          window.removeEventListener('keydown', onKey, true)
        }
      })

      ctx.slots.inject('conversation.input.left', function () {
        return ctx.slots.register({ name: 'conversation.input.left', id: 'shotcut', order: 60, label: '截图' }, ShotButton)
      })

      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({ name: 'shell.overlay', id: 'shotcut-overlay', order: 900, label: '截图遮罩' }, ShotOverlay)
      })
    }

    exports.name = 'shotcut'
    exports.inject = ['slots']
    exports.apply = function (ctx) {
      try {
        apply(ctx)
      } catch (error) {
        // 绝不让插件把整页拖下水
        console.error('[shotcut] 初始化失败', error)
      }
    }
    return module.exports
  },
})
