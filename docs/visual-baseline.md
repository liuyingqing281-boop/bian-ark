# V01 视觉基线

## 语义 Token

| 类别 | Token | 用途 |
| --- | --- | --- |
| 背景 | `--bg-page`、`--bg-panel`、`--bg-panel-subtle`、`--bg-input` | 页面、面板、次级区域、表单控件 |
| 文字 | `--text-primary`、`--text-secondary`、`--text-muted`、`--text-faint` | 正文、辅助文字、说明、弱提示 |
| 品牌 | `--accent-memorial`、`--accent-memorial-strong`、`--accent-memorial-soft` | 纪念主题强调、主按钮、选中态 |
| 状态 | `--status-success`、`--status-error`、`--status-warning` | 成功、错误、警告 |
| 边框与阴影 | `--border-subtle`、`--border-strong`、`--shadow-panel`、`--shadow-focus` | 容器层级和键盘焦点 |
| 尺寸 | `--radius-control`、`--radius-panel` | 控件最大 8 px，面板最大 12 px |
| 动效 | `--motion-fast`、`--motion-base`、`--motion-scene` | 控件、页面、场景动画基准 |

Tailwind 的 `stone`、`amber` 色名保留用于渐进迁移；新公共样式优先使用 `bg-page`、`text-copy`、`text-memorial` 和 `.ui-*` utility。

## 排版

- 页面标题：32-48 px，`font-semibold`，`line-height: 1.25`，不按视口连续缩放。
- 区块标题：13 px，600 字重，0.08 em 字间距，仅用于短标题。
- 正文：16 px，1.6 行高；辅助文字 14 px；状态文字 13 px。
- 日期：14 px，正常字间距；墓志铭最大 `max-w-prose`，斜体、1.6 行高。
- 禁止负字间距；长名称使用 `break-words`，紧凑控件使用 `min-width: 0`。

## 盘点结论

- 旧代码主要重复 `bg-stone-900/60 + border-stone-800 + rounded-xl`，现归一为 `.ui-panel`。
- 输入框重复 stone 背景、边框和 amber focus，现归一为 `.ui-control`。
- 主操作按钮重复 amber 背景和 disabled 状态，现归一为 `.ui-button.ui-button-primary`。
- 原圆角同时存在 `rounded`、`rounded-lg`、`rounded-xl`、`rounded-2xl`；基准约束为控件 8 px、面板 12 px，圆形头像和图标按钮例外。
- 原场景动画时长散落在 JSX；现以 `--motion-scene` 为基准，并统一支持 `prefers-reduced-motion`。

## 基准页面

截图输出目录：`docs/visual-baseline/`。

- `/zh`、`/en`
- `/zh/garden`、`/en/garden`
- `/zh/login`、`/en/login`
- `/zh/memorial/<baseline-id>`、`/en/memorial/<baseline-id>`

桌面基准为 1440 x 1000，移动基准为 360 x 800。截图需确认导航、长英文、表单、卡片、背景动画和固定主题按钮没有重叠或横向溢出。
