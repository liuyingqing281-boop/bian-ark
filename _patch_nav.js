const fs = require("fs");
const p = "E:/彼岸/src/components/NavBar.tsx";
let s = fs.readFileSync(p, "utf8");
const old = "  const isActive = (href: string) => {\n    if (href === base) return pathname === base || pathname === `${base}/\u0060;\n    return pathname === href || pathname.startsWith(`${href}/`);\n  };";
const neu = "  const isActive = (href: string) => {\n    if (href === base) {\n      return (\n        pathname === base ||\n        pathname === `${base}/\u0060 ||\n        (pathname.startsWith(`${base}/`) &&\n          !pathname.startsWith(`${base}/garden`) &&\n          !pathname.startsWith(`${base}/membership`) &&\n          !pathname.startsWith(`${base}/admin`) &&\n          !pathname.startsWith(`${base}/me`) &&\n          !pathname.startsWith(`${base}/login`))\n      );\n    }\n    return pathname === href || pathname.startsWith(`${href}/`);\n  };";
if (s.includes(old)) {
  s = s.replace(old, neu);
  fs.writeFileSync(p, s);
  console.log("patched");
} else {
  console.log("old block not found");
}
