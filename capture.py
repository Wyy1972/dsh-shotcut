# -*- coding: utf-8 -*-
"""dshot 抓屏核心（零闪动）：本页完全不需让开，画面也不闪。

思路：先原样抓下整屏，再把"本页原本盖住的那块区域"用离屏渲染（PrintWindow）重建出来——
桌面打底，然后按 z 序把本页**下面**的窗口逐个画上去，最后贴回原图。全程不改动任何窗口的
层级、位置、焦点、可见性，屏幕上你看到的东西一秒都不变；冻结图里却是"本页不存在"的样子。

用法: capture.py <输出PNG> [keepSelf] [restoreMinimized]
  keepSelf=1  不做重建，直接存整屏（用于"连本页一起截"）。
输出: 一行 JSON，含 ok/w/h/hide/hideway/restored/ms，供 Node 侧解析。
  hideway: offscreen = 离屏重建成功；alpha = 退回"本页临时全透明"老办法；none = 没动过窗口。

alpha 退路只在离屏重建失败时启用（重建出来的区域整块全黑说明 PrintWindow 不可用）。
"""
import ctypes
import json
import sys
import time
from ctypes import wintypes

user32 = ctypes.windll.user32
gdi32 = ctypes.windll.gdi32
kernel32 = ctypes.windll.kernel32

try:
    ctypes.windll.shcore.SetProcessDpiAwareness(2)
except Exception:
    try:
        user32.SetProcessDPIAware()
    except Exception:
        pass

GWL_EXSTYLE = -20
WS_EX_LAYERED = 0x00080000
WS_EX_TOOLWINDOW = 0x00000080
LWA_ALPHA = 0x00000002
SW_SHOWNOACTIVATE = 4
SW_SHOWMINNOACTIVE = 7
SW_HIDE = 0
SW_SHOW = 5
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
PW_RENDERFULLCONTENT = 0x00000002
DWMWA_CLOAK = 13

BROWSERS = ('msedge', 'chrome', 'firefox', 'brave', 'vivaldi', 'opera',
            'iexplore', '360se', '360chrome', 'qqbrowser', 'sogou', 'maxthon')


class RECT(ctypes.Structure):
    _fields_ = [('left', wintypes.LONG), ('top', wintypes.LONG),
                ('right', wintypes.LONG), ('bottom', wintypes.LONG)]


class BMIH(ctypes.Structure):
    _fields_ = [('biSize', wintypes.DWORD), ('biWidth', wintypes.LONG), ('biHeight', wintypes.LONG),
                ('biPlanes', wintypes.WORD), ('biBitCount', wintypes.WORD),
                ('biCompression', wintypes.DWORD), ('biSizeImage', wintypes.DWORD),
                ('biXPelsPerMeter', wintypes.LONG), ('biYPelsPerMeter', wintypes.LONG),
                ('biClrUsed', wintypes.DWORD), ('biClrImportant', wintypes.DWORD)]


user32.GetForegroundWindow.restype = wintypes.HWND
user32.GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
user32.IsWindowVisible.argtypes = [wintypes.HWND]
user32.IsIconic.argtypes = [wintypes.HWND]
user32.GetWindowTextLengthW.argtypes = [wintypes.HWND]
user32.GetWindowRect.argtypes = [wintypes.HWND, ctypes.POINTER(RECT)]
user32.EnumWindows.argtypes = [ctypes.c_void_p, wintypes.LPARAM]
user32.ShowWindowAsync.argtypes = [wintypes.HWND, ctypes.c_int]
user32.ShowWindowAsync.restype = wintypes.BOOL
user32.ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
user32.ShowWindow.restype = wintypes.BOOL
user32.SetWindowPos.argtypes = [wintypes.HWND, wintypes.HWND, ctypes.c_int, ctypes.c_int,
                                ctypes.c_int, ctypes.c_int, ctypes.c_uint]
user32.SetWindowPos.restype = wintypes.BOOL
user32.GetDC.argtypes = [wintypes.HWND]
user32.GetDC.restype = wintypes.HDC
user32.ReleaseDC.argtypes = [wintypes.HWND, wintypes.HDC]
user32.PrintWindow.argtypes = [wintypes.HWND, wintypes.HDC, wintypes.UINT]
user32.PrintWindow.restype = wintypes.BOOL
user32.FindWindowW.argtypes = [wintypes.LPCWSTR, wintypes.LPCWSTR]
user32.FindWindowW.restype = wintypes.HWND
user32.SetLayeredWindowAttributes.argtypes = [wintypes.HWND, wintypes.DWORD,
                                              ctypes.c_byte, wintypes.DWORD]
user32.SetLayeredWindowAttributes.restype = wintypes.BOOL
gdi32.CreateCompatibleDC.argtypes = [wintypes.HDC]
gdi32.CreateCompatibleDC.restype = wintypes.HDC
gdi32.CreateCompatibleBitmap.argtypes = [wintypes.HDC, ctypes.c_int, ctypes.c_int]
gdi32.CreateCompatibleBitmap.restype = wintypes.HANDLE
gdi32.SelectObject.argtypes = [wintypes.HDC, wintypes.HANDLE]
gdi32.SelectObject.restype = wintypes.HANDLE
gdi32.GetDIBits.argtypes = [wintypes.HDC, wintypes.HANDLE, wintypes.UINT, wintypes.UINT,
                            ctypes.c_void_p, ctypes.c_void_p, wintypes.UINT]
gdi32.DeleteObject.argtypes = [wintypes.HANDLE]
gdi32.DeleteDC.argtypes = [wintypes.HDC]
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

try:
    dwmapi = ctypes.windll.dwmapi
    dwmapi.DwmGetWindowAttribute.argtypes = [wintypes.HWND, wintypes.DWORD,
                                             ctypes.c_void_p, wintypes.DWORD]
except Exception:
    dwmapi = None


def rect_of(hwnd):
    r = RECT()
    if not user32.GetWindowRect(hwnd, ctypes.byref(r)):
        return None
    if r.right <= r.left or r.bottom <= r.top:
        return None
    return (r.left, r.top, r.right, r.bottom)


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


def is_browser(hwnd):
    n = proc_name(hwnd)
    return bool(n) and any(b in n for b in BROWSERS)


def is_cloaked(hwnd):
    if dwmapi is None:
        return False
    val = ctypes.c_int(0)
    try:
        hr = dwmapi.DwmGetWindowAttribute(hwnd, DWMWA_CLOAK, ctypes.byref(val), ctypes.sizeof(val))
        return hr == 0 and val.value != 0
    except Exception:
        return False


def z_order():
    """顶层窗口，z 序从上到下。"""
    out = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(hwnd, _l):
        out.append(hwnd)
        return True

    user32.EnumWindows(cb, 0)
    return out


def find_target(order):
    """本页就是"刚被点击的那个窗口"，直接用前台窗口，不去猜进程名。

    DSH 可能跑在浏览器里，也可能跑在自己的桌面应用里（dsh-tauri-app / DeepSeek Harness），
    按进程名白名单认窗口注定会漏。用户点剪刀时焦点必在本页，前台窗口就是它；只有认不出
    （前台是我们的控制台之类）时才退回按名字找 DSH 窗口或浏览器窗口。
    """
    skip = ('python.exe', 'pythonw.exe', 'node.exe', 'cmd.exe', 'powershell.exe',
            'pwsh.exe', 'conhost.exe', 'windowsterminal.exe', 'explorer.exe')
    fg = user32.GetForegroundWindow()
    if fg and user32.IsWindowVisible(fg) and not user32.IsIconic(fg):
        n = proc_name(fg)
        if n and n not in skip and user32.GetWindowTextLengthW(fg) > 0:
            return fg
    for hwnd in order:
        if not user32.IsWindowVisible(hwnd) or user32.IsIconic(hwnd):
            continue
        if user32.GetWindowTextLengthW(hwnd) <= 0:
            continue
        n = proc_name(hwnd)
        if not n or n in skip:
            continue
        if any(b in n for b in BROWSERS) or 'dsh' in n or 'deepseek' in n:
            return hwnd
    return 0


def print_window(hwnd, w, h):
    """把窗口离屏渲染成 RGB 图像；失败返回 None。"""
    from PIL import Image
    hdc = user32.GetDC(0)
    if not hdc:
        return None
    mem = gdi32.CreateCompatibleDC(hdc)
    bmp = gdi32.CreateCompatibleBitmap(hdc, w, h)
    old = gdi32.SelectObject(mem, bmp)
    ok = False
    try:
        ok = bool(user32.PrintWindow(hwnd, mem, PW_RENDERFULLCONTENT))
        bi = BMIH()
        bi.biSize = ctypes.sizeof(BMIH)
        bi.biWidth = w
        bi.biHeight = -h
        bi.biPlanes = 1
        bi.biBitCount = 32
        bi.biCompression = 0
        buf = ctypes.create_string_buffer(w * h * 4)
        gdi32.GetDIBits(mem, bmp, 0, h, buf, ctypes.byref(bi), 0)
        if not ok:
            return None
        return Image.frombytes('RGB', (w, h), buf.raw, 'raw', 'BGRX', 0, 1)
    except Exception:
        return None
    finally:
        gdi32.SelectObject(mem, old)
        gdi32.DeleteObject(bmp)
        gdi32.DeleteDC(mem)
        user32.ReleaseDC(0, hdc)


def minimize_windows(limit=5):
    out = []

    @ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.HWND, wintypes.LPARAM)
    def cb(hwnd, _l):
        if len(out) >= limit:
            return False
        if not user32.IsIconic(hwnd) or not user32.IsWindowVisible(hwnd):
            return True
        if user32.GetWindowTextLengthW(hwnd) <= 0:
            return True
        if _get_long(hwnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW:
            return True
        out.append(hwnd)
        return True

    user32.EnumWindows(cb, 0)
    return out


def rebuild_behind(base, target_rect, target, order, size):
    """重建 target 原本盖住的区域：桌面打底 + 本页下面的窗口按 z 序画上去。"""
    from PIL import Image
    sx, sy = size
    x0 = max(0, min(target_rect[0], sx))
    y0 = max(0, min(target_rect[1], sy))
    x1 = max(x0, min(target_rect[2], sx))
    y1 = max(y0, min(target_rect[3], sy))
    if x1 - x0 < 2 or y1 - y0 < 2:
        return None
    region = Image.new('RGB', (x1 - x0, y1 - y0), (0, 0, 0))

    desk = user32.FindWindowW('Progman', None) or user32.FindWindowW(None, 'Program Manager')
    if desk:
        dr = rect_of(desk)
        img = print_window(desk, dr[2] - dr[0], dr[3] - dr[1]) if dr else None
        if img is not None and dr and not is_blank(img) and not mostly_white(img):
            region.paste(img, (dr[0] - x0, dr[1] - y0))

    try:
        idx = order.index(target)
    except ValueError:
        idx = len(order)
    below = [h for h in order[idx + 1:] if h != desk]
    for hwnd in reversed(below):                      # 从最底层往上画
        if not user32.IsWindowVisible(hwnd) or user32.IsIconic(hwnd) or is_cloaked(hwnd):
            continue
        if _get_long(hwnd, GWL_EXSTYLE) & WS_EX_TOOLWINDOW:
            continue                                  # 工具窗口（输入法、托盘等）不是画面内容
        r = rect_of(hwnd)
        if not r:
            continue
        if r[2] <= x0 or r[0] >= x1 or r[3] <= y0 or r[1] >= y1:
            continue                                  # 与目标区域不相交
        img = print_window(hwnd, r[2] - r[0], r[3] - r[1])
        if img is None or is_blank(img) or mostly_white(img):
            continue                                  # 渲染不出内容(全黑)就别贴，免得糊住底下真正的画面
        region.paste(img, (r[0] - x0, r[1] - y0))

    return region


def is_blank(img):
    """空白渲染检查：整块只有一种亮度（全黑/全白/单色）就当作没内容。

    WebView2 / 浏览器窗口用 PrintWindow 常常只能拿到纯白图，旧的 mostly_black
    只挡黑图，白图会被当成有效画面贴上去，于是截图整块变白。
    """
    ex = img.convert('L').getextrema()
    return ex[1] - ex[0] <= 2


def mostly_white(img):
    """大部分像素接近纯白 = 空白渲染（WebView2/浏览器很常见），同样不算有效画面。"""
    g = img.convert('L')
    hist = g.histogram()
    total = sum(hist)
    if total <= 0:
        return True
    return sum(hist[246:]) / total > 0.85


HWND_BOTTOM = 1
HWND_TOP = 0
SWP_NOSIZE = 0x0001
SWP_NOMOVE = 0x0002
SWP_NOACTIVATE = 0x0010

# 离屏重建只渲染壁纸（桌面图标/文字会丢），且 WebView2 窗口常返回白图。
# 默认关闭，改用「压到最底层 + 抓真实屏幕」。
REBUILD_OFFSCREEN = False


def main():
    t0 = time.time()
    out = sys.argv[1]
    keep = len(sys.argv) > 2 and sys.argv[2] in ('1', 'true', 'yes')
    restore_min = len(sys.argv) > 3 and sys.argv[3] in ('1', 'true', 'yes')

    from PIL import ImageGrab
    err = ''
    w = h = 0
    hideway = 'none'
    restored = 0
    target = 0
    hide_ok = False

    try:
        base = ImageGrab.grab(all_screens=True).convert('RGB')
        w, h = base.size
        if keep:
            base.save(out, 'PNG')
        else:
            order = z_order()
            target = find_target(order)
            tr = rect_of(target) if target else None
            region = None
            # 离屏重建（PrintWindow）拿不到桌面图标——它只渲染壁纸，WebView2 窗口还会
            # 返回纯白图。所以默认改用「把本页压到最底层，抓真实屏幕」，图标/文字都在。
            if tr and REBUILD_OFFSCREEN:
                region = rebuild_behind(base, tr, target, order, (w, h))
            if region is not None and not is_blank(region) and not mostly_white(region):
                base.paste(region, (max(0, tr[0]), max(0, tr[1])))
                hideway = 'offscreen'
                base.save(out, 'PNG')
            else:
                # 离屏重建不可用（WebView2/Tauri 窗口的 PrintWindow 只能拿到白图）：
                # 先把本页临时藏起来，抓真实桌面，再立刻恢复。
                mws = minimize_windows() if restore_min else []
                for hwnd in mws:
                    try:
                        user32.ShowWindowAsync(hwnd, SW_SHOWNOACTIVATE)
                    except Exception:
                        pass
                if mws:
                    time.sleep(0.35)

                # 离屏重建拿不到桌面图标（只渲染壁纸），WebView2 窗口还会返回白图。
                # 直接用「本页临时隐藏 -> 抓真实屏幕 -> 立刻恢复」：图标、文字都在，
                # 实测 ShowWindowAsync(SW_HIDE) 在本机对这个 Tauri 窗口有效。
                moved = False
                if target:
                    try:
                        user32.ShowWindow(target, SW_HIDE)
                        moved = not user32.IsWindowVisible(target)
                        if moved:
                            time.sleep(0.35)
                    except Exception:
                        moved = False

                if moved:
                    try:
                        shot = ImageGrab.grab(all_screens=True).convert('RGB')
                        shot.save(out, 'PNG')
                        w, h = shot.size
                        hideway = 'hide'
                        hide_ok = True
                    finally:
                        try:
                            user32.ShowWindow(target, SW_SHOW)
                        except Exception:
                            pass
                else:
                    ex0 = 0
                    layered_before = False
                    hidden = False
                    if target:
                        ex0 = _get_long(target, GWL_EXSTYLE)
                        layered_before = bool(ex0 & WS_EX_LAYERED)
                        try:
                            if not layered_before:
                                _set_long(target, GWL_EXSTYLE, ex0 | WS_EX_LAYERED)
                            hidden = bool(user32.SetLayeredWindowAttributes(target, 0, 0, LWA_ALPHA))
                        except Exception:
                            hidden = False
                    if hidden:
                        time.sleep(0.12)
                    try:
                        shot = ImageGrab.grab(all_screens=True).convert('RGB')
                        shot.save(out, 'PNG')
                        w, h = shot.size
                        if hidden:
                            hideway = 'alpha'
                    finally:
                        if hidden and target:
                            try:
                                user32.SetLayeredWindowAttributes(target, 0, 255, LWA_ALPHA)
                                if not layered_before:
                                    _set_long(target, GWL_EXSTYLE, ex0)
                            except Exception:
                                pass
                for hwnd in mws:
                    try:
                        user32.ShowWindowAsync(hwnd, SW_SHOWMINNOACTIVE)
                    except Exception:
                        pass
                restored = len(mws)
    except Exception as e:                            # noqa: BLE001
        err = '抓屏失败（%s）：%s' % (type(e).__name__, e)

    print(json.dumps({
        'ok': err == '',
        'w': w,
        'h': h,
        'hide': hideway != 'none',
        'hideway': hideway,
        'restored': restored,
        'target': target,
        'hide_ok': hide_ok,
        'ms': int((time.time() - t0) * 1000),
        'error': err,
    }, ensure_ascii=False))


if __name__ == '__main__':
    main()
