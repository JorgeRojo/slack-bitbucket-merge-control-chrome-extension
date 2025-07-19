// This file will be used to configure the test environment for Vitest
// We don't need to change anything since Vitest can use the same setup as Jest

global.chrome = {
  runtime: {
    onMessage: {
      addListener: () => {},
    },
    sendMessage: () => Promise.resolve(),
    openOptionsPage: () => {},
    getURL: () => '',
    onInstalled: {
      addListener: () => {},
    },
    onStartup: {
      addListener: () => {},
    },
  },
  storage: {
    sync: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
    },
    local: {
      get: () => Promise.resolve({}),
      set: () => Promise.resolve(),
    },
    onChanged: {
      addListener: () => {},
    },
  },
  alarms: {
    create: () => {},
    clear: () => {},
    onAlarm: {
      addListener: () => {},
    },
  },
  action: {
    setIcon: () => {},
  },
  tabs: {
    sendMessage: () => Promise.resolve(),
  },
  scripting: {
    unregisterContentScripts: () => Promise.resolve(),
    registerContentScripts: () => Promise.resolve(),
  },
};
