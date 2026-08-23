const baseUrl = process.env.BASE_URL || "http://localhost:3003";
const checks = ["/api/health", "/zh", "/zh/garden", "/zh/membership"];
let failed = 0;
for (const pathname of checks) {
  try {
    const response = await fetch(new URL(pathname, baseUrl), { signal: AbortSignal.timeout(15000), redirect: "follow" });
    const ok = response.ok;
    console.log(`${ok ? "PASS" : "FAIL"} ${pathname} ${response.status}`);
    if (!ok) failed++;
  } catch (error) { console.error(`FAIL ${pathname} ${error instanceof Error ? error.message : error}`); failed++; }
}
if (failed) process.exitCode = 1;
