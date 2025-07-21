import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { mockStorage, mockRuntime } from './setup.js';

vi.mock('../src/utils/logger.js');

describe('Content Script Structure', () => {
  test('should have proper encapsulation pattern', () => {
    // Read the content script file to verify structure
    const fs = require('fs');
    const path = require('path');
    const contentScript = fs.readFileSync(
      path.join(__dirname, '../src/content.js'),
      'utf8',
    );

    // Verify that the script uses encapsulation pattern
    expect(contentScript).toContain('BitbucketMergeController');
    expect(contentScript).toContain('(() => {');
    expect(contentScript).toContain('let mergeButtonObserver = null;');

    // Verify that mergeButtonObserver is not a global variable
    expect(contentScript).not.toMatch(/^let mergeButtonObserver/m);
    expect(contentScript).not.toMatch(/^var mergeButtonObserver/m);
  });

  test('should initialize the controller', () => {
    const fs = require('fs');
    const path = require('path');
    const contentScript = fs.readFileSync(
      path.join(__dirname, '../src/content.js'),
      'utf8',
    );

    // Verify that the controller is initialized
    expect(contentScript).toContain('BitbucketMergeController.init()');
  });

  test('should have all required functions encapsulated', () => {
    const fs = require('fs');
    const path = require('path');
    const contentScript = fs.readFileSync(
      path.join(__dirname, '../src/content.js'),
      'utf8',
    );

    // Verify that key functions are present and encapsulated
    expect(contentScript).toContain('function disableMergeButton');
    expect(contentScript).toContain('function enableMergeButton');
    expect(contentScript).toContain('function applyMergeButtonLogic');
    expect(contentScript).toContain('function observeMergeButton');
    expect(contentScript).toContain('function handleRuntimeMessage');
  });
});

describe('Content Script Initialization', () => {
  // Mock para document
  global.document = {
    querySelector: vi.fn(),
    body: {},
  };

  // Mock para MutationObserver
  global.MutationObserver = vi.fn(function (callback) {
    this.observe = vi.fn();
    this.disconnect = vi.fn();
    this.callback = callback;
  });

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Setup storage mocks
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
    // Import the module to trigger init
    await import('../src/content.js');

    expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
      action: 'bitbucketTabLoaded',
    });
  });

  test('should set up message listener on init', async () => {
    // Import the module to trigger init
    await import('../src/content.js');

    expect(mockRuntime.onMessage.addListener).toHaveBeenCalled();
  });

  test('should observe for merge button on init', async () => {
    // Import the module to trigger init
    await import('../src/content.js');

    expect(global.MutationObserver).toHaveBeenCalled();
    const observer = global.MutationObserver.mock.instances[0];
    expect(observer.observe).toHaveBeenCalledWith(
      document.body,
      expect.objectContaining({
        childList: true,
        subtree: true,
      }),
    );
  });

  test('should apply initial merge state when merge button is found', async () => {
    // Setup mock merge button
    const mockMergeButton = {
      style: {},
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    document.querySelector.mockReturnValue(mockMergeButton);

    // Import the module to trigger init
    await import('../src/content.js');

    // Simulate MutationObserver callback finding the merge button
    const observer = global.MutationObserver.mock.instances[0];
    observer.callback([], observer);

    expect(observer.disconnect).toHaveBeenCalled();
    expect(mockStorage.local.get).toHaveBeenCalledWith(
      ['lastKnownMergeState', 'featureEnabled'],
      expect.any(Function),
    );
  });
});

describe('Content Script Message Handling', () => {
  // Mock para document.querySelector
  const mockMergeButton = {
    style: {},
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    _customMergeHandler: null,
  };

  // Mock para document
  global.document = {
    querySelector: vi.fn(() => mockMergeButton),
    body: {},
  };

  // Mock para alert y confirm
  global.alert = vi.fn();
  global.confirm = vi.fn();

  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();

    // Reset merge button mock
    mockMergeButton.style = {};
    mockMergeButton._customMergeHandler = null;
    mockMergeButton.addEventListener.mockClear();
    mockMergeButton.removeEventListener.mockClear();

    // Setup storage mocks
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

    // Default confirm to return true
    global.confirm.mockReturnValue(true);
  });

  afterEach(() => {
    vi.resetModules();
  });

  test('should do nothing when merge button is not found', async () => {
    // Mock document.querySelector to return null for this test
    document.querySelector.mockReturnValueOnce(null);

    // Import the module to trigger init
    await import('../src/content.js');

    // Get the message handler
    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    // Call the handler
    messageHandler({
      action: 'updateMergeButton',
      featureEnabled: true,
      mergeStatus: 'disallowed',
      channelName: 'test-channel',
    });

    // Verify no changes were made to the button
    expect(mockMergeButton.addEventListener).not.toHaveBeenCalled();
  });

  test('should ignore non-updateMergeButton messages', async () => {
    // Import the module to trigger init
    await import('../src/content.js');

    // Get the message handler
    const messageHandler = mockRuntime.onMessage.addListener.mock.calls[0][0];

    // Call the handler with a different action
    messageHandler({
      action: 'someOtherAction',
      data: 'test',
    });

    // Verify no changes were made to the button
    expect(mockMergeButton.addEventListener).not.toHaveBeenCalled();
    expect(mockMergeButton.removeEventListener).not.toHaveBeenCalled();
  });
});
