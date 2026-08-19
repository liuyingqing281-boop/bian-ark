import { expect, test } from "@playwright/test";
import { apiLogin, emailOf } from "./helpers";

test("支付入口在指定通道未配置时返回 503", async ({ request }) => {
  await apiLogin(request, emailOf("payment-config"));
  const response = await request.post("/api/payment", {
    data: { provider: "provider-not-configured", kind: "premium_monthly" },
  });
  expect(response.status()).toBe(503);
  await expect(response.json()).resolves.toEqual({ error: "provider_not_configured" });
});
