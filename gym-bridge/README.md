# Syncro gym bridge

Conecta el lector facial **Hikvision DS-K1T341CMFW** del gimnasio con Syncro. Corre en un servidor de la red local (Ubuntu) y solo hace conexiones de salida: hacia el lector (en la red local) y hacia Syncro (por internet). No hay que abrir puertos ni tener IP pública.

## Qué hace

- **Carga a los socios en el lector**: nombre, foto y la fecha hasta la que pueden entrar. Syncro calcula esa fecha con la membresía, los días de gracia, los congelamientos, las firmas obligatorias y las deudas (si el gimnasio bloquea por deuda). Al renovar, congelar o bloquear a alguien, el lector se actualiza en menos de un minuto.
- **Envía cada reconocimiento a Syncro**: queda como entrada "por rostro" en recepción y en los reportes.
- **Abre la puerta** cuando se lo piden desde Syncro (Control de acceso → Abrir puerta).
- **Modo estricto (opcional)**: Syncro decide cada entrada (horarios del plan, entradas por día, tiempo entre entradas) y el puente abre la puerta. Sin internet no entra nadie por rostro; recepción sigue funcionando.

## 1. Preparar el lector

1. Asígnale una **IP fija** en la red (por ejemplo `192.168.1.50`).
2. Entra a su página web (`http://IP-del-lector`) con el usuario administrador.
3. Activa **ISAPI** (Configuración → Red → Servicios avanzados → Integración → ISAPI) si no lo está.
4. Configura la **hora**: zona horaria del gimnasio (Caracas: UTC-04:00) y NTP. El lector compara las fechas de vigencia con su reloj.
5. Deja la biblioteca de rostros por defecto (FDID 1).

## 2. Crear el lector en Syncro

En Syncro: Gimnasio → Control de acceso → **Agregar lector**. Copia la clave que aparece (se muestra una sola vez).

## 3. Instalar el puente en Ubuntu

```bash
# Node.js 20 o superior
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Usuario sin privilegios y carpeta del puente
sudo useradd --system --create-home --shell /usr/sbin/nologin syncro
sudo mkdir -p /opt/syncro-gym-bridge
sudo cp -r gym-bridge/* gym-bridge/.env.example /opt/syncro-gym-bridge/
cd /opt/syncro-gym-bridge
sudo npm ci --omit=dev

# Configuración
sudo cp .env.example .env
sudo nano .env        # SYNCRO_URL, DEVICE_KEY, DEVICE_HOST, DEVICE_USER, DEVICE_PASS
sudo chown -R syncro:syncro /opt/syncro-gym-bridge
sudo chmod 600 .env

# Prueba de conexión (lector y Syncro)
sudo -u syncro npm run check
```

Si la prueba sale bien:

```bash
sudo cp syncro-gym-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now syncro-gym-bridge
journalctl -u syncro-gym-bridge -f     # ver lo que hace
```

En Syncro, el lector aparece como **Conectado** y empieza a cargar a los socios.

## 4. Probar en la red local

1. En la ficha de un socio con membresía activa, tómale una **foto de frente** con buena luz.
2. Espera menos de un minuto: en Control de acceso → Rostros por revisar, ya no debe aparecer.
3. Que el socio se pare frente al lector: debe abrir y la entrada aparece en recepción como "Por rostro".
4. Prueba con un socio vencido o congelado: el lector no abre y Syncro registra el motivo.
5. Prueba **Abrir puerta** desde Syncro.

Si una foto no sirve (sin cara, varias caras, mala calidad), el motivo aparece en Control de acceso → Rostros por revisar y en la ficha del socio.

## Probar sin el lector (simulador)

```bash
npm install
node src/simulator.js        # lector falso en http://localhost:8091 (usuario admin, clave sim12345)
# en otra terminal, con DEVICE_HOST=http://localhost:8091 en .env:
npm start
# simular que alguien pasa la cara (employeeNo = número de socio):
curl -X POST localhost:8091/sim/recognize -d '{"employeeNo":"1"}'
curl localhost:8091/sim/state
```

## Códigos de evento

El puente envía a Syncro los eventos de acceso del lector (major 5). Se toman como **permitidos** los códigos `1, 38, 75` (tarjeta, huella, rostro) y como **negados** `6, 9, 10, 21, 76`. Algunos firmwares usan otros; se pueden cambiar con `PASS_MINORS` y `FAIL_MINORS` en `.env`.

## Archivos

- `src/bridge.js`: el servicio.
- `src/isapi.js`: cliente del lector (ISAPI con autenticación Digest).
- `src/check.js`: prueba de conexión.
- `src/simulator.js`: lector falso para pruebas.
- `state.json`: lo que ya se cargó en el lector (se crea solo; si lo borras, se vuelve a cargar todo).
