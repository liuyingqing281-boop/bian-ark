<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 线上祭奠产品市场调研 — 共享上下文

任何调研步骤开始前必须先读本节并严格遵守；本节内容对所有步骤自动继承，用户不再重复说明。

## 产品方向
线上祭奠

## 调研对象
所有有祭奠需求的人，想要纪念怀念的人

## 文档链路
网络上的数据 → MRD → BRD → PRD，四步各产出一份文档：

1. `docs/01-数据报告.md` — 网络真实评论数据的采集与整理
2. `docs/02-MRD.md` — 市场需求文档
3. `docs/03-BRD.md` — 商业需求文档
4. `docs/04-PRD.md` — 产品需求文档

- 后一份文档动笔前必须先读取前一份的产物，在已有结论之上推进；不重复分析已有结论，不重复询问用户已确认的信息
- 链路内只认 01–04 编号的产物；`docs/` 中既有开发文档（如 PRD-彼岸3.0.md）不属于本调研链路
- 每完成一步，更新下方「当前进度」

## 存放规范
- 调研文档一律写成 Markdown 放 `docs/`；数据文件（CSV）放 `data/`，文件名以编号开头与文档对应（如 `data/01-评论数据.csv`）
- `data/` 中既有的 bian.db 等为应用运行数据，调研只新增 CSV，不改动既有文件
- 根目录留给后续开发代码，不放调研文档和数据

## 数据规范
- 所有结论、数字、引用必须来自真实采集到的评论数据，禁止编造；来源不可核实的信息须明确标注或不采用
- 任何文档中不展示可识别个人身份的信息：用户名一律打码（如「李**」）或以「用户A/B」代称，或不展示

## 当前进度
- [x] 第 1 步：数据采集 → `docs/01-数据报告.md` + `data/01-评论数据.csv`（2026-08-22 完成：11 个信源、36 条引述样本，需求侧结论与行业数据就绪）
- [x] 第 2 步：MRD → `docs/02-MRD.md`（2026-08-22 完成：11 条市场需求 MR-01~11、5 类用户细分 P0–P4、竞争格局与定位空位、移交 BRD 的 6 项决策清单）
- [x] 第 3 步：BRD → `docs/03-BRD.md`（2026-08-22 完成：免费+一口价+88 元开关式年卡模式、C 端先行路径、12 条业务需求 BR-01~12、北极星指标 WAR、2027 清明倒排里程碑；品牌建议保留"彼岸"+全称区隔，待用户拍板）
- [x] 第 4 步：PRD → `docs/04-PRD.md`（2026-08-22 完成：12 组功能需求 FR-01~12 + 6 项 NFR + 版本规划（V1.0 MVP 至 V2.0）+ 全链路需求追踪矩阵。**四步调研链路全部完成**，可循矩阵逐条溯源至真实采集数据）
