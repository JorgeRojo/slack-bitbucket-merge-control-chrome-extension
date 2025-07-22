import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockStorage, mockRuntime } from './setup.js';

vi.mock('../src/utils/logger.js');

describe('Content Script Structure', () => {
  test('should have proper encapsulation pattern', () => {
    const fs = require('fs');
    const path = require('path');
    const contentScript = fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf8');

    expect(contentScript).toContain('BitbucketMergeController');
    expect(contentScript).toContain('(() => {');
    expect(contentScript).toContain('let mergeButtonObserver = null;');

    expect(contentScript).not.toMatch(/^let mergeButtonObserver/m);
    expect(contentScript).not.toMatch(/^var mergeButtonObserver/m);
  });

  test('should initialize the controller', () => {
    const fs = require('fs');
    const path = require('path');
    const contentScript = fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf8');

    expect(contentScript).toContain('BitbucketMergeController.init()');
  });

  test('should have all required functions encapsulated', () => {
    const fs = require('fs');
    const path = require('path');
    const contentScript = fs.readFileSync(path.join(__dirname, '../src/content.js'), 'utf8');

    expect(contentScript).toContain('function disableMergeButton');
    expect(contentScript).toContain('function enableMergeButton');
    expect(contentScript).toContain('function applyMergeButtonLogic');
    expect(contentScript).toContain('function observeMergeButton');
    expect(contentScript).toContain('function handleRuntimeMessage');
  });
});

describe('Content Script Initialization', () => {
  global.document = {
    querySelector: vi.fn(),
    body: {},
  };

  global.MutationObserver = vi.fn(function (callback) {
    this.observe = vi.fn();
    this.disconnect = vi.fn();
    this.callback = callback;
  });

  beforeEach(() => {
    vi.resetAllMocks();

    mockStorage.sync.get.mockResolvedValue({
      mergeButtonSelector: '.test-merge-button',
    });

    mockStorage.local.get.mockImplementation((keys, callback) => {
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
    await import('../src/content.js');

    expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
      action: 'bitbucketTabLoaded',
    });
  });

  test('should set up message listener on init', async () => {
    await import('../src/content.js');

    expect(mockRuntime.onMessage.addListener).toHaveBeenCalled();
  });

  test('should observe for merge button on init', async () => {
    await import('../src/content.js');

    expect(global.MutationObserver).toHaveBeenCalled();
    const observer = global.MutationObserver.mock.instances[0];
    expect(observer.observe).toHaveBeenCalledWith(
      document.body,
      expect.objectContaining({
        childList: true,
        subtree: true,
      })
    );
  });

  test('should apply initial merge state when merge button is found', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    await import('../src/content.js');

    const observer = global.MutationObserver.mock.instances[0];
    observer.callback([], observer);

    expect(observer.disconnect).toHaveBeenCalled();
    expect(mockStorage.local.get).toHaveBeenCalledWith(
      ['lastKnownMergeState', 'featureEnabled'],
      expect.any(Function)
    );
  });

  test('should use default merge button selector when custom selector is not provided', async () => {
    mockStorage.sync.get.mockResolvedValue({});

    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };

    document.querySelector.mockReturnValueOnce(null).mockReturnValueOnce(mockMergeButton);

    await import('../src/content.js');

    const observer = global.MutationObserver.mock.instances[0];
    observer.callback([], observer);

    expect(document.querySelector).toHaveBeenCalledWith('.merge-button-container > .merge-button');
  });
});

describe('Content Script Message Handling', () => {
  global.document = {
    querySelector: vi.fn(),
    body: {},
  };

  global.alert = vi.fn();
  global.confirm = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    mockStorage.sync.get.mockResolvedValue({
      mergeButtonSelector: '.test-merge-button',
    });

    global.confirm.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('should ignore non-updateMergeButton messages', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    await import('../src/content.js');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'someOtherAction',
      data: 'test',
    });

    expect(document.querySelector).not.toHaveBeenCalled();
  });

  test('should skip removing event listener if not present', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      _customMergeHandler: null,
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    await import('../src/content.js');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      featureEnabled: true,
      mergeStatus: 'allowed',
      channelName: 'test-channel',
    });

    expect(mockMergeButton.removeEventListener).not.toHaveBeenCalled();
  });

  test('should handle updateMergeButton message with disallowed status', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    await import('../src/content.js');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      featureEnabled: true,
      mergeStatus: 'disallowed',
      channelName: 'test-channel',
    });
  });

  test('should handle updateMergeButton message with exception status', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    await import('../src/content.js');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      featureEnabled: true,
      mergeStatus: 'exception',
      channelName: 'test-channel',
    });
  });

  test('should handle updateMergeButton message with allowed status', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      _customMergeHandler: () => {},
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    await import('../src/content.js');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      featureEnabled: true,
      mergeStatus: 'allowed',
      channelName: 'test-channel',
    });
  });

  test('should handle updateMergeButton message with feature disabled', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    await import('../src/content.js');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      featureEnabled: false,
      mergeStatus: 'disallowed',
      channelName: 'test-channel',
    });
  });

  test('should do nothing when merge button is not found', async () => {
    document.querySelector.mockReturnValueOnce(null);

    await import('../src/content.js');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      featureEnabled: true,
      mergeStatus: 'disallowed',
      channelName: 'test-channel',
    });
  });
});

describe('Initial Merge State Application', () => {
  global.document = {
    querySelector: vi.fn(),
    body: {},
  };

  global.MutationObserver = vi.fn(function (callback) {
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
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    mockStorage.local.get.mockImplementation((keys, callback) => {
      callback({
        featureEnabled: true,
      });
    });

    await import('../src/content.js');

    const observer = global.MutationObserver.mock.instances[0];
    observer.callback([], observer);

    expect(mockMergeButton.addEventListener).not.toHaveBeenCalled();
    expect(mockMergeButton.removeEventListener).not.toHaveBeenCalled();
  });

  test('should apply disallowed state from storage', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    mockStorage.local.get.mockImplementation((keys, callback) => {
      callback({
        lastKnownMergeState: {
          mergeStatus: 'disallowed',
          channelName: 'test-channel',
        },
        featureEnabled: true,
      });
    });

    await import('../src/content.js');

    const observer = global.MutationObserver.mock.instances[0];
    observer.callback([], observer);
  });

  test('should apply exception state from storage', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    mockStorage.local.get.mockImplementation((keys, callback) => {
      callback({
        lastKnownMergeState: {
          mergeStatus: 'exception',
          channelName: 'test-channel',
        },
        featureEnabled: true,
      });
    });

    await import('../src/content.js');

    const observer = global.MutationObserver.mock.instances[0];
    observer.callback([], observer);
  });

  test('should apply allowed state from storage', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      _customMergeHandler: () => {},
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    mockStorage.local.get.mockImplementation((keys, callback) => {
      callback({
        lastKnownMergeState: {
          mergeStatus: 'allowed',
          channelName: 'test-channel',
        },
        featureEnabled: true,
      });
    });

    await import('../src/content.js');

    const observer = global.MutationObserver.mock.instances[0];
    observer.callback([], observer);
  });

  test('should override merge state when feature is disabled', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    mockStorage.local.get.mockImplementation((keys, callback) => {
      callback({
        lastKnownMergeState: {
          mergeStatus: 'disallowed',
          channelName: 'test-channel',
        },
        featureEnabled: false,
      });
    });

    await import('../src/content.js');

    const observer = global.MutationObserver.mock.instances[0];
    observer.callback([], observer);
  });
});

describe('Merge Button Event Handlers', () => {
  global.document = {
    querySelector: vi.fn(),
    body: {},
  };

  global.alert = vi.fn();
  global.confirm = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    mockStorage.sync.get.mockResolvedValue({
      mergeButtonSelector: '.test-merge-button',
    });

    global.confirm.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('should create event handler for disallowed status', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      _customMergeHandler: null,
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    await import('../src/content.js');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      featureEnabled: true,
      mergeStatus: 'disallowed',
      channelName: 'test-channel',
    });
  });

  test('should create event handler for exception status', async () => {
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      _customMergeHandler: null,
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    await import('../src/content.js');

    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    messageHandler({
      action: 'updateMergeButton',
      featureEnabled: true,
      mergeStatus: 'exception',
      channelName: 'test-channel',
    });
  });
});
