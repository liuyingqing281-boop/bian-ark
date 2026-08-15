var fs = require('fs');
var f = fs.readFileSync('src/components/LoginForm.tsx', 'utf-8');
f = f.replace('maxLength={6}', 'maxLength={6}\n          onKeyDown={(e) => e.key === "Enter" && code.length === 6 && verify()}');
f = f.replace('onChange={(e) => setCode(e.target.value)}', 'onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}');
f = f.replace('<p className="text-xs text-red-400">{error}</p>', '<p key={shakeKey} className="text-xs text-red-400 animate-shake">{error}</p>');
fs.writeFileSync('src/components/LoginForm.tsx', f, 'utf-8');
console.log('LoginForm polish done');
