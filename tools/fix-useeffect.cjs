var fs = require('fs');
var f = fs.readFileSync('src/components/LoginForm.tsx', 'utf-8');

// Move useEffect inside the component function
f = f.replace(
  '  useEffect(() => { if (sent && codeRef.current) codeRef.current.focus(); }, [sent]);\n\n',
  ''
);

f = f.replace(
  'const [error, setError] = useState("");',
  'const [error, setError] = useState("");\n  const [shakeKey, setShakeKey] = useState(0);\n  const codeRef = useRef<HTMLInputElement>(null);\n\n  useEffect(() => { if (sent && codeRef.current) codeRef.current.focus(); }, [sent]);'
);

fs.writeFileSync('src/components/LoginForm.tsx', f, 'utf-8');
console.log('useEffect moved inside component');
console.log('has useEffect inside:', f.includes('  useEffect(() =>'));
console.log('has useEffect outside:', f.includes('export default function LoginForm'));
