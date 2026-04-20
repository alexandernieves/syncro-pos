const { app, BrowserWindow, screen, protocol, net } = require('electron');
const path = require('path');
const url = require('url');

const isDev = process.env.NODE_ENV === 'development';

// Registrar el protocolo 'app' como privilegiado
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, allowServiceWorkers: true } }
]);

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const mainWindow = new BrowserWindow({
    width: width,
    height: height,
    title: "Syncro POS",
    icon: path.join(__dirname, '../public/syncro.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true, // Importante mantenerlo activado
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3001');
    mainWindow.webContents.openDevTools();
  } else {
    // CARGA DE PRODUCCIÓN
    mainWindow.loadURL('app://local/index.html');
    
    // Activo las herramientas de desarrollo momentáneamente para que el usuario pueda ver si hay errores de carga
    // mainWindow.webContents.openDevTools(); 
  }
}

app.whenReady().then(() => {
  if (!isDev) {
    protocol.handle('app', (request) => {
      const requestUrl = new URL(request.url);
      let pathname = requestUrl.pathname;
      
      // Si la ruta está vacía o es solo '/', cargar index.html
      if (pathname === '/' || pathname === '') {
        pathname = '/index.html';
      }

      // La carpeta 'out' está un nivel arriba de 'main' en la estructura del proyecto
      // y también en la estructura empaquetada.
      const filePath = path.join(__dirname, '..', 'out', pathname);
      
      // Intentamos cargar el archivo solicitado
      return net.fetch(url.pathToFileURL(filePath).toString()).catch(err => {
        // Fallback para SPA: Si el archivo no existe (ej. una ruta de Next.js), cargamos el index.html
        // Esto es vital para que las rutas internas de Next.js no den error 404
        return net.fetch(url.pathToFileURL(path.join(__dirname, '..', 'out', 'index.html')).toString());
      });
    });
  }

  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
