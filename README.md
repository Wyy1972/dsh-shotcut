# dsh-shotcut

A scissors screenshot button in the DSH chat composer. It captures the **whole desktop** —
while this window is made temporarily transparent, so content hidden *behind* the window is
included — then lets you crop and annotate, and drops the result straight into the composer.

Windows only (the capture and the "move this window out of the way" step use `user32`).

## What it does

- **Scissors button** next to the composer's left controls. Click it (or press `Alt+A`) and the
  page disappears for the duration of the capture, the whole desktop is grabbed, and the page
  comes back showing the frozen frame.
- **No visible jump.** The window is not minimized and no animation plays: it is made fully
  transparent (`WS_EX_LAYERED` + `alpha=0`) for the capture, so z-order, focus, taskbar button
  and window state are untouched; `alpha` is restored by the same process that changed it.
- **Other windows stay put.** Only the DSH window steps aside — whatever you want to capture is
  still on screen and lands in the frame.
- **Windows that were minimized are included.** A minimized window is not on screen, so no screen
  capture can see it. The plugin temporarily restores up to 5 minimized windows before the grab
  and minimizes them again right after, so your desktop ends up exactly as it was.
- **Eye toggle** (next to the scissors) decides whether the window steps aside:
  - eye-off (green) — the window steps aside, so content behind it is captured (**default**)
  - eye — nothing is hidden; the page itself is in the shot
  - the choice is remembered in `localStorage`; hold `Shift` while clicking to invert it once
- **Freeze, crop, annotate, send.** The frozen desktop fills the window (edge to edge, no black
  borders). Drag to select, move/resize the selection, then annotate with rect / ellipse / arrow /
  pen / text / mosaic (mosaic has a one-click "mask the whole selection" button). `✓` or `Enter`
  puts the image into the composer (and the clipboard); `✕` or `Esc` cancels. `Ctrl+Z` /
  `Ctrl+Shift+Z` undo/redo, `Ctrl+A` selects everything, right-click cancels, double-click finishes.

## Requirements

- **Windows** (10/11).
- **DSH** with web-profile plugin support (client bundles).
- **Python 3 with Pillow** for the actual screen grab. The plugin probes, in order:
  1. `pythonPath` from its config,
  2. the `DSH_SHOTCUT_PYTHON` environment variable,
  3. a Python bundled under `%DSH_HOME%\dsh-runtimes\*\dependencies\python\python.exe`,
  4. `python` / `python3` / `py` on `PATH`.

  If none of them works the capture fails with a message telling you to run `pip install pillow`
  or to set `pythonPath`. This is the only external dependency — the package has no npm
  dependencies at all.

## Install

```sh
dsh plugin --profile web add dsh-shotcut
```

Then **restart `dsh web`** (a profile's bundle list is read only at startup) and refresh the page.

From a local checkout instead:

```sh
dsh plugin --profile web add link:/path/to/dsh-shotcut
```

## Configuration (optional)

Override the row in your profile's `cordis.patch.yml` — a patch replaces the whole config object:

```yaml
- id: shotcut
  name: 'dsh-shotcut'
  config:
    workDir: 'D:\tools\dshot'                 # where capture.py, shot.png and report.txt live
    pythonPath: 'C:\Python312\python.exe'     # skip the probe
```

`workDir` defaults to `%USERPROFILE%\.dsh-shotcut`.

## Routes

The host half registers these on the DSH web server:

| Route | Purpose |
|---|---|
| `GET /dshot/capture?keepSelf=0\|1` | run one capture; `keepSelf=1` leaves the window alone. Returns `{ok,w,h,url,bytes,ms,hide,hideway,error}` |
| `GET /dshot/img?t=<seq>` | the PNG of the most recent capture |
| `GET /dshot/log?m=<json>` | append one line to the report file |
| `GET /dshot/ping` | status (`py`, `seq`, `w`, `h`, `hasBytes`, `work`) |

## Diagnostics

`<workDir>\report.txt` holds the last state plus a log: which Python was used, the capture size,
how the window was moved aside (`hideway`), and every step the browser reported. It is the first
thing to look at when a capture fails.

## Disable / uninstall

Disable without a restart — append this to the profile's `cordis.patch.yml` and refresh the page
(it removes both the host row and the browser bundle):

```yaml
- id: shotcut
  disabled: true
```

Full removal: drop `"dsh-shotcut"` from `dsh.profile.bundles` in the profile's `package.json` and
restart. Do not delete only the installed package directory while the manifest still lists it —
that stops the profile from booting.

## Privacy note

This plugin reads the screen. Pressing the button captures the entire desktop, including windows
other than the DSH window and anything visible inside them. Nothing leaves the machine: the PNG
goes from the local capture process to the local DSH web server over loopback, and the in-memory
copy is dropped as soon as the next capture happens. The plugin spawns one `python` process per
capture and makes no network requests of its own.

## License

MIT
