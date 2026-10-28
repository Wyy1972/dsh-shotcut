# -*- coding: utf-8 -*-
"""dshot 抓屏核心（v1.4）。

两种模式：
  1) 普通模式  capture.py <out.png> [keepSelf]
     抓本页窗口客户区那一块，铺满即 1:1，不缩小。
  2) 全屏模式  capture.py <out.png> 0 --fullscreen
     先把本页临时铺满整个虚拟屏幕（透明状态下做，用户看不到重排），
     再抓整屏，然后**保持铺满**、只恢复不透明 ——
     这样前端覆盖层就能盖住全屏，用户可以框选 DSH 窗口以外的画面。
     窗口几何记在 window_state.json，由前端收工时显式调用 --restore 还原。

  3) 还原模式  capture.py --restore
     读 window_state.json，把窗口位置/大小/透明度原样还原。

为什么不再用"后台守卫进程轮询文件"：那个办法会让多个守卫同时存活、互相
抢着还原窗口，实测把一次点击拖到 17~52 秒。现在改成显式调用，快且可控。
"""
import ctypes
import json
import os
import sys
import time
from ctypes import wintypes

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass

HERE = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(HERE, 'window_state.json')

GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x00080000
LWA_ALPHA = 0x00000002
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
SM_XVIRTUALSCREEN = 76
SM_YVIRTUALSCREEN = 77
SM_CXVIRTUALSCREEN = 78
SM_CYVIRTUALSCREEN = 79
SWP_NOACTIVATE = 0x0010
SWP_SHOWWINDOW = 0x0040

BROWSERS = ('msedge', 'chrome', 'firefox', 'brave', 'vivaldi', 'opera',
            'iexplore', '360se', '360chrome', 'qqbrowser', 'sogou', 'maxthon')


class RECT(ctypes.Structure):
    _fields_ = [('left', wintypes.LONG), ('top', wintypes.LONG),
                ('right', wintypes.LONG), ('bottom', wintypes.LONG)]


class POINT(ctypes.Structure):
    _fields_ = [('x', wintypes.LONG), ('y', wintypes.LONG)]


user32.GetForegroundWindow.restype = wintypes.HWND
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
user32.IsWindowVisible.argtypes = [wintypes.HWND]
user32.IsIconic.argtypes = [wintypes.HWND]
user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(RECT)]
user32.GetClientRect.argtypes = [wintypes.HWND, ctypes.POINTER(RECT)]
user32.ClientToScreen.argtypes = [wintypes.HWND, ctypes.POINTER(POINT)]
user32.EnumWindows.argtypes = [ctypes.c_void_p, wintypes.LPARAM]
user32.GetSystemMetrics.argtypes = [ctypes.c_int]
user32.GetSystemMetrics.restype = ctypes.c_int
user32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int,
                                ctypes.c_int, ctypes.c_int, ctypes.c_uint]
user32.SetWindowPos.restype = wintypes.BOOL
user32.SetLayeredWindowAttributes.argtypes = [wintypes.HWND, wintypes.DWORD,
                                              ctypes.c_byte, wintypes.DWORD]
user32.SetLayeredWindowAttributes.restype = wintypes.BOOL
try:
    user32.GetWindowLongPtrW.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.GetWindowLongPtrW.restype = ctypes.c_ssize_t
    user32.SetWindowLongPtrW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_ssize_t]
    user32.SetWindowLongPtrW.restype = ctypes.c_ssize_t
    _get_long = user32.GetWindowLongPtrW
    _set_long = user32.SetWindowLongPtrW
except AttributeError:
    user32.GetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int]
    user32.GetWindowLongW.restype = ctypes.c_long
    user32.SetWindowLongW.argtypes = [wintypes.HWND, ctypes.c_int, ctypes.c_long]
    user32.SetWindowLongW.restype = ctypes.c_long
    _get_long = user32.GetWindowLongW
    _set_long = user32.SetWindowLongW

kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
kernel32.OpenProcess.restype = wintypes.HANDLE
kernel32.QueryFullProcessImageNameW.argtypes = [wintypes.HANDLE, wintypes.DWORD,
                                                wintypes.LPWSTR, ctypes.POINTER(wintypes.DWORD)]
kernel32.CloseHandle.argtypes = [wintypes.HANDLE]


def virtual_origin():
    return (user32.GetSystemMetrics(SM_XVIRTUALSCREEN),
            user32.GetSystemMetrics(SM_YVIRTUALSCREEN))


def client_rect_screen(hwnd):
    if not hwnd:
        return None
    r = RECT()
    if not user32.GetClientRect(hwnd, ctypes.byref(r)):
        return None
    w = r.right - r.left
    h = r.bottom - r.top
    if w < 40 or h < 40:
        return None
    pt = POINT(r.left, r.top)
    if not user32.ClientToScreen(hwnd, ctypes.byref(pt)):
        return None
    return (pt.x, pt.y, w, h)


def win_rect(hwnd):
    r = RECT()
    if not user32.GetWindowRect(hwnd, ctypes.byref(r)):
        return None
    return (r.left, r.top, r.right - r.left, r.bottom - r.top)


def proc_name(hwnd):
    pid = wintypes.DWORD()
    user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))
    if not pid.value:
        return ''
    h = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, pid.value)
    if not h:
        return ''
    try:
        buf = ctypes.create_unicode_buffer(1024)
        size = wintypes.DWORD(1024)
        if not kernel32.QueryFullProcessImageNameW(h, 0, buf, ctypes.byref(size)):
            return ''
        return buf.value.rsplit('\\', 1)[-1].lower()
    finally:
        kernel32.CloseHandle(h)


def find_target():
    skip = ('python.exe', 'pythonw.exe', 'node.exe', 'cmd.exe', 'powershell.exe',
            'pwsh.exe', 'conhost.exe', 'windowsterminal.exe', 'explorer.exe')
    fg = user32.GetForegroundWindow()
    if fg and user32.IsWindowVisible(fg) and not user32.IsIconic(fg):
        n = proc_name(fg)
        if n and n not in skip and user32.GetWindowTextLengthW(fg) > 0:
            return fg
    found = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(hwnd, _l):
        if not user32.IsWindowVisible(hwnd) or user32.IsIconic(hwnd):
            return True
        if user32.GetWindowTextLengthW(hwnd) <= 0:
            return True
        n = proc_name(hwnd)
        if not n or n in skip:
            return True
        if any(b in n for b in BROWSERS) or 'dsh' in n or 'deepseek' in n:
            found.append(hwnd)
            return False
        return True

    user32.EnumWindows(cb, 0)
    return found[0] if found else 0


def set_alpha(hwnd, alpha, st):
    try:
        ex0 = _get_long(hwnd, GWL_EXSTYLE)
        layered = bool(ex0 & WS_EX_LAYERED)
        if not layered:
            _set_long(hwnd, GWL_EXSTYLE, ex0 | WS_EX_LAYERED)
        user32.SetLayeredWindowAttributes(hwnd, 0, alpha, LWA_ALPHA)
        if st is not None:
            st['ex0'] = int(ex0)
            st['layered_before'] = layered
        return True
    except Exception:
        return False


def save_state(st):
    try:
        with open(STATE_FILE, 'w', encoding='utf-8') as f:
            json.dump(st, f)
    except Exception:
        pass


def load_state():
    try:
        with open(STATE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return None


def do_restore():
    """还原窗口：透明度 + 位置大小。返回是否成功。"""
    st = load_state()
    if not st:
        return False
    ok = False
    try:
        hwnd = int(st.get('hwnd') or 0)
        rect = st.get('rect') or [0, 0, 0, 0]
        if hwnd:
            try:
                user32.SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA)
            except Exception:
                pass
            user32.SetWindowPos(hwnd, None, int(rect[0]), int(rect[1]),
                                int(rect[2]), int(rect[3]),
                                SWP_NOACTIVATE | SWP_SHOWWINDOW)
            if not st.get('layered_before'):
                try:
                    _set_long(hwnd, GWL_EXSTYLE, int(st.get('ex0') or 0))
                except Exception:
                    pass
            ok = True
    except Exception:
        ok = False
    try:
        os.remove(STATE_FILE)
    except Exception:
        pass
    return ok


def crop_exact(img, box, min_side=40):
    from PIL import Image
    vx, vy = virtual_origin()
    bw, bh = int(box[2]), int(box[3])
    if bw < min_side or bh < min_side:
        return None
    bx = int(box[0]) - vx
    by = int(box[1]) - vy
    iw, ih = img.size
    sx0 = max(0, bx)
    sy0 = max(0, by)
    sx1 = min(iw, bx + bw)
    sy1 = min(ih, by + bh)
    if sx1 - sx0 < min_side or sy1 - sy0 < min_side:
        return None
    part = img.crop((sx0, sy0, sx1, sy1))
    out = Image.new('RGB', (bw, bh), (0, 0, 0))
    dx = sx0 - bx
    dy = sy0 - by
    out.paste(part, (dx, dy))
    pw, ph = part.size
    if dy > 0:
        out.paste(part.crop((0, 0, pw, 1)).resize((pw, dy)), (dx, 0))
    if dy + ph < bh:
        out.paste(part.crop((0, ph - 1, pw, ph)).resize((pw, bh - dy - ph)), (dx, dy + ph))
    if dx > 0:
        out.paste(out.crop((dx, 0, dx + 1, bh)).resize((dx, bh)), (0, 0))
    if dx + pw < bw:
        out.paste(out.crop((dx + pw - 1, 0, dx + pw, bh)).resize((bw - dx - pw, bh)), (dx + pw, 0))
    return [sx0, sy0, sx1 - sx0, sy1 - sy0], out


def main():
    if len(sys.argv) > 1 and sys.argv[1] == '--restore':
        ok = do_restore()
        print(json.dumps({'ok': ok}, ensure_ascii=False))
        return

    if len(sys.argv) > 1 and sys.argv[1] == '--show':
        # 全屏抓取后窗口还是全透明的。等前端把冻结图画好，再显形 ——
        # 显形那一刻用户看到的正好是那张冻结图，所以不会有"界面被拉伸"的闪烁。
        st = load_state()
        ok = False
        if st:
            try:
                hwnd = int(st.get('hwnd') or 0)
                user32.SetLayeredWindowAttributes(hwnd, 0, 255, LWA_ALPHA)
                if not st.get('layered_before'):
                    _set_long(hwnd, GWL_EXSTYLE, int(st.get('ex0') or 0))
                ok = True
            except Exception:
                ok = False
        print(json.dumps({'ok': ok}, ensure_ascii=False))
        return

    t0 = time.time()
    out = sys.argv[1]
    keep = len(sys.argv) > 2 and sys.argv[2] in ('1', 'true', 'yes')
    fullscreen = any(a == '--fullscreen' for a in sys.argv)

    from PIL import ImageGrab
    err = ''
    w = h = 0
    hideway = 'none'
    crop = None
    cbox = None
    target = 0
    expanded = False

    try:
        target = find_target()
        if not target:
            raise RuntimeError('找不到本页窗口')

        # 上次会话异常退出（崩溃/强关）会留下状态文件，窗口可能还铺满着。
        # 这里先兜底还原一次，免得用户下次点剪刀时看到整个界面被拉伸。
        if os.path.exists(STATE_FILE):
            do_restore()
            time.sleep(0.12)

        if fullscreen and not keep:
            # 先取原始几何，再在同一帧里"置透明 + 铺满"，
            # 用户看不到重排（实测 38ms）。
            orig = win_rect(target)
            cl = client_rect_screen(target)
            if not orig or not cl:
                raise RuntimeError('拿不到窗口几何')
            dl = cl[0] - orig[0]
            dt = cl[1] - orig[1]
            dr = (orig[0] + orig[2]) - (cl[0] + cl[2])
            db = (orig[1] + orig[3]) - (cl[1] + cl[3])
            vx = user32.GetSystemMetrics(SM_XVIRTUALSCREEN)
            vy = user32.GetSystemMetrics(SM_YVIRTUALSCREEN)
            vw = user32.GetSystemMetrics(SM_CXVIRTUALSCREEN)
            vh = user32.GetSystemMetrics(SM_CYVIRTUALSCREEN)

            # 关键：如果窗口**已经**铺满（上一次抓取还没还原就又抓一次），
            # 绝不能把当前的铺满尺寸当成"原始尺寸"存下来，否则还原时就是还原成铺满，
            # 用户会看到窗口永远回不去。这种情况要沿用上一次记下的原始几何。
            already = load_state()
            expanded_now = abs(orig[2] - (vw + dl + dr)) <= 4 and abs(orig[3] - (vh + dt + db)) <= 4
            if expanded_now and already and already.get('rect'):
                orig = list(already['rect'])
            elif expanded_now:
                # 上次状态丢了，至少给一个能用的窗口尺寸，别让用户卡在全屏。
                ow = min(1619, vw)
                oh = min(1036, vh)
                orig = [max(0, vx + (vw - ow) // 2), max(0, vy + (vh - oh) // 2), ow, oh]

            st = {'hwnd': int(target), 'rect': list(orig)}
            set_alpha(target, 0, st)          # 先隐身，避免看到拉伸
            user32.SetWindowPos(target, None, vx - dl, vy - dt,
                                vw + dl + dr, vh + dt + db,
                                SWP_NOACTIVATE | SWP_SHOWWINDOW)
            save_state(st)                    # 先落盘，前端收工时用它还原
            expanded = True
            time.sleep(0.12)                  # 等视口跟随窗口尺寸
            shot = ImageGrab.grab(all_screens=True).convert('RGB')
            hideway = 'alpha'
            # 注意：这里**不显形**。窗口保持全透明，等前端把冻结图画好再调 --show，
            # 否则用户会先看到被拉伸的 DSH 界面（窗口已铺满但覆盖层还没画）。
        elif keep:
            shot = ImageGrab.grab(all_screens=True).convert('RGB')
        else:
            # 普通模式：本页透明一下再抓，抓完立刻还原（窗口大小不动）
            ok, undo = (False, None)
            try:
                ex0 = _get_long(target, GWL_EXSTYLE)
                layered_before = bool(ex0 & WS_EX_LAYERED)
                if not layered_before:
                    _set_long(target, GWL_EXSTYLE, ex0 | WS_EX_LAYERED)
                ok = bool(user32.SetLayeredWindowAttributes(target, 0, 0, LWA_ALPHA))
            except Exception:
                ok = False
            try:
                if ok:
                    time.sleep(0.06)
                    hideway = 'alpha'
                shot = ImageGrab.grab(all_screens=True).convert('RGB')
            finally:
                if ok:
                    try:
                        user32.SetLayeredWindowAttributes(target, 0, 255, LWA_ALPHA)
                        if not layered_before:
                            _set_long(target, GWL_EXSTYLE, ex0)
                    except Exception:
                        pass

        final = shot
        if not expanded:
            cbox = client_rect_screen(target)
            if cbox:
                got = crop_exact(final, cbox)
                if got is not None:
                    crop, final = got

        # 全屏图 3840x1080 默认压缩要 500ms+，用户能感知到。压得浅一点，快 3 倍。
        if w * h > 2000000 or expanded:
            final.save(out, 'PNG', compress_level=1)
        else:
            final.save(out, 'PNG')
        w, h = final.size
    except Exception as e:                            # noqa: BLE001
        err = '抓屏失败（%s）：%s' % (type(e).__name__, e)
        if expanded:
            do_restore()

    print(json.dumps({
        'ok': err == '',
        'w': w,
        'h': h,
        'hide': hideway != 'none',
        'hideway': hideway,
        'crop': crop,
        'client': list(cbox) if cbox else None,
        'target': target,
        'fullscreen': expanded,
        'ms': int((time.time() - t0) * 1000),
        'error': err,
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
