import { vi } from 'vitest';

export const mockStorage = {
  sync: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  local: {
    get: vi.fn().mockResolvedValue({}),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  },
  onChanged: {
    addListener: vi.fn(),
  },
};

export const mockRuntime = {
  onMessage: {
    addListener: vi.fn(),
  },
  onInstalled: {
    addListener: vi.fn(_callback => {}),
  },
  onStartup: {
    addListener: vi.fn(_callback => {}),
  },
  sendMessage: vi.fn().mockResolvedValue(undefined),
  openOptionsPage: vi.fn().mockResolvedValue(undefined),
  getURL: vi.fn(() => ''),
  lastError: null,
};

export const mockAlarms = {
  onAlarm: {
    addListener: vi.fn(),
  },
  create: vi.fn().mockResolvedValue(undefined),
  clear: vi.fn().mockResolvedValue(undefined),
};

export const mockTabs = {
  query: vi.fn().mockResolvedValue([]),
  sendMessage: vi.fn().mockResolvedValue(undefined),
};

export const mockAction = {
  setIcon: vi.fn().mockResolvedValue(undefined),
  setBadgeText: vi.fn().mockResolvedValue(undefined),
  setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
};

export const mockScripting = {
  registerContentScripts: vi.fn().mockResolvedValue(undefined),
  unregisterContentScripts: vi.fn().mockResolvedValue(undefined),
  getRegisteredContentScripts: vi.fn().mockResolvedValue([]),
};

export const mockPermissions = {
  request: vi.fn().mockResolvedValue(true),
  contains: vi.fn().mockResolvedValue(true),
};

interface _ChromeMock {
  storage: typeof mockStorage;
  runtime: typeof mockRuntime;
  alarms: typeof mockAlarms;
  tabs: typeof mockTabs;
  action: typeof mockAction;
  scripting: typeof mockScripting;
  permissions: typeof mockPermissions;
}

(global as any).chrome = {
  storage: mockStorage,
  runtime: mockRuntime,
  alarms: mockAlarms,
  tabs: mockTabs,
  action: mockAction,
  scripting: mockScripting,
  permissions: mockPermissions,
};

class MockWebSocket {
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
  readyState: number = WebSocket.OPEN;

  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  send = vi.fn();
  close = vi.fn();
}

(global as any).WebSocket = vi.fn().mockImplementation(() => new MockWebSocket());

(global.WebSocket as any).CONNECTING = 0;
(global.WebSocket as any).OPEN = 1;
(global.WebSocket as any).CLOSING = 2;
(global.WebSocket as any).CLOSED = 3;

(global as any).fetch = vi.fn();

// Mock para el objeto document global
(global as any).document = {
  getElementById: vi.fn(),
  
  // Mock para createElement que soporta Shadow DOM
  createElement: vi.fn((tagName) => {
    // Crear un mock para el shadowRoot
    const shadowRoot = {
      innerHTML: '',
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      appendChild: vi.fn(),
    };
    
    // Crear un elemento mock con soporte para Shadow DOM
    const element = {
      tagName,
      id: '',
      style: { 
        display: '', 
        fontSize: '', 
        marginTop: '', 
        color: '' 
      },
      appendChild: vi.fn(),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      addEventListener: vi.fn(),
      hasAttribute: vi.fn().mockReturnValue(false),
      getAttribute: vi.fn().mockReturnValue(null),
      
      // Método para crear un Shadow DOM
      attachShadow: vi.fn(() => shadowRoot),
      
      // Propiedad shadowRoot pre-configurada
      shadowRoot: shadowRoot,
    };
    
    return element;
  }),
  
  querySelector: vi.fn(),
  querySelectorAll: vi.fn(() => []),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  
  // Mock para el body del documento
  body: {
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    contains: vi.fn(() => true),
  },
};
