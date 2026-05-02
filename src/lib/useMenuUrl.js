import { useState, useEffect, useRef } from 'react';

export function useMenuUrl() {
  const [menuUrl, setMenuUrl] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    const port = window.location.port || '5173';

    const useLocalIP = () =>
      fetch('/api/local-ip')
        .then(r => r.json())
        .then(({ ip }) => {
          if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
            setMenuUrl(`http://${ip}:${port}/menu`);
          } else {
            setMenuUrl(`${window.location.origin}/menu`);
          }
        })
        .catch(() => setMenuUrl(`${window.location.origin}/menu`));

    const tryPublicUrl = () =>
      fetch('/api/public-url')
        .then(r => r.json())
        .then(({ url }) => {
          if (url) {
            setMenuUrl(`${url}/menu`);
            // Túnel encontrado — para o polling
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return true;
          }
          return false;
        })
        .catch(() => false);

    // 1. Tenta imediatamente
    tryPublicUrl().then(found => {
      if (found) return;

      // 2. Enquanto aguarda o túnel, mostra IP local
      const { hostname, origin } = window.location;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
        // Já estamos num hostname externo (ex: túnel Cloudflare) — usar origin direto
        setMenuUrl(`${origin}/menu`);
      } else {
        useLocalIP();
      }

      // 3. Polling a cada 5s até encontrar URL pública (máx 5 min)
      let attempts = 0;
      intervalRef.current = setInterval(() => {
        attempts++;
        if (attempts > 60) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          return;
        }
        tryPublicUrl();
      }, 5000);
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return menuUrl;
}
