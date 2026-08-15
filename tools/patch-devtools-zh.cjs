/**
 * 将 Next.js 16 开发者工具（DevTools 浮层）界面文案补丁为中文。
 * 目标文件: node_modules/next/dist/compiled/next-devtools/index.js
 * 幂等：已补丁过时自动跳过；npm install 重装依赖后可通过 postinstall 自动重放。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TARGET = path.join(ROOT, 'node_modules', 'next', 'dist', 'compiled', 'next-devtools', 'index.js');
const BACKUP = TARGET + '.en-backup';

if (!fs.existsSync(TARGET)) {
  console.log('[patch-devtools-zh] 未找到 next-devtools 包，跳过（可能尚未安装依赖）。');
  process.exit(0);
}

// [查找, 替换, 期望出现次数(可选，null 表示不校验)]
const R = [
  // ===== 主菜单 =====
  ['label:"Route"', 'label:"路由"', 2],
  ['"Static"', '"静态"', 3],
  ['"Dynamic"', '"动态"', 3],
  ['} Route`', '} 路由`', 1], // 路由信息弹窗标题 “静态/动态 路由”
  ['label:"Bundler"', 'label:"打包器"', 2],
  ['"Route Info"', '"路由信息"', 2],
  ['"Preferences"', '"偏好设置"', 2],
  ['"Loading..."', '"加载中..."', 1],
  ['`Current route is ${y.staticIndicator}.`', '`当前路由：${y.staticIndicator}`', 1],
  ['"Turbopack is enabled."', '"Turbopack 已启用。"', 1],
  ['"Learn about Turbopack and how to enable it in your application."', '"了解 Turbopack 以及如何在应用中启用它。"', 1],
  ['"Cache Components is enabled."', '"缓存组件已启用。"', 1],
  ['label:"Cache Components"', 'label:"缓存组件"', 1],
  ['value:"Enabled"', 'value:"已启用"', 1],
  ['"Test instant navigation behavior."', '"测试即时导航行为。"', 1],
  ['label:"Navigation Inspector"', 'label:"导航检查器"', 1],
  ['"Inspect recent App Router requests."', '"检查最近的 App Router 请求。"', 1],
  ['"Request Insights"', '"请求洞察"', 2],
  ['"Caching is currently disabled (bypassed). Click to learn more."', '"缓存当前已禁用（被绕过）。点击查看详情。"', 1],
  ['value:"Disabled"', 'value:"已禁用"', 1],
  ['"This load filled one or more caches while streaming, so it is not representative of production. Click to learn more."', '"本次加载在流式传输期间填充了一个或多个缓存，因此不代表生产环境的表现。点击查看详情。"', 1],
  ['value:"Cold"', 'value:"冷缓存"', 1],
  ['label:"Cache"', 'label:"缓存"', 3],

  // ===== 偏好设置面板 =====
  ['children:"Theme"', 'children:"主题"', 1],
  ['"Select your theme preference."', '"选择主题偏好。"', 1],
  ['children:"System"', 'children:"跟随系统"', 1],
  ['children:"Light"', 'children:"浅色"', 1],
  ['children:"Dark"', 'children:"深色"', 1],
  ['children:"Position"', 'children:"位置"', 1],
  ['"Adjust the placement of your dev tools."', '"调整开发工具指示器的位置。"', 1],
  ['children:"Bottom Left"', 'children:"左下角"', 1],
  ['children:"Bottom Right"', 'children:"右下角"', 1],
  ['children:"Top Left"', 'children:"左上角"', 1],
  ['children:"Top Right"', 'children:"右上角"', 1],
  ['children:"Hide Dev Tools shortcut"', 'children:"隐藏开发工具的快捷键"', 1],
  ['"Set a custom keyboard shortcut to toggle visibility."', '"设置自定义快捷键来切换显示。"', 1],
  ['"Record Shortcut"', '"录制快捷键"', 1],
  ['"Shortcut set"', '"快捷键已设置"', 1],
  ['"Recording"', '"录制中"', 1],
  ['"Clear shortcut"', '"清除快捷键"', 1],
  ['children:"Hide Dev Tools for this session"', 'children:"在本次会话中隐藏开发工具"', 1],
  ['"Hide Dev Tools until you restart your dev server, or 1 day."', '"隐藏开发工具，直到重启开发服务器或 1 天后恢复。"', 1],
  ['children:"Hide"', 'children:"隐藏"', 1],
  ['children:"Disable Dev Tools for this project"', 'children:"为此项目禁用开发工具"', 1],
  ['"To disable this UI completely, set"', '"要完全禁用此界面，请设置 "', 1],
  ['" in your "', '" 于你的 "', 1],
  ['" file."', '" 文件中。"', 1],
  ['children:"Restart Dev Server"', 'children:"重启开发服务器"', 1],
  ['"Restarts the development server without needing to leave the browser."', '"无需离开浏览器即可重启开发服务器。"', 2],
  ['children:"Restart"', 'children:"重启"', 1],

  // ===== 路由信息 / 请求洞察 =====
  ['children:"Method"', 'children:"方法"', 1],
  ['children:"Duration"', 'children:"耗时"', 2],
  ['children:"Status"', 'children:"状态"', 1],
  ['children:"Cache"', 'children:"缓存"', 1],
  ['children:"Reason"', 'children:"原因"', 1],
  ['children:"Internal"', 'children:"内部"', 1],
  ['Instant Insights', '即时洞察', 3],
  ['"RSC request"', '"RSC 请求"', 1],
  ['"HTML request"', '"HTML 请求"', 1],
  [' fetch${1===m.fetches.length?"":"es"}', ' 次 fetch', 1],
  [' fetch${1===t.fetches.length?"":"es"}', ' 次 fetch', 1],
  ['"No fetches"', '"未发起请求"', 2],
  ['"No cache data"', '"无缓存数据"', 1],
  ['"Cache status unknown"', '"缓存状态未知"', 1],
  ['Cache ${u.hit} hit, ${u.miss} miss, ${u.skip} skip', '缓存命中 ${u.hit}、未命中 ${u.miss}、跳过 ${u.skip}', 1],
  [', ${u.unknown} unknown', '、未知 ${u.unknown}', null],
  ['"No slow server work was captured for this request."', '"未捕获到此请求的慢速服务器操作。"', 1],
  ['Slowest recorded operation: ', '最慢的操作：', 2],

  // ===== 即时洞察图例 =====
  ['label:"Stream"', 'label:"流式"', 1],
  ['label:"Block"', 'label:"阻塞"', 1],
  ['label:"Client"', 'label:"客户端"', 1],
  ['label:"Defer"', 'label:"延迟"', 1],
  ['label:"Measure"', 'label:"测量"', 1],
  ['label:"Ignore"', 'label:"忽略"', 1],
  ['label:"Render"', 'label:"渲染"', 1],
  ['label:"Upgrade"', 'label:"升级"', 1],
  ['label:"Disable"', 'label:"禁用"', 1],

  // ===== 即时洞察操作建议 =====
  ['title:"Wrap in or move into Suspense"', 'title:"包裹或移入 Suspense"', null],
  ['title:"Allow blocking route"', 'title:"允许阻塞式路由"', null],
  ['title:"Cache the component or data"', 'title:"缓存组件或数据"', null],
  ['title:"Render the dropped segment"', 'title:"渲染被丢弃的片段"', null],
  ['title:"Skip validation on the segment"', 'title:"跳过该片段的验证"', null],
  ['title:"Opt into Partial Prefetching"', 'title:"启用部分预取（Partial Prefetching）"', null],
  ['title:"Use the default prefetch"', 'title:"使用默认预取"', null],
  ['title:"Disable validation on this route"', 'title:"禁用此路由的验证"', null],
  ['title:"Use static metadata"', 'title:"使用静态 metadata"', null],
  ['title:"Mark the route as dynamic"', 'title:"将路由标记为动态"', null],
  ['title:"Cache the metadata"', 'title:"缓存 metadata"', null],
  ['title:"Use static viewport"', 'title:"使用静态 viewport"', null],
  ['title:"Cache the viewport data"', 'title:"缓存 viewport 数据"', null],
  ['title:"Generate on every request"', 'title:"每次请求时生成"', null],
  ['title:"Cache the timestamp"', 'title:"缓存时间戳"', null],
  ['title:"Render on the client"', 'title:"在客户端渲染"', null],
  ['title:"For telemetry, use a timing API"', 'title:"如需遥测，请使用计时 API"', null],
  ['title:"Cache the generated value"', 'title:"缓存生成的值"', null],
  ['title:"Move into effect or event handler"', 'title:"移入 effect 或事件处理器"', null],
  ['title:"Cache the random value"', 'title:"缓存随机值"', null],

  // ===== 问题 / 错误浮层 =====
  ['?"Issues \\xb7 Insights":C?"Insights":"Issues"', '?"问题 \\xb7 洞察":C?"洞察":"问题"', 1],
  ['children:["Issues",', 'children:["问题",', 1],
  ['children:["Insights",', 'children:["洞察",', 1],
  ['"No issues"', '"没有问题"', 1],
  ['${1===w?"issue":"issues"}', '个问题', 1],
  ['${1===_?"insight":"insights"}', '条洞察', 1],
  ['||"Error"', '||"错误"', 2],
  ['?"Hide":"Show"', '?"隐藏":"显示"', 1],
  [' ignore-listed frame(s)`', ' 个被忽略的堆栈帧`', 1],
  ['children:"Learn more"', 'children:"了解更多"', 2],

  // ===== 无障碍标签（aria-label / title） =====
  ['"Open Next.js Dev Tools"', '"打开 Next.js 开发工具"', 2],
  ['?"Close":"Open"', '?"关闭":"打开"', 1],
  ['} Next.js Dev Tools`', '} Next.js 开发工具`', 1],
  ['"Next.js Dev Tools Items"', '"Next.js 开发工具菜单项"', 1],
  ['"Cache disabled"', '"缓存已禁用"', 2],
  ['"Cold cache"', '"冷缓存"', null],
  ['"Collapse issues badge"', '"收起问题徽标"', 1],
  ['`Collapse ${f} badge`', '`收起 ${f} 徽标`', 1],
];

let src = fs.readFileSync(TARGET, 'utf8');
let changed = 0, skipped = 0;
const mismatches = [];

for (const [from, to, expected] of R) {
  const count = src.split(from).length - 1;
  if (count === 0) {
    skipped++; // 已补丁过或该版本无此文案
    continue;
  }
  if (expected !== null && count !== expected) {
    mismatches.push({ from, expected, actual: count });
    continue;
  }
  src = src.split(from).join(to);
  changed++;
}

if (mismatches.length) {
  console.error('[patch-devtools-zh] 以下文案出现次数与预期不符，未写入任何修改：');
  for (const m of mismatches) console.error(`  期望 ${m.expected} 次，实际 ${m.actual} 次: ${m.from}`);
  process.exit(1);
}

if (changed === 0) {
  console.log('[patch-devtools-zh] 界面已是中文（或无可补丁项），跳过。');
  process.exit(0);
}

if (!fs.existsSync(BACKUP)) fs.writeFileSync(BACKUP, fs.readFileSync(TARGET));
fs.writeFileSync(TARGET, src);
console.log(`[patch-devtools-zh] 完成：替换 ${changed} 组文案，跳过 ${skipped} 组（已中文或无此项）。`);
console.log(`[patch-devtools-zh] 英文原件备份：${BACKUP}`);
