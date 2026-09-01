# 正式发布清单

## 仓库内验证

- [x] migration 可从空库执行并对旧库幂等升级。
- [x] 数据库完整性、外键、备份和隔离恢复校验通过。
- [x] production build、P1/P2/P4/auth smoke 和 release smoke 通过。
- [x] Playwright 桌面/移动公开旅程通过。
- [x] production CSP、安全响应头、同源写请求校验和 request id 生效。
- [x] 用户数据导出与删除申请 API 可用。
- [x] 正式星海验证（2026-09-01）：/zh/garden 与 /hall/[hallId] canonical 的桌面/移动 Playwright（110 通过/0 失败）、视觉基线 docs/shots/garden-starsea-*.png、formal 冒烟 30 项全过；家族星座连线 M4 前恒 null，不视为已上线能力。

## 外部上线条件

- [ ] 微信开放平台网站应用审核通过，并配置回调域名。
- [ ] Stripe 商户、价格、Webhook secret 与退款流程完成沙箱和生产验证。
- [ ] 内容审核供应商已签约，故障告警与人工审核值班人已确定。
- [ ] 数字人供应商合同、API key、回调签名、素材删除 SLA 已验证。
- [ ] OSS Adapter 已实现，私有对象签名 URL、CDN 和跨实例验证通过。
- [ ] 深度合成算法备案、AI 水印、肖像/声音授权文本经法务确认。
- [ ] 域名、HTTPS、DNS、监控告警、管理员账号和密钥轮换已配置。
- [ ] 灰度发布、生产回滚和数据恢复演练已保留日志与负责人签字。
