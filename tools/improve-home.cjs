var fs = require('fs');
var f = fs.readFileSync('src/app/[lang]/page.tsx', 'utf-8');

// Improve hero section with decorative candle divider and better hierarchy
var oldHero = '<div className="text-center mb-16">\n        <h1 className="text-4xl md:text-5xl tracking-widest text-amber-300 mb-4">{dict.home.title}</h1>\n        <p className="text-stone-500 text-sm tracking-wide">{dict.home.subtitle}</p>\n      </div>';

var newHero = '<div className="text-center mb-16">\n        {/* 装饰分隔 */}\n        <div className="flex items-center justify-center gap-3 mb-6 opacity-60">\n          <span className="h-px w-16 bg-gradient-to-r from-transparent to-amber-800/60" />\n          <span className="text-2xl">\u{1F56F}\uFE0F</span>\n          <span className="h-px w-16 bg-gradient-to-l from-transparent to-amber-800/60" />\n        </div>\n        <h1 className="text-4xl md:text-5xl tracking-widest text-amber-300 mb-4 drop-shadow-[0_0_20px_rgba(217,119,6,0.15)]">{dict.home.title}</h1>\n        <p className="text-stone-500 text-sm tracking-[0.15em] max-w-xl mx-auto leading-relaxed">{dict.home.subtitle}</p>\n      </div>';

if (f.includes(oldHero)) {
  f = f.replace(oldHero, newHero);
  console.log('Hero improved');
} else {
  console.log('Hero pattern not found - checking current state');
  // Try less strict match
  var idx = f.indexOf('<div className="text-center mb-16">');
  if (idx > -1) {
    console.log('Found hero div at:', idx);
    console.log(f.substring(idx, idx + 300));
  }
}

fs.writeFileSync('src/app/[lang]/page.tsx', f, 'utf-8');
