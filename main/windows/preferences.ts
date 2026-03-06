import path from 'path';
import {BrowserWindow, ipcMain} from 'electron';
import pEvent from 'p-event';

import {sendToRenderer} from '../ipc-handlers';
import {loadRoute} from '../utils/routes';
import {track} from '../common/analytics';
import {windowManager} from './manager';

let prefsWindow: BrowserWindow | undefined;

export type PreferencesWindowOptions = any;

const openPrefsWindow = async (options?: PreferencesWindowOptions) => {
  track('preferences/opened');
  windowManager.cropper?.close();

  if (prefsWindow) {
    if (options) {
      sendToRenderer(prefsWindow, 'options', options);
    }

    prefsWindow.show();
    return prefsWindow;
  }

  prefsWindow = new BrowserWindow({
    title: 'Preferences',
    width: 480,
    height: 480,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    titleBarStyle: 'hiddenInset',
    show: false,
    frame: false,
    transparent: true,
    vibrancy: 'window',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload.js')
    }
  });

  const titlebarHeight = 85;
  prefsWindow.setSheetOffset(titlebarHeight);

  prefsWindow.on('close', () => {
    prefsWindow = undefined;
  });

  loadRoute(prefsWindow, 'preferences');

  await pEvent(prefsWindow.webContents, 'did-finish-load');

  if (options) {
    sendToRenderer(prefsWindow, 'options', options);
  }

  sendToRenderer(prefsWindow, 'mount');

  await new Promise<void>(resolve => {
    ipcMain.handleOnce('preferences-ready', () => {
      resolve();
    });
  });

  prefsWindow.show();
  return prefsWindow;
};

const closePrefsWindow = () => {
  if (prefsWindow) {
    prefsWindow.close();
  }
};

ipcMain.handle('open-preferences', async (_, options) => openPrefsWindow(options));

windowManager.setPreferences({
  open: openPrefsWindow,
  close: closePrefsWindow
});
