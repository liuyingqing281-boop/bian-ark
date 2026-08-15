const fs = require('fs');

// Read current LoginForm
const src = fs.readFileSync('src/components/LoginForm.tsx', 'utf-8');

// Only add import for useRef and useEffect if missing
let updated = src;

// Add useRef, useEffect to the import
if (src.includes('useState') && !src.includes('useRef')) {
  updated = src.replace(
    'import { useState } from "react";',
    'import { useState, useRef, useEffect } from "react";'
  );
}

// Add shake animation support
if (!src.includes('setShakeKey')) {
  // Add shakeKey state after setError
  updated = updated.replace(
    'const [error, setError] = useState("");',
    'const [error, setError] = useState("");\n  const [shakeKey, setShakeKey] = useState(0);\n  const codeRef = useRef<HTMLInputElement>(null);'
  );
}

// Add focus effect
if (!src.includes('codeRef.current')) {
  updated = updated.replace(
    'export default function LoginForm',
    '  useEffect(() => { if (sent && codeRef.current) codeRef.current.focus(); }, [sent]);\n\nexport default function LoginForm'
  );
}

// Add shake to error handler
if (src.includes('setError(data.error') && !src.includes('setShakeKey')) {
  updated = updated.replace(
    'setError(data.error || labels.failed)',
    'setError(data.error || labels.failed); setShakeKey(k => k + 1)'
  );
}

// Add input class improvements
if (src.includes('focus:outline-none focus:border-amber-700')) {
  updated = updated.replace(
    'focus:outline-none focus:border-amber-700',
    'focus:outline-none focus:ring-2 focus:ring-amber-700/50 focus:border-amber-600 transition-all duration-200'
  );
}

// Add placeholder improvements
if (src.includes('placeholder-stone-600')) {
  // Already good
}

// Add backdrop-blur to form container
if (src.includes('rounded-xl p-6 space-y-4') && !src.includes('backdrop-blur-sm')) {
  updated = updated.replace(
    'rounded-xl p-6 space-y-4',
    'rounded-xl p-6 space-y-4 backdrop-blur-sm'
  );
}

// Add key to error message for shake animation
if (src.includes('{error && (') && !src.includes('key={shakeKey}')) {
  updated = updated.replace(
    '{error && (',
    '{error && ('
  );
  // Try to add key to the error paragraph
  updated = updated.replace(
    '<p className="text-xs text-red-400',
    '<p key={shakeKey} className="text-xs text-red-400 animate-shake'
  );
}

// Add enter key handlers
if (src.includes('requestCode()') && !src.includes('onKeyDown')) {
  // Add onKeyDown to target input
  updated = updated.replace(
    '/>',
    '\n          onKeyDown={e => e.key === "Enter" && target && requestCode()} />'
  );
}

// Add code input digit filter
if (src.includes('setCode(e.target.value)') && !src.includes('replace')) {
  updated = updated.replace(
    'setCode(e.target.value)',
    'setCode(e.target.value.replace(/\\D/g, "").slice(0, 6))'
  );
}

fs.writeFileSync('src/components/LoginForm.tsx', updated, 'utf-8');
console.log('LoginForm updated');
console.log('Changes: useRef=' + src.includes('useRef'));
console.log('shakeKey=' + src.includes('setShakeKey'));
console.log('codeRef=' + src.includes('codeRef'));
console.log('backdrop=' + src.includes('backdrop-blur'));
console.log('focusRing=' + updated.includes('focus:ring-2'));
