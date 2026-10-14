# Syncro POS para escritorio

App de Electron que abre el servidor de Syncro del negocio (por defecto `https://ebanocontrol.total-net.net`). Las pantallas son las de la web: se actualizan con cada despliegue del servidor, sin sacar otra versión de la app.

Lo que agrega la app:
- Imprime el ticket directo en la impresora elegida en **Syncro → Impresora de tickets**, sin la ventana de impresión.
- Puede abrirse sola al encender la computadora.
- Si no hay conexión, muestra una pantalla para reintentar o cambiar de servidor.
- Se actualiza sola desde los releases de GitHub (en Windows).

## Probar en local

```bash
cd desktop
npm install
npm start
```

## Publicar una versión

1. Sube `version` en `desktop/package.json` (por ejemplo `1.1.1`).
2. Haz commit y crea la etiqueta con el mismo número:

```bash
git tag v1.1.1
git push git@github.com:alexandernieves/syncro-pos.git v1.1.1
```

El runner de GitHub Actions que corre en nuestra Mac construye el instalador de Windows y el de Mac y los publica en **Releases**. La Mac tiene que estar encendida y con el runner activo. Las apps instaladas en Windows encuentran la versión nueva en unas horas, o al usar **Syncro → Buscar actualizaciones**.

Los instaladores no están firmados: Windows muestra un aviso de SmartScreen ("Más información → Ejecutar de todas formas") y en Mac hay que abrirla con clic derecho → Abrir la primera vez.
