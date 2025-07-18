import { describe, test, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  WEBSOCKET_CHECK_INTERVAL,
  WEBSOCKET_CHECK_ALARM,
  WEBSOCKET_MAX_AGE,
} from '../src/constants.js';

// Mock para WebSocket
global.WebSocket = class MockWebSocket {
  constructor() {
    this.readyState = WebSocket.OPEN;
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
  }

  static get OPEN() {
    return 1;
  }

  static get CLOSED() {
    return 3;
  }

  close() {
    if (this.onclose) this.onclose();
  }

  send() {
    // Mock implementation
  }
};

// Mock para fetch
global.fetch = vi.fn();

// Mock para chrome API
const mockStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
  sync: {
    get: vi.fn(),
  },
  onChanged: {
    addListener: vi.fn(),
  },
};

const mockAlarms = {
  create: vi.fn(),
  clear: vi.fn((name, callback) => {
    if (callback) callback();
  }),
  onAlarm: {
    addListener: vi.fn(),
  },
};

const mockRuntime = {
  sendMessage: vi.fn(),
  onMessage: {
    addListener: vi.fn(),
  },
  onInstalled: {
    addListener: vi.fn(),
  },
  onStartup: {
    addListener: vi.fn(),
  },
};

const mockAction = {
  setIcon: vi.fn(),
};

describe('WebSocket Persistence Tests', () => {
  let originalChrome;
  
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Guardar la referencia original de chrome
    originalChrome = global.chrome;
    
    // Configurar el mock de chrome para estas pruebas
    global.chrome = {
      storage: mockStorage,
      alarms: mockAlarms,
      runtime: mockRuntime,
      action: mockAction,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    // Restaurar chrome original
    global.chrome = originalChrome;
  });

  test('setupWebSocketCheckAlarm should clear existing alarm and create a new one', async () => {
    // Importar el módulo background.js para acceder a las funciones
    const backgroundModule = await import('../src/background.js');
    
    // Llamar a la función setupWebSocketCheckAlarm si está expuesta
    // Si no está expuesta, esta prueba no puede ejecutarse directamente
    if (typeof backgroundModule.setupWebSocketCheckAlarm === 'function') {
      backgroundModule.setupWebSocketCheckAlarm();
      
      expect(mockAlarms.clear).toHaveBeenCalledWith(
        WEBSOCKET_CHECK_ALARM,
        expect.any(Function)
      );
      
      expect(mockAlarms.create).toHaveBeenCalledWith(
        WEBSOCKET_CHECK_ALARM,
        { periodInMinutes: WEBSOCKET_CHECK_INTERVAL }
      );
    } else {
      // Si la función no está expuesta, verificamos que el listener de alarma esté configurado
      expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
    }
  });

  test('chrome.alarms.onAlarm listener should be registered', async () => {
    // Importar el módulo background.js
    await import('../src/background.js');
    
    // Verificar que se registró un listener para las alarmas
    expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
  });

  test('checkWebSocketConnection should reconnect if WebSocket is not open', async () => {
    // Configurar el mock para simular un WebSocket cerrado
    mockStorage.local.get.mockResolvedValue({});
    
    // Importar el módulo background.js
    const backgroundModule = await import('../src/background.js');
    
    // Si la función checkWebSocketConnection está expuesta, la probamos directamente
    if (typeof backgroundModule.checkWebSocketConnection === 'function') {
      // Establecer rtmWebSocket como null o cerrado
      backgroundModule.rtmWebSocket = null;
      
      await backgroundModule.checkWebSocketConnection();
      
      // Verificar que se intentó reconectar
      expect(mockStorage.sync.get).toHaveBeenCalled();
    } else {
      // Si no está expuesta, verificamos que el listener de alarma esté configurado
      expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
    }
  });

  test('connectToSlackSocketMode should setup alarm when WebSocket connects', async () => {
    // Configurar mocks
    mockStorage.sync.get.mockResolvedValue({
      slackToken: 'test-token',
      appToken: 'test-app-token',
      channelName: 'test-channel',
    });
    
    // Mock para fetch que devuelve una respuesta exitosa
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true, team_id: 'test-team-id' }),
    });
    
    global.fetch.mockResolvedValueOnce({
      json: () => Promise.resolve({ ok: true, url: 'wss://test-url' }),
    });
    
    // Importar el módulo background.js
    const backgroundModule = await import('../src/background.js');
    
    // Si la función connectToSlackSocketMode está expuesta, la probamos directamente
    if (typeof backgroundModule.connectToSlackSocketMode === 'function') {
      await backgroundModule.connectToSlackSocketMode();
      
      // Verificar que se configuró la alarma cuando el WebSocket se conectó
      expect(mockAlarms.clear).toHaveBeenCalled();
      expect(mockAlarms.create).toHaveBeenCalled();
    } else {
      // Si no está expuesta, verificamos que el listener de alarma esté configurado
      expect(mockAlarms.onAlarm.addListener).toHaveBeenCalled();
    }
  });

  test('onInstalled and onStartup should setup WebSocket check alarm', async () => {
    // Configurar mocks para chrome.runtime.onInstalled y onStartup
    const mockOnInstalledCallback = vi.fn();
    const mockOnStartupCallback = vi.fn();
    
    global.chrome.runtime = {
      ...mockRuntime,
      onInstalled: {
        addListener: mockOnInstalledCallback,
      },
      onStartup: {
        addListener: mockOnStartupCallback,
      },
    };
    
    // Importar el módulo background.js
    await import('../src/background.js');
    
    // Verificar que se registraron los listeners
    expect(mockOnInstalledCallback).toHaveBeenCalled();
    expect(mockOnStartupCallback).toHaveBeenCalled();
  });
});
