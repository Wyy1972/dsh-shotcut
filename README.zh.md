# dsh-shotcut

聊天输入框左边的**剪刀截图**：抓的是**整块桌面**——抓屏那一瞬间本窗口临时变全透明，所以被窗口挡住的内容也会被拍到——然后框选、标注，图片直接进输入框。

仅支持 Windows（抓屏和"让开窗口"都用 `user32`）。

## 它做什么

- **剪刀按钮**在输入框左侧控件里。点它（或按 `Alt+A`）：本页在抓屏期间消失，整块桌面被拍下，随后本页回来并显示冻结画面。
- **画面不跳。** 不做最小化、没有任何动画：窗口只是被设为全透明（`WS_EX_LAYERED` + `alpha=0`）来完成抓屏，前后层级、焦点、任务栏按钮、窗口状态全部不动；同一个进程负责把它恢复回 `alpha=255`。
- **其它窗口原地不动。** 只有 DSH 这个窗口让开——你想截的东西还在屏幕上，会被拍进画面。
- **被最小化的窗口也会被拍到。** 最小化的窗口不在屏幕上，任何抓屏都看不到它。插件会在拍摄前临时还原最多 5 个被最小化的窗口，拍完立刻放回最小化——桌面状态和之前一样。
- **小眼睛开关**（剪刀旁）决定让不让开：
  - 斜线眼（绿色）—— 让开本窗口，能截到它后面的内容（**默认**）
  - 普通眼 —— 不让开，连本页一起截
  - 选择记在 `localStorage`；按住 `Shift` 点剪刀可临时反选一次
- **冻结、框选、标注、发送。** 冻结的桌面铺满窗口（左右无黑边）。拖动框选、可移动/缩放选区，然后用 矩形 / 椭圆 / 箭头 / 画笔 / 文字 / 马赛克 标注（马赛克有一键"整块打码"）。`✓` 或 `Enter` 把图片放进输入框（同时进剪贴板）；`✕` 或 `Esc` 取消。`Ctrl+Z` / `Ctrl+Shift+Z` 撤销/重做，`Ctrl+A` 全选，右键取消，双击完成。

## 依赖

- **Windows** 10/11。
- **DSH**（支持 web profile 插件 / 客户端 bundle 的版本）。
- **Python 3 + Pillow**，用来真正执行抓屏。插件按以下顺序探测：
  1. 配置里的 `pythonPath`；
  2. 环境变量 `DSH_SHOTCUT_PYTHON`；
  3. `%DSH_HOME%\dsh-runtimes\*\dependencies\python\python.exe`（DSH 自带运行时）；
  4. `PATH` 上的 `python` / `python3` / `py`。

  都不可用时，抓屏会失败并提示你 `pip install pillow` 或指定 `pythonPath`。这是唯一的外部依赖，包本身**没有任何 npm 依赖**。

## 安装

```sh
dsh plugin --profile web add dsh-shotcut
```

然后**重启 `dsh web`**（profile 的 bundle 清单只在启动时读一次），再刷新页面。

从本地目录安装：

```sh
dsh plugin --profile web add link:/path/to/dsh-shotcut
```

## 配置（可选）

在 profile 的 `cordis.patch.yml` 里覆盖这一行——补丁是整对象替换：

```yaml
- id: shotcut
  name: 'dsh-shotcut'
  config:
    workDir: 'D:\tools\dshot'                 # capture.py、shot.png、report.txt 放哪
    pythonPath: 'C:\Python312\python.exe'     # 指定后跳过探测
```

`workDir` 默认是 `%USERPROFILE%\.dsh-shotcut`。

## 路由

host 半身在 DSH web 服务上注册：

| 路由 | 说明 |
|---|---|
| `GET /dshot/capture?keepSelf=0\|1` | 跑一次抓屏；`keepSelf=1` 不动窗口。返回 `{ok,w,h,url,bytes,ms,hide,hideway,error}` |
| `GET /dshot/img?t=<seq>` | 最近一次抓屏的 PNG |
| `GET /dshot/log?m=<json>` | 往报告文件追加一行 |
| `GET /dshot/ping` | 状态（`py`、`seq`、`w`、`h`、`hasBytes`、`work`） |

## 诊断

`<workDir>\report.txt` 记录最后状态与日志：用了哪个 Python、抓屏尺寸、窗口怎么让开的（`hideway`）、以及浏览器报回的每一步。抓屏失败时先看它。

## 停用 / 卸载

**不重启即时停用**：在 profile 的 `cordis.patch.yml` 追加下面两行并刷新页面（host 行与前端 bundle 会同时失效）：

```yaml
- id: shotcut
  disabled: true
```

**彻底卸载**：把 profile `package.json` 的 `dsh.profile.bundles` 里的 `"dsh-shotcut"` 删掉再重启。注意不要只删安装目录而清单里还留着这一行——那会让 profile 起不来。

## 隐私说明

这个插件会读屏。按下按钮就会抓取整块桌面，包括 DSH 窗口以外的窗口及其中的可见内容。所有数据不出本机：PNG 从本地抓屏进程经回环送到本地 DSH web 服务，下一次抓屏时内存里的副本即被丢弃。每次抓屏会起一个 `python` 进程，插件自身不发起任何网络请求。

## 许可证

MIT
