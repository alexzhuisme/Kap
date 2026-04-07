import Store from 'electron-store';
import {EditorOptionsRemoteState, ExportOptions, ExportOptionsPlugin, Format, RemoteStateHandler} from '../common/types';
import {formats} from '../common/constants';

import {builtinSavePlugin} from '../export/builtin-save-plugin';
import {prettifyFormat} from '../utils/formats';

const exportUsageHistory = new Store<{[key in Format]: {lastUsed: number; plugins: Record<string, number>}}>({
  name: 'export-usage-history',
  defaults: {
    gif: {lastUsed: 6, plugins: {default: 1}},
    mp4: {lastUsed: 5, plugins: {default: 1}},
    webm: {lastUsed: 4, plugins: {default: 1}},
    hevc: {lastUsed: 3, plugins: {default: 1}},
    av1: {lastUsed: 2, plugins: {default: 1}},
    apng: {lastUsed: 1, plugins: {default: 1}}
  }
});

const fpsUsageHistory = new Store<{[key in Format]: number}>({
  name: 'fps-usage-history',
  schema: {
    apng: {
      type: 'number',
      minimum: 0,
      default: 60
    },
    webm: {
      type: 'number',
      minimum: 0,
      default: 60
    },
    mp4: {
      type: 'number',
      minimum: 0,
      default: 60
    },
    gif: {
      type: 'number',
      minimum: 0,
      default: 60
    },
    av1: {
      type: 'number',
      minimum: 0,
      default: 60
    },
    hevc: {
      type: 'number',
      minimum: 0,
      default: 60
    }
  }
});

const saveService = builtinSavePlugin.shareServices[0];

const getExportOptions = () => {
  const options = formats.map(format => ({
    format,
    prettyFormat: prettifyFormat(format),
    plugins: [] as ExportOptionsPlugin[],
    lastUsed: exportUsageHistory.get(format).lastUsed
  }));

  const sortFunc = <T extends {lastUsed: number}>(a: T, b: T) => b.lastUsed - a.lastUsed;

  for (const format of saveService.formats) {
    options.find(option => option.format === format)?.plugins.push({
      title: saveService.title,
      pluginName: builtinSavePlugin.name,
      pluginPath: builtinSavePlugin.pluginPath,
      apps: undefined,
      lastUsed: exportUsageHistory.get(format).plugins?.[builtinSavePlugin.name] ?? 0
    });
  }

  return options.map(option => ({...option, plugins: option.plugins.sort(sortFunc)})).sort(sortFunc);
};

const editorOptionsRemoteState: RemoteStateHandler<EditorOptionsRemoteState> = sendUpdate => {
  const state: ExportOptions = {
    formats: getExportOptions(),
    editServices: [],
    fpsHistory: fpsUsageHistory.store
  };

  const actions = {
    updatePluginUsage: (_: string, {format, plugin}: {format: Format; plugin: string}) => {
      const usage = exportUsageHistory.get(format);
      const now = Date.now();

      usage.plugins[plugin] = now;
      usage.lastUsed = now;
      exportUsageHistory.set(format, usage);

      state.formats = getExportOptions();
      sendUpdate(state);
    },
    updateFpsUsage: (_: string, {format, fps}: {format: Format; fps: number}) => {
      fpsUsageHistory.set(format, fps);
      state.fpsHistory = fpsUsageHistory.store;
      sendUpdate(state);
    }
  };

  return {
    actions,
    getState: () => state
  };
};

export default editorOptionsRemoteState;
export const name = 'editor-options';
