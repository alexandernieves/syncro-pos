# Ebano Control en el servidor

Syncro para el gimnasio Ebano, en `https://ebanocontrol.total-net.net`.

Corre con Docker en tres contenedores:

| Contenedor | Qué es | Dónde escucha |
|---|---|---|
| `db` | PostgreSQL 16 con pgvector | `127.0.0.1:5442` (solo desde el servidor) |
| `backend` | API de Syncro | Solo dentro de Docker |
| `frontend` | El panel y el proxy de `/api` | `127.0.0.1:8095` |

El servidor web que ya atiende los otros proyectos recibe el dominio y lo reenvía a `127.0.0.1:8095`. Nada de Ebano queda abierto a internet directamente.

---

## 1. Primera instalación

### 1.1 Carpeta y código

```bash
mkdir -p ~/ebanocontrol && cd ~/ebanocontrol
git clone -b ebanocontrol https://github.com/alexandernieves/syncro-pos.git .
```

### 1.2 Secretos

Crea los dos archivos de secretos a partir de los ejemplos. No se suben a GitHub.

```bash
cp .env.example .env
cp backend.env.example backend.env
```

En `.env`, cambia `DB_PASSWORD` por una clave larga. Si el puerto `8095` o el `5442` ya están ocupados por otro proyecto, cambia `EBANO_PORT` o `DB_PORT`.

En `backend.env`:
- `JWT_SECRET` y `COOKIE_SECRET`: genera cada uno con `openssl rand -hex 32`.
- Las credenciales de AWS S3 (fotos y recibos).
- Las de Evolution API (WhatsApp), mientras no esté Koenyx.

Para las notificaciones del navegador, genera las claves VAPID y pon el resultado en `backend.env`:

```bash
docker run --rm node:20-alpine npx -y web-push generate-vapid-keys
```

### 1.3 Construir y levantar

```bash
docker compose build backend frontend
docker compose up -d db
docker compose run --rm backend npx prisma db push --skip-generate
docker compose up -d backend frontend
```

`prisma db push` crea las tablas en la base vacía. Se usa solo esta primera vez.

### 1.4 Comprobar

```bash
docker compose ps
curl -s -o /dev/null -w "panel %{http_code}\n" http://127.0.0.1:8095/
curl -s -w "\n" http://127.0.0.1:8095/api/settings
```

- El panel debe responder `200`.
- La API debe responder `{"message":"Unauthorized","statusCode":401}`. Eso es lo correcto: todavía no hay sesión.

---

## 2. Publicar el dominio

Primero averigua qué servidor web atiende los otros proyectos:

```bash
sudo ss -tlnp | grep -E ':80 |:443 '
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' | grep -E ':80->|:443->'
```

Según lo que salga, sigue la opción A, B o C.

### A. Nginx instalado en el servidor

```bash
sudo tee /etc/nginx/sites-available/ebanocontrol >/dev/null <<'NGINX'
server {
  listen 80;
  server_name ebanocontrol.total-net.net;
  client_max_body_size 25m;
  location / {
    proxy_pass http://127.0.0.1:8095;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;
  }
}
NGINX
sudo ln -s /etc/nginx/sites-available/ebanocontrol /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d ebanocontrol.total-net.net
```

### B. Nginx Proxy Manager (en un contenedor)

Primero, en `.env` pon `EBANO_BIND=172.17.0.1` y vuelve a levantar el panel con `docker compose up -d frontend`. Así lo alcanza el contenedor del proxy, pero no internet.

Después, en el panel de Nginx Proxy Manager: **Proxy Hosts → Add**.
- **Dominio:** `ebanocontrol.total-net.net`
- **Forward:** host `172.17.0.1`, puerto `8095`
- **Websockets Support:** activado
- **Pestaña SSL:** Request a new certificate, Force SSL

### C. Traefik o Caddy

Hay que añadir una regla para `ebanocontrol.total-net.net` que apunte a `127.0.0.1:8095`, con websockets. Con Caddy basta con esto:

```
ebanocontrol.total-net.net {
  reverse_proxy 127.0.0.1:8095
}
```

---

## 3. Actualizar

```bash
cd ~/ebanocontrol
git pull origin ebanocontrol
docker compose build backend frontend && docker compose up -d backend frontend
```

Si la actualización trae migraciones nuevas, hay que aplicarlas. Las migraciones están en `backend/prisma/manual-migrations` y se aplican una sola vez cada una, en orden de nombre. Antes de aplicarlas, saca un respaldo:

```bash
docker compose exec db pg_dump -U ebano -d ebanocontrol -Fc -f /backups/antes-$(date +%F-%H%M).dump
for f in backend/prisma/manual-migrations/2026-*.sql; do
  docker compose exec -T db psql -U ebano -d ebanocontrol -v ON_ERROR_STOP=1 -q < "$f"
done
```

---

## 4. Respaldos

El respaldo queda en `backend/backups/` del servidor:

```bash
docker compose exec db pg_dump -U ebano -d ebanocontrol -Fc -f /backups/ebano-$(date +%F).dump
```

---

## 5. Ver qué pasa

```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose restart backend
```
