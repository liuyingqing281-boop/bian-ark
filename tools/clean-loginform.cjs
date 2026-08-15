var fs = require('fs');
var f = fs.readFileSync('src/components/LoginForm.tsx', 'utf-8');

// Remove duplicate declarations
f = f.replace(/const \[shakeKey, setShakeKey\] = useState\(0\);\s*/g, '');
f = f.replace(/const codeRef = useRef.*?;\s*/g, '');
f = f.replace(/useEffect\(\(\) => \{ if \(sent && codeRef\.current\) codeRef\.current\.focus\(\); \}, \[sent\]\);\s*/g, '');
f = f.replace(/import \{ useState, useRef, useEffect \} from "react";/, 'import { useState } from "react";');

// Add clean version
f = f.replace(
  'const [error, setError] = useState("");',
  'const [error, setError] = useState("");\n  const [shakeKey, setShakeKey] = useState(0);\n  const codeRef = useRef<HTMLInputElement>(null);\n\n  useEffect(() => { if (sent && codeRef.current) codeRef.current.focus(); }, [sent]);'
);

f = f.replace(
  'import { useState } from "react";',
  'import { useState, useRef, useEffect } from "react";'
);

fs.writeFileSync('src/components/LoginForm.tsx', f, 'utf-8');
console.log('LoginForm cleaned');
console.log('current length:', f.length);
