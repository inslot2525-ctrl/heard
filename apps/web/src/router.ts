// Minimal hash router: "#/chat/direct/demorao" → ["chat", "direct", "demorao"]. No dependency,
// works on any static host (Render static site) without rewrite rules.
import { useEffect, useState } from 'react';

function parse() {
  return location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export function useRoute() {
  const [parts, setParts] = useState(parse);
  useEffect(() => {
    const on = () => setParts(parse());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}

export function href(...parts: string[]) {
  return `#/${parts.map(encodeURIComponent).join('/')}`;
}

export function go(...parts: string[]) {
  location.hash = href(...parts);
}
