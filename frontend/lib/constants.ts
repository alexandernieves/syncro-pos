export const API_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com') 
    ? 'https://syncro-pos-backend.onrender.com' 
    : 'http://localhost:9000');
