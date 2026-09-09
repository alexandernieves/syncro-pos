module.exports = {
  apps: [
    {
      name: 'syncro-pos-backend',
      script: 'dist/src/main.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      // Si el proceso muere, espera 3s antes de reiniciarlo (evita reinicios
      // en bucle inmediato si la BD sigue sin responder).
      restart_delay: 3000,
      max_restarts: 20,
      min_uptime: '10s',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
