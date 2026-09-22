const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

const SETTINGS_PATH = () => path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_PATH(), 'utf8')); }
  catch { return {}; }
}

function writeSettings(data) {
  try { fs.writeFileSync(SETTINGS_PATH(), JSON.stringify(data), 'utf8'); }
  catch {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  buildMenu();
}

function buildMenu() {
  const template = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Folder…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: openFolder,
        },
        {
          label: 'New File',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu:new-file'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu:save'),
        },
        { type: 'separator' },
        { role: 'close' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openFolder() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    mainWindow.webContents.send('folder:opened', result.filePaths[0]);
  }
}

// IPC handlers

ipcMain.handle('fs:readDir', async (_, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory() || e.name.match(/\.md$/i))
      .map(e => {
        const fullPath = path.join(dirPath, e.name);
        const mtime = fs.statSync(fullPath).mtimeMs;
        return { name: e.name, path: fullPath, isDir: e.isDirectory(), mtime };
      })
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return b.mtime - a.mtime;
      });
  } catch {
    return [];
  }
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
});

ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs:newFile', async (_, dirPath) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(dirPath || app.getPath('documents'), 'untitled.md'),
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, '', 'utf8');
    return result.filePath;
  }
  return null;
});

ipcMain.handle('fs:deleteFile', async (_, filePath) => {
  try {
    fs.unlinkSync(filePath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('dialog:confirm', async (_, message, detail) => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['Cancel', 'Delete'],
    defaultId: 0,
    cancelId: 0,
    message,
    detail,
  });
  return response === 1;
});

ipcMain.handle('fs:renameFile', async (_, oldPath, newPath) => {
  try {
    fs.renameSync(oldPath, newPath);
    return { ok: true, newPath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('dialog:openFolder', openFolder);

ipcMain.handle('fs:cleanImages', async (_, filePath) => {
  try {
    const fileDir = path.dirname(filePath);
    const imagesDir = path.join(fileDir, 'images');
    if (!fs.existsSync(imagesDir)) return { ok: true };

    const imageFiles = fs.readdirSync(imagesDir)
      .filter(f => /\.(png|jpe?g|gif|webp|svg)$/i.test(f));

    const mdFiles = fs.readdirSync(fileDir)
      .filter(f => /\.md$/i.test(f))
      .map(f => path.join(fileDir, f));

    const referenced = new Set();
    for (const md of mdFiles) {
      const content = fs.readFileSync(md, 'utf8');
      for (const m of content.matchAll(/!\[.*?\]\(images\/([^)]+)\)/g)) {
        referenced.add(m[1]);
      }
    }

    for (const img of imageFiles) {
      if (!referenced.has(img)) fs.unlinkSync(path.join(imagesDir, img));
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('fs:saveImage', async (_, filePath, base64Data, ext) => {
  try {
    const imagesDir = path.join(path.dirname(filePath), 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    const filename = `image-${Date.now()}.${ext === 'jpeg' ? 'jpg' : ext}`;
    fs.writeFileSync(path.join(imagesDir, filename), Buffer.from(base64Data, 'base64'));
    return { ok: true, relativePath: `images/${filename}` };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('settings:get', (_, key) => readSettings()[key] ?? null);
ipcMain.handle('settings:set', (_, key, value) => {
  const s = readSettings();
  s[key] = value;
  writeSettings(s);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
