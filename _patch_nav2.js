const fs = require("fs");
let s = fs.readFileSync("E:/彼岸/src/components/NavBar.tsx", "utf8");
const old = "  const isActive = (href: string) => {\n    if (href === base) {\n      return (\n        pathname === base ||\n        pathname === `${base}/\u0060 ||\n        (pathname.startsWith(`${base}/`) &&\n          !pathname.startsWith(`${base}/garden`) &&\n          !pathname.startsWith(`${base}/membership`) &&\n          !pathname.startsWith(`${base}/admin`) &&\n          !pathname.startsWith(`${base}/me`) &&\n          !pathname.startsWith(`${base}/login`))\n      );\n    }\n    return pathname === href || pathname.startsWith(`${href}/`);\n  };";
const neu = "  const otherRoutes = [\"garden\", \"membership\", \"admin\", \"me\", \"login\"];\n  const isActive = (href: string) => {\n    if (href === base) {\n      const firstSegment = pathname.slice(base.length + 1).split(\"/\")[0] || \"\";\n      return pathname === base || pathname === `${base}/\u0060 || !otherRoutes.includes(firstSegment);\n    }\n    return pathname === href || pathname.startsWith(`${href}/`);\n  };";
if (s.includes(old)) {
  s = s.replace(old, neu);
  fs.writeFileSync("E:/彼岸/src/components/NavBar.tsx", s);
  console.log("patched");
} else {
  console.log("old block not found");
  const i = s.indexOf("const isActive");
  console.log(s.slice(i, i + 500));
}
