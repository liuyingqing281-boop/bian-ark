const fs = require('fs');

// 1. Add CSS animations
const css = fs.readFileSync('src/app/globals.css', 'utf-8');
const add = 

@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 40% { transform: translateX(4px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(3px); } }
.animate-spin { animation: spin 0.8s linear infinite; }
.animate-shake { animation: shake 0.4s ease-in-out; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #44403c; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #57534e; }
::selection { background: rgba(217,119,6,0.3); color: #fcd34d; }
;
if (!css.includes('animate-spin')) {
  fs.writeFileSync('src/app/globals.css', css + add, 'utf-8');
  console.log('CSS updated');
} else {
  console.log('Already has animations');
}
