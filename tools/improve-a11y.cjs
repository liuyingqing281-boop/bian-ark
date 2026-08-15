var fs = require('fs');
var f = fs.readFileSync('src/app/[lang]/layout.tsx', 'utf-8');

// 1. Add aria-label to main nav
f = f.replace(
  '<nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">',
  '<nav className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between" aria-label="Main navigation">'
);

// 2. Add aria-label to footer nav
f = f.replace(
  '<footer className="border-t border-stone-800 py-8 text-center text-stone-600 text-xs space-y-2">',
  '<footer className="border-t border-stone-800 py-8 text-center text-stone-600 text-xs space-y-2" role="contentinfo">'
);

// 3. Add aria-label to theme background region
f = f.replace(
  '<ThemeBackground labels={dict.themes} />',
  '<ThemeBackground labels={dict.themes} />'
);

// 4. Add lang attribute to html
f = f.replace(
  '<html lang={lang === "zh" ? "zh-CN" : "en"}>',
  '<html lang={lang === "zh" ? "zh-CN" : "en"} dir="ltr">'
);

fs.writeFileSync('src/app/[lang]/layout.tsx', f, 'utf-8');
console.log("a11y improvements added");
console.log("nav aria:", f.includes("aria-label=\"Main navigation\""));
console.log("footer role:", f.includes("role=\"contentinfo\""));
console.log("dir:", f.includes("dir=\"ltr\""));
