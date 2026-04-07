import {Container} from 'unstated';

const defaultInputDeviceId = 'asd';

const SETTINGS_ANALYTICS_BLACKLIST = ['kapturesDir'];

export default class PreferencesContainer extends Container {
  state = {
    category: 'general',
    tab: 'discover',
    isMounted: false,
    shortcutMap: {},
    shortcuts: {}
  };

  mount = async setOverlay => {
    this.setOverlay = setOverlay;

    const [settingsStore, shortcuts, pluginsInstalled, loginItemSettings] = await Promise.all([
      window.kap.ipc.invoke('settings:getAll'),
      window.kap.ipc.invoke('settings:getShortcuts'),
      window.kap.ipc.invoke('plugins:getInstalled'),
      window.kap.app.getLoginItemSettings()
    ]);

    const sortedPlugins = pluginsInstalled.sort((a, b) => a.prettyName.localeCompare(b.prettyName));

    this.fetchFromNpm();

    this.setState({
      shortcuts: {},
      ...settingsStore,
      openOnStartup: loginItemSettings.openAtLogin,
      pluginsInstalled: sortedPlugins,
      isMounted: true,
      shortcutMap: shortcuts
    });

    if (settingsStore.recordAudio) {
      this.getAudioDevices();
    }
  };

  getAudioDevices = async () => {
    const [audioDevices, defaultDevice, settingsStore] = await Promise.all([
      window.kap.ipc.invoke('devices:getAudioDevices'),
      window.kap.ipc.invoke('devices:getDefaultInputDevice'),
      window.kap.ipc.invoke('settings:getAll')
    ]);

    const {audioInputDeviceId} = settingsStore;
    const currentDefaultName = defaultDevice?.name;

    const updates = {
      audioDevices: [
        {name: `System Default${currentDefaultName ? ` (${currentDefaultName})` : ''}`, id: defaultInputDeviceId},
        ...audioDevices
      ],
      audioInputDeviceId
    };

    if (!audioDevices.some(device => device.id === audioInputDeviceId)) {
      updates.audioInputDeviceId = defaultInputDeviceId;
      await window.kap.ipc.invoke('settings:set', 'audioInputDeviceId', defaultInputDeviceId);
    }

    this.setState(updates);
  };

  scrollIntoView = (tabId, pluginId) => {
    const plugin = document.querySelector(`#${tabId} #${pluginId}`).parentElement;
    plugin.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest'
    });
  };

  openTarget = target => {
    const isInstalled = this.state.pluginsInstalled.some(plugin => plugin.name === target.name);
    const isFromNpm = this.state.pluginsFromNpm && this.state.pluginsFromNpm.some(plugin => plugin.name === target.name);

    if (target.action === 'install') {
      if (isInstalled) {
        this.scrollIntoView(this.state.tab, target.name);
        this.setState({category: 'plugins'});
      } else if (isFromNpm) {
        this.scrollIntoView('discover', target.name);
        this.setState({category: 'plugins', tab: 'discover'});

        const buttonIndex = window.kap.dialog.showMessageBoxSync({
          type: 'question',
          buttons: [
            'Install',
            'Cancel'
          ],
          defaultId: 0,
          cancelId: 1,
          message: `Do you want to install the "${target.name}" plugin?`
        });

        if (buttonIndex === 0) {
          this.install(target.name);
        }
      } else {
        this.setState({category: 'plugins'});
      }
    } else if (target.action === 'configure' && isInstalled) {
      this.openPluginsConfig(target.name);
    } else {
      this.setState({category: 'plugins'});
    }
  };

  setNavigation = ({category, tab, target}) => {
    if (target) {
      if (this.state.isMounted) {
        this.openTarget(target);
      } else {
        this.setState({target});
      }
    } else {
      this.setState({category, tab});
    }
  };

  fetchFromNpm = async () => {
    try {
      const plugins = await window.kap.ipc.invoke('plugins:getFromNpm');
      this.setState({
        npmError: false,
        pluginsFromNpm: plugins.sort((a, b) => {
          if (a.isCompatible !== b.isCompatible) {
            return b.isCompatible - a.isCompatible;
          }

          return a.prettyName.localeCompare(b.prettyName);
        })
      });

      if (this.state.target) {
        this.openTarget(this.state.target);
        this.setState({target: undefined});
      }
    } catch {
      this.setState({npmError: true});
    }
  };

  togglePlugin = plugin => {
    if (plugin.isInstalled) {
      this.uninstall(plugin.name);
    } else {
      this.install(plugin.name);
    }
  };

  install = async name => {
    const {pluginsInstalled, pluginsFromNpm} = this.state;

    this.setState({pluginBeingInstalled: name});
    const result = await window.kap.ipc.invoke('plugins:install', name);

    if (result) {
      this.setState({
        pluginBeingInstalled: undefined,
        pluginsFromNpm: pluginsFromNpm.filter(p => p.name !== name),
        pluginsInstalled: [result, ...pluginsInstalled].sort((a, b) => a.prettyName.localeCompare(b.prettyName))
      });
    } else {
      this.setState({
        pluginBeingInstalled: undefined
      });
    }
  };

  uninstall = async name => {
    const {pluginsInstalled, pluginsFromNpm} = this.state;

    const onTransitionEnd = async () => {
      const plugin = await window.kap.ipc.invoke('plugins:uninstall', name);
      this.setState({
        pluginsInstalled: pluginsInstalled.filter(p => p.name !== name),
        pluginsFromNpm: [plugin, ...pluginsFromNpm].sort((a, b) => a.prettyName.localeCompare(b.prettyName)),
        pluginBeingUninstalled: null,
        onTransitionEnd: null
      });
    };

    this.setState({pluginBeingUninstalled: name, onTransitionEnd});
  };

  openPluginsConfig = async name => {
    await window.kap.ipc.invoke('analytics:track', `plugin/config/${name}`);
    this.scrollIntoView('installed', name);
    this.setState({category: 'plugins'});
    this.setOverlay(true);
    await window.kap.ipc.invoke('plugins:openConfig', name);
    await window.kap.ipc.invoke('refresh-usage');
    this.setOverlay(false);
  };

  openPluginsFolder = async () => {
    const pluginsDir = await window.kap.ipc.invoke('plugins:getPluginsDir');
    window.kap.shell.openPath(pluginsDir);
  };

  selectCategory = category => {
    this.setState({category});
  };

  selectTab = async tab => {
    await window.kap.ipc.invoke('analytics:track', `preferences/tab/${tab}`);
    this.setState({tab});
  };

  toggleSetting = async (setting, value) => {
    const newValue = value === undefined ? !this.state[setting] : value;
    if (!SETTINGS_ANALYTICS_BLACKLIST.includes(setting)) {
      window.kap.ipc.invoke('analytics:track', `preferences/setting/${setting}/${newValue}`);
    }

    this.setState({[setting]: newValue});
    await window.kap.ipc.invoke('settings:set', setting, newValue);
  };

  toggleRecordAudio = async () => {
    const newValue = !this.state.recordAudio;
    window.kap.ipc.invoke('analytics:track', `preferences/setting/recordAudio/${newValue}`);

    if (!newValue || await window.kap.ipc.invoke('system:ensureMicrophonePermissions')) {
      if (newValue) {
        try {
          await this.getAudioDevices();
        } catch (error) {
          await window.kap.ipc.invoke('errors:show', error.message || String(error));
        }
      }

      this.setState({recordAudio: newValue});
      await window.kap.ipc.invoke('settings:set', 'recordAudio', newValue);
    }
  };

  toggleShortcuts = async () => {
    const setting = 'enableShortcuts';
    const newValue = !this.state[setting];
    this.toggleSetting(setting, newValue);
    await window.kap.ipc.invoke('toggle-shortcuts', {enabled: newValue});
  };

  updateShortcut = async (setting, shortcut) => {
    try {
      await window.kap.ipc.invoke('update-shortcut', {setting, shortcut});
      this.setState({
        shortcuts: {
          ...this.state.shortcuts,
          [setting]: shortcut
        }
      });
    } catch (error) {
      console.warn('Error updating shortcut', error);
    }
  };

  setOpenOnStartup = async value => {
    const openOnStartup = typeof value === 'boolean' ? value : !this.state.openOnStartup;
    this.setState({openOnStartup});
    await window.kap.app.setLoginItemSettings({openAtLogin: openOnStartup});
  };

  pickKapturesDir = async () => {
    const result = await window.kap.dialog.showOpenDialog({
      properties: [
        'openDirectory',
        'createDirectory'
      ]
    });

    if (!result.canceled && result.filePaths.length > 0) {
      this.toggleSetting('kapturesDir', result.filePaths[0]);
    }
  };

  setAudioInputDeviceId = async id => {
    this.setState({audioInputDeviceId: id});
    await window.kap.ipc.invoke('settings:set', 'audioInputDeviceId', id);
  };
}
