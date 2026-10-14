import { contextBridge, ipcRenderer } from 'electron'
import type { MorphicApi } from './index.d'
import type { CoreEvent } from '@shared/core'
import type { BrowserState } from '../main/browser-host'

const call = (method: string, ...params: unknown[]) => ipcRenderer.invoke('core:call', method, params) as Promise<never>

const api: MorphicApi = {
  platform: process.platform,
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (patch) => ipcRenderer.invoke('settings:set', patch)
  },
  // Everything below is served by MORPHIC Core (see src/core), via the host's allow-listed bridge.
  core: (method, ...params) => ipcRenderer.invoke('core:call', method, params),
  onCoreEvent: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, event: CoreEvent) => listener(event)
    ipcRenderer.on('core:event', handler)
    return () => ipcRenderer.removeListener('core:event', handler)
  },
  sessions: {
    list: () => call('sessions.list'),
    get: (id) => call('sessions.get', id),
    rename: (id, title) => call('sessions.rename', id, title),
    delete: (id) => call('sessions.delete', id),
    clear: () => call('sessions.clear')
  },
  chat: {
    send: (id, text) => call('chat.send', id, text),
    retry: (id) => call('chat.retry', id),
    stop: (id) => call('chat.stop', id)
  },
  browser: {
    setBounds: (rect) => ipcRenderer.send('browser:bounds', rect),
    overlay: (on) => ipcRenderer.send('browser:overlay', on),
    show: () => ipcRenderer.send('browser:show'),
    close: () => ipcRenderer.send('browser:close'),
    navigate: (url) => ipcRenderer.send('browser:navigate', url),
    back: () => ipcRenderer.send('browser:back'),
    forward: () => ipcRenderer.send('browser:forward'),
    reload: () => ipcRenderer.send('browser:reload'),
    snapshot: () => ipcRenderer.invoke('browser:snapshot'),
    clearData: () => ipcRenderer.invoke('browser:clear-data'),
    onState: (listener) => {
      const handler = (_e: Electron.IpcRendererEvent, state: BrowserState) => listener(state)
      ipcRenderer.on('browser:state', handler)
      return () => ipcRenderer.removeListener('browser:state', handler)
    }
  },
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  online: () => call('status').then((s) => (s as { online: boolean }).online).catch(() => false),
  setWindowColors: (background, symbols) => ipcRenderer.send('window:chrome', { background, symbols })
}

contextBridge.exposeInMainWorld('morphic', api)
