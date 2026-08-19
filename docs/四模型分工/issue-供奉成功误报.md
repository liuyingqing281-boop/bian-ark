# Issue：供奉成功后页面提示"操作失败"，但实际已入库

> **状态：已按方案 A 修复**（feat/visual-polish 分支，fix commit 随视觉线一并评审合并）。
> 本文保留为 Issue 存档文本；合并后可引用修复 commit 关闭。

---

## 标题

fix: 供奉成功后误报"操作失败，请重试"（fetch 跟随 307 保留 POST 打到页面路由 404）

## 正文

### 现象

用户在纪念馆页选择祭品、提交供奉后，页面显示红色错误提示「操作失败，请重试」。
**但供奉实际已成功入库**，刷新页面后留言/祭品正常上墙。即：功能成功、反馈失败，属于误导性报错。

### 复现

1. 打开任意公开纪念馆页，如 `/zh/memorial/{id}`
2. 任选一祭品，填写姓名/留言（可不填），点击「供奉」
3. 观察到错误提示「操作失败，请重试」
4. 刷新页面 → 供奉记录实际已出现在思念墙

2026-08-19 在 master（桌面 + 移动双端，本地 dev 与 Playwright 均无头复现）确认。

### 根因

- `src/app/api/tribute/route.ts` 成功路径返回 `NextResponse.redirect(...)`（**307**）到 `/{lang}/memorial/{id}`
- `src/components/OfferPanel.tsx` 用 `fetch("/api/tribute", { method: "POST", body: fd })` 提交
- 浏览器 fetch 默认 `redirect: "follow"`，且 **307 会保留原请求方法与 body**，于是浏览器以 POST 跟随到 `/zh/memorial/{id}`
- 页面路由不接受 POST，Next.js 将其当作 Server Action 调用处理 → 找不到 action → 404（dev 日志可见 `Failed to find Server Action`）
- `res.ok === false` → `OfferPanel` 进入错误分支，显示「操作失败」

服务端日志伴随：
```
Error: Failed to find Server Action. This request might be from an older or newer deployment.
```

### 影响

- 所有供奉成功用户都会看到失败提示，直接伤害核心闭环（祭奠）的信任感
- 可能导致用户重复提交，产生重复供奉记录
- E2E `tribute.spec.ts` 未断言成功提示文案，所以该 bug 未被测试拦住

### 修复建议（任选其一，逻辑层定夺）

**方案 A（推荐）**：API 成功时改返 JSON
```ts
// src/app/api/tribute/route.ts
return NextResponse.json({ ok: true });
```
`OfferPanel` 已有 `res.ok` 判断，前端无需改动；失败路径（权限/审核拦截等）同步改为对应 JSON 错误码。

**方案 B**：改用 **303 See Other**
```ts
return NextResponse.redirect(url, 303);
```
303 会把跟随请求转为 GET，页面路由正常响应 200，`res.ok` 为 true。一行改动，但语义上仍是"拿 HTML 当 API 应答"，不如 A 干净。

### 附：测试补强建议

- smoke / E2E 增加断言：提交后 `.ui-status-success` 可见且不出现 `.ui-status-error`
- 现 E2E 只断言"供奉已入库 + 上墙"，无法覆盖本 bug

### 出处

视觉线 B5 任务走查发现，详见 `docs/四模型分工/KimiK3-评审说明.md` 第四节第 1 条。
