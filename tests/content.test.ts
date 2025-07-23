import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockStorage, mockRuntime } from './setup';
import * as fs from 'fs';
import * as path from 'path';

vi.mock('../src/modules/common/utils/logger');

describe('Content Script Structure', () => {
  test('should have proper encapsulation pattern', () => {
    const contentScript = fs.readFileSync(
      path.join(__dirname, '../src/modules/content/content.ts'),
      'utf8'
    );

    expect(contentScript).toContain('BitbucketMergeController');
    expect(contentScript).toContain('(() => {');
    expect(contentScript).toContain('let mergeButtonObserver: MutationObserver | null = null;');

    expect(contentScript).not.toMatch(/^let mergeButtonObserver/m);
    expect(contentScript).not.toMatch(/^var mergeButtonObserver/m);
  });

  test('should initialize the controller', () => {
    const contentScript = fs.readFileSync(
      path.join(__dirname, '../src/modules/content/content.ts'),
      'utf8'
    );

    expect(contentScript).toContain('BitbucketMergeController.init()');
  });

  test('should have all required functions encapsulated', () => {
    const contentScript = fs.readFileSync(
      path.join(__dirname, '../src/modules/content/content.ts'),
      'utf8'
    );

    expect(contentScript).toContain('function disableMergeButton');
    expect(contentScript).toContain('function enableMergeButton');
    expect(contentScript).toContain('function applyMergeButtonLogic');
    expect(contentScript).toContain('function observeMergeButton');
    expect(contentScript).toContain('function handleRuntimeMessage');
  });
});

describe('Content Script Initialization', () => {
  interface MockMergeButton {
    style: Record<string, any>;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
    _customMergeHandler?: (() => void) | null;
  }

  // Mock document
  (global as any).document = {
    querySelector: vi.fn(),
    body: {},
  };

  // Mock MutationObserver
  (global as any).MutationObserver = vi.fn(function (this: any, callback: Function) {
    this.observe = vi.fn();
    this.disconnect = vi.fn();
    this.callback = callback;
  });

  beforeEach(() => {
    vi.resetAllMocks();

    mockStorage.sync.get.mockResolvedValue({
      mergeButtonSelector: '.test-merge-button',
    });

    mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
      callback({
        lastKnownMergeState: {
          mergeStatus: 'allowed',
          channelName: 'test-channel',
        },
        featureEnabled: true,
      });
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('should send bitbucketTabLoaded message on init', async () => {
    await import('../src/modules/content');

    expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
      action: 'bitbucketTabLoaded',
    });
  });

  test('should set up message listener on init', async () => {
    await import('../src/modules/content');

    expect(mockRuntime.onMessage.addListener).toHaveBeenCalled();
  });

  test('should observe for merge button on init', async () => {
    await import('../src/modules/content');

    expect((global as any).MutationObserver).toHaveBeenCalled();
    const observer = (global as any).MutationObserver.mock.instances[0];
    expect(observer.observe).toHaveBeenCalledWith(
      document.body,
      expect.objectContaining({
        childList: true,
        subtree: true,
      })
    );
  });

  test('should apply initial merge state when merge button is found', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    await import('../src/modules/content');

    const observer = (global as any).MutationObserver.mock.instances[0];
    observer.callback([], observer);

    expect(observer.disconnect).toHaveBeenCalled();
    expect(mockStorage.local.get).toHaveBeenCalledWith(
      ['lastKnownMergeState', 'featureEnabled'],
      expect.any(Function)
    );
  });

  test('should use default merge button selector when custom selector is not provided', async () => {
    mockStorage.sync.get.mockResolvedValue({});

    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    (document.querySelector as jest.Mock)
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(mockMergeButton);

    await import('../src/modules/content');

    const observer = (global as any).MutationObserver.mock.instances[0];
    observer.callback([], observer);

    expect(document.querySelector).toHaveBeenCalledWith('.merge-button-container > .merge-button');
  });
});

describe('Content Script Message Handling', () => {
  interface MockMergeButton {
    style: Record<string, any>;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
    _customMergeHandler?: (() => void) | null;
  }

  // Mock document
  (global as any).document = {
    querySelector: vi.fn(),
    body: {},
  };

  // Mock alert and confirm
  (global as any).alert = vi.fn();
  (global as any).confirm = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    mockStorage.sync.get.mockResolvedValue({
      mergeButtonSelector: '.test-merge-button',
    });

    (global as any).confirm.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('should ignore non-updateMergeButton messages', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    await import('../src/modules/content');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'someOtherAction',
      data: 'test',
    });

    expect(document.querySelector).not.toHaveBeenCalled();
  });

  test('should skip removing event listener if not present', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      _customMergeHandler: null,
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    await import('../src/modules/content');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      payload: {
        featureEnabled: true,
        mergeStatus: 'allowed',
        channelName: 'test-channel',
      },
    });

    expect(mockMergeButton.removeEventListener).not.toHaveBeenCalled();
  });

  test('should handle updateMergeButton message with disallowed status', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    await import('../src/modules/content');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      payload: {
        featureEnabled: true,
        mergeStatus: 'disallowed',
        channelName: 'test-channel',
      },
    });
  });

  test('should handle updateMergeButton message with exception status', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    await import('../src/modules/content');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      payload: {
        featureEnabled: true,
        mergeStatus: 'exception',
        channelName: 'test-channel',
      },
    });
  });

  test('should handle updateMergeButton message with allowed status', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      _customMergeHandler: () => {},
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    await import('../src/modules/content');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      payload: {
        featureEnabled: true,
        mergeStatus: 'allowed',
        channelName: 'test-channel',
      },
    });
  });

  test('should handle updateMergeButton message with feature disabled', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    await import('../src/modules/content');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      payload: {
        featureEnabled: false,
        mergeStatus: 'disallowed',
        channelName: 'test-channel',
      },
    });
  });

  test('should do nothing when merge button is not found', async () => {
    (document.querySelector as jest.Mock).mockReturnValueOnce(null);

    await import('../src/modules/content');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      payload: {
        featureEnabled: true,
        mergeStatus: 'disallowed',
        channelName: 'test-channel',
      },
    });
  });
});

describe('Initial Merge State Application', () => {
  interface MockMergeButton {
    style: Record<string, any>;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
    _customMergeHandler?: (() => void) | null;
  }

  // Mock document
  (global as any).document = {
    querySelector: vi.fn(),
    body: {},
  };

  // Mock MutationObserver
  (global as any).MutationObserver = vi.fn(function (this: any, callback: Function) {
    this.observe = vi.fn();
    this.disconnect = vi.fn();
    this.callback = callback;
  });

  beforeEach(() => {
    vi.resetAllMocks();

    mockStorage.sync.get.mockResolvedValue({
      mergeButtonSelector: '.test-merge-button',
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('should do nothing when no lastKnownMergeState exists', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
      callback({
        featureEnabled: true,
      });
    });

    await import('../src/modules/content');

    const observer = (global as any).MutationObserver.mock.instances[0];
    observer.callback([], observer);

    expect(mockMergeButton.addEventListener).not.toHaveBeenCalled();
    expect(mockMergeButton.removeEventListener).not.toHaveBeenCalled();
  });

  test('should apply disallowed state from storage', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
      callback({
        lastKnownMergeState: {
          mergeStatus: 'disallowed',
          channelName: 'test-channel',
        },
        featureEnabled: true,
      });
    });

    await import('../src/modules/content');

    const observer = (global as any).MutationObserver.mock.instances[0];
    observer.callback([], observer);
  });

  test('should apply exception state from storage', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
      callback({
        lastKnownMergeState: {
          mergeStatus: 'exception',
          channelName: 'test-channel',
        },
        featureEnabled: true,
      });
    });

    await import('../src/modules/content');

    const observer = (global as any).MutationObserver.mock.instances[0];
    observer.callback([], observer);
  });

  test('should apply allowed state from storage', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      _customMergeHandler: () => {},
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
      callback({
        lastKnownMergeState: {
          mergeStatus: 'allowed',
          channelName: 'test-channel',
        },
        featureEnabled: true,
      });
    });

    await import('../src/modules/content');

    const observer = (global as any).MutationObserver.mock.instances[0];
    observer.callback([], observer);
  });

  test('should override merge state when feature is disabled', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    mockStorage.local.get.mockImplementation((keys: string[], callback: Function) => {
      callback({
        lastKnownMergeState: {
          mergeStatus: 'disallowed',
          channelName: 'test-channel',
        },
        featureEnabled: false,
      });
    });

    await import('../src/modules/content');

    const observer = (global as any).MutationObserver.mock.instances[0];
    observer.callback([], observer);
  });
});

describe('Merge Button Event Handlers', () => {
  interface MockMergeButton {
    style: Record<string, any>;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
    _customMergeHandler?: (() => void) | null;
  }

  // Mock document
  (global as any).document = {
    querySelector: vi.fn(),
    body: {},
  };

  // Mock alert and confirm
  (global as any).alert = vi.fn();
  (global as any).confirm = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    mockStorage.sync.get.mockResolvedValue({
      mergeButtonSelector: '.test-merge-button',
    });

    (global as any).confirm.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('should create event handler for disallowed status', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      _customMergeHandler: null,
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    await import('../src/modules/content');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      payload: {
        featureEnabled: true,
        mergeStatus: 'disallowed',
        channelName: 'test-channel',
      },
    });
  });

  test('should create event handler for exception status', async () => {
    const mockMergeButton: MockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      _customMergeHandler: null,
    };
    (document.querySelector as jest.Mock).mockReturnValue(mockMergeButton);

    await import('../src/modules/content');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      payload: {
        featureEnabled: true,
        mergeStatus: 'exception',
        channelName: 'test-channel',
      },
    });
  });
});
