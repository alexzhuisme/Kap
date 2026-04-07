import {app} from 'electron';
import {enforceMacOSAppLocation} from 'electron-util';
import log from 'electron-log';
import {autoUpdater} from 'electron-updater';
import toMilliseconds from '@sindresorhus/to-milliseconds';

import './windows/load';
import './utils/sentry';

import {settings} from './common/settings';
import {plugins} from './plugins';
import {initializeTray, setRendererReady} from './tray';
import {initializeDevices} from './utils/devices';
import {initializeAnalytics, track} from './common/analytics';
import {initializeGlobalAccelerators} from './global-accelerators';
import {openFiles} from './utils/open-files';
import {hasMicrophoneAccess, ensureScreenCapturePermissions} from './common/system-permissions';
import {handleDeepLink} from './utils/deep-linking';
import {hasActiveRecording, cleanPastRecordings} from './recording-history';
import {setupRemoteStates} from './remote-states';
import {setUpExportsListeners} from './export';
import {windowManager} from './windows/manager';
import {setupProtocol} from './utils/protocol';
import {stopRecordingWithNoEdit} from './aperture';
import {prepareRenderer} from './utils/next-loader';
import {registerIpcHandlers} from './ipc-handlers';

const filesToOpen: string[] = [];

let onExitCleanupComplete = false;

app.commandLine.appendSwitch('--enable-features', 'OverlayScrollbar');

app.on('open-file', (event, path) => {
  event.preventDefault();

  if (app.isReady()) {
    track('editor/opened/running');
    openFiles(path);
  } else {
    filesToOpen.push(path);
  }
});

const initializePlugins = async () => {
  if (app.isPackaged) {
    try {
      await plugins.upgrade();
    } catch (error) {
      console.log(error);
    }
  }
};

const checkForUpdates = () => {
  if (!app.isPackaged) {
    return false;
  }

  const checkForUpdates = async () => {
    try {
      await autoUpdater.checkForUpdates();
    } catch (error) {
      autoUpdater.logger?.error(error);
    }
  };

  // For auto-update debugging in Console.app
  autoUpdater.logger = log;
  // @ts-expect-error
  autoUpdater.logger.transports.file.level = 'info';

  setInterval(checkForUpdates, toMilliseconds({hours: 1}));

  checkForUpdates();
  return true;
};

// Prepare the renderer once the app is ready
(async () => {
  await app.whenReady();
  require('./utils/errors').setupErrorHandling();

  // Initialize remote states
  setupRemoteStates();
  registerIpcHandlers();

  setupProtocol();

  app.dock.hide();
  app.setAboutPanelOptions({copyright: 'Copyright © Wulkano'});

  // Ensure the app is in the Applications folder
  enforceMacOSAppLocation();

  // Show tray icon and register shortcuts immediately so the app feels responsive
  initializeTray();
  initializeGlobalAccelerators();
  initializeDevices();
  initializeAnalytics();
  setUpExportsListeners();

  // Prepare the Next.js renderer and plugin upgrades in parallel
  await Promise.all([
    prepareRenderer('./renderer'),
    initializePlugins()
  ]);

  setRendererReady();

  if (!app.isDefaultProtocolClient('kap')) {
    app.setAsDefaultProtocolClient('kap');
  }

  if (filesToOpen.length > 0) {
    track('editor/opened/startup');
    openFiles(...filesToOpen);
    hasActiveRecording();
  } else if (
    !(await hasActiveRecording()) &&
    !app.getLoginItemSettings().wasOpenedAtLogin &&
    (await ensureScreenCapturePermissions()) &&
    (!settings.get('recordAudio') || hasMicrophoneAccess())
  ) {
    windowManager.cropper?.open();
  }

  checkForUpdates();
})();

app.on('window-all-closed', () => {
  app.dock.hide();
});

app.on('will-finish-launching', () => {
  app.on('open-url', (event, url) => {
    event.preventDefault();
    handleDeepLink(url);
  });
});

app.on('before-quit', async (event: any) => {
  if (!onExitCleanupComplete) {
    event.preventDefault();
    await stopRecordingWithNoEdit();
    cleanPastRecordings();
    onExitCleanupComplete = true;
    app.quit();
  }
});
