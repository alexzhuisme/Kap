import {contextBridge, ipcRenderer, IpcRendererEvent} from 'electron';

type Listener = (...args: any[]) => void;

const kapApi = {
  ipc: {
    invoke: (channel: string, ...args: any[]): Promise<any> =>
      ipcRenderer.invoke(channel, ...args),

    send: (channel: string, ...args: any[]): void =>
      ipcRenderer.send(channel, ...args),

    on: (channel: string, listener: Listener): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, ...args: any[]) => listener(...args);
      ipcRenderer.on(channel, wrapped);
      return () => {
        ipcRenderer.removeListener(channel, wrapped);
      };
    },

    once: (channel: string, listener: Listener): void => {
      ipcRenderer.once(channel, (_event: IpcRendererEvent, ...args: any[]) => listener(...args));
    },

    onWithReply: (channel: string, handler: (data: any) => any | Promise<any>): (() => void) => {
      const wrapped = async (_event: IpcRendererEvent, data: any, requestId?: number) => {
        const result = await handler(data);
        if (requestId !== undefined) {
          ipcRenderer.send(`kap:reply:${channel}:${requestId}`, result);
        }
      };

      ipcRenderer.on(channel, wrapped);
      return () => {
        ipcRenderer.removeListener(channel, wrapped);
      };
    }
  },

  window: {
    close: (): Promise<void> => ipcRenderer.invoke('kap:window:close'),
    minimize: (): Promise<void> => ipcRenderer.invoke('kap:window:minimize'),
    maximize: (): Promise<void> => ipcRenderer.invoke('kap:window:maximize'),
    show: (): Promise<void> => ipcRenderer.invoke('kap:window:show'),
    focus: (): Promise<void> => ipcRenderer.invoke('kap:window:focus'),
    getBounds: (): Promise<{x: number; y: number; width: number; height: number}> =>
      ipcRenderer.invoke('kap:window:getBounds'),
    setBounds: (bounds: any, animate?: boolean): Promise<void> =>
      ipcRenderer.invoke('kap:window:setBounds', bounds, animate),
    getSize: (): Promise<number[]> => ipcRenderer.invoke('kap:window:getSize'),
    setSize: (width: number, height: number): Promise<void> =>
      ipcRenderer.invoke('kap:window:setSize', width, height),
    setContentSize: (width: number, height: number): Promise<void> =>
      ipcRenderer.invoke('kap:window:setContentSize', width, height),
    getContentSize: (): Promise<number[]> => ipcRenderer.invoke('kap:window:getContentSize'),
    setResizable: (resizable: boolean): Promise<void> =>
      ipcRenderer.invoke('kap:window:setResizable', resizable),
    setFullScreenable: (fullscreenable: boolean): Promise<void> =>
      ipcRenderer.invoke('kap:window:setFullScreenable', fullscreenable),
    setIgnoreMouseEvents: (ignore: boolean, options?: any): Promise<void> =>
      ipcRenderer.invoke('kap:window:setIgnoreMouseEvents', ignore, options),
    isVisible: (): Promise<boolean> => ipcRenderer.invoke('kap:window:isVisible')
  },

  system: {
    getAccentColor: (): Promise<string> => ipcRenderer.invoke('kap:system:getAccentColor'),
    getColor: (name: string): Promise<string> => ipcRenderer.invoke('kap:system:getColor', name),
    getUserDefault: (key: string, type: string): Promise<any> =>
      ipcRenderer.invoke('kap:system:getUserDefault', key, type),
    isDarkMode: (): Promise<boolean> => ipcRenderer.invoke('kap:system:isDarkMode'),
    onThemeChanged: (callback: Listener): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, isDark: boolean) => callback(isDark);
      ipcRenderer.on('kap:system:theme-changed', wrapped);
      return () => {
        ipcRenderer.removeListener('kap:system:theme-changed', wrapped);
      };
    },
    onAccentColorChanged: (callback: Listener): (() => void) => {
      const wrapped = (_event: IpcRendererEvent, color: string) => callback(color);
      ipcRenderer.on('kap:system:accent-color-changed', wrapped);
      return () => {
        ipcRenderer.removeListener('kap:system:accent-color-changed', wrapped);
      };
    },
    subscribeNotification: (name: string): Promise<number> =>
      ipcRenderer.invoke('kap:system:subscribeNotification', name),
    unsubscribeNotification: (id: number): Promise<void> =>
      ipcRenderer.invoke('kap:system:unsubscribeNotification', id)
  },

  dialog: {
    showMessageBox: (options: any): Promise<{response: number; checkboxChecked: boolean}> =>
      ipcRenderer.invoke('kap:dialog:showMessageBox', options),
    showMessageBoxSync: (options: any): number =>
      ipcRenderer.sendSync('kap:dialog:showMessageBoxSync', options),
    showOpenDialog: (options: any): Promise<{canceled: boolean; filePaths: string[]}> =>
      ipcRenderer.invoke('kap:dialog:showOpenDialog', options),
    showSaveDialog: (options: any): Promise<{canceled: boolean; filePath?: string}> =>
      ipcRenderer.invoke('kap:dialog:showSaveDialog', options)
  },

  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('kap:shell:openExternal', url),
    openPath: (path: string): Promise<string> => ipcRenderer.invoke('kap:shell:openPath', path),
    showItemInFolder: (path: string): Promise<void> =>
      ipcRenderer.invoke('kap:shell:showItemInFolder', path)
  },

  menu: {
    popup: (template: any[], position?: {x: number; y: number}): Promise<any> =>
      ipcRenderer.invoke('kap:menu:popup', template, position)
  },

  app: {
    getVersion: (): Promise<string> => ipcRenderer.invoke('kap:app:getVersion'),
    getName: (): Promise<string> => ipcRenderer.invoke('kap:app:getName'),
    getPath: (name: string): Promise<string> => ipcRenderer.invoke('kap:app:getPath', name),
    getLoginItemSettings: (): Promise<any> => ipcRenderer.invoke('kap:app:getLoginItemSettings'),
    setLoginItemSettings: (settings: any): Promise<void> =>
      ipcRenderer.invoke('kap:app:setLoginItemSettings', settings),
    quit: (): Promise<void> => ipcRenderer.invoke('kap:app:quit')
  }
};

contextBridge.exposeInMainWorld('kap', kapApi);
