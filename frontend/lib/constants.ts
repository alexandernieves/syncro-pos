const getApiUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window === 'undefined') {
    return 'http://localhost:9000';
  }
  const hostname = window.location.hostname;

  // Servido por Caddy sobre HTTPS o a través de un túnel: la API pasa por /api en el mismo origen
  // para evitar Mixed Content y conectar con el backend local a través del túnel.
  if (
    hostname.endsWith('.test') ||
    hostname.includes('pinggy') ||
    hostname.includes('loca.lt') ||
    hostname.includes('trycloudflare.com') ||
    hostname.includes('ngrok')
  ) {
    return `${window.location.origin}/api`;
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

