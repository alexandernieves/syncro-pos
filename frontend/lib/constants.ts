const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window === 'undefined') {
    return 'http://localhost:9000';
  }
  const hostname = window.location.hostname;

  // Servido por Caddy sobre HTTPS: la API pasa por /api en el mismo origen
  // para evitar Mixed Content (no se puede llamar http:// desde una página https://).
  if (hostname.endsWith('.test')) {
    return `https://${hostname}/api`;
  }

  const isLocal =
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith('.local');

  return isLocal ? `http://${hostname}:9000` : 'https://syncro-pos-backend.onrender.com';
};

export const API_URL = getApiUrl();

