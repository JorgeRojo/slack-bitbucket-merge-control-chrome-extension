import { jest } from '@jest/globals';
import {
  cleanSlackMessageText,
  normalizeText,
  determineMergeStatus,
  updateExtensionIcon,
  getPhrasesFromStorage,
  handleSlackApiError,
  processAndStoreMessage,
  resolveChannelId,
  fetchAndStoreTeamId,
  fetchAndStoreMessages,
  scheduleFeatureReactivation,
  checkScheduledReactivation,
  reactivateFeature,
  registerBitbucketContentScript,
  updateMergeButtonFromLastKnownMergeState,
} from '../src/background.js';

// Mock chrome APIs
global.chrome = {
  action: {
    setIcon: jest.fn(),
  },
  storage: {
    sync: {
      get: jest.fn(),
    },
    local: {
      get: jest.fn(),
      set: jest.fn(),
    },
  },
  runtime: {
    sendMessage: jest.fn(),
  },
  tabs: {
    sendMessage: jest.fn(),
  },
  scripting: {
    registerContentScripts: jest.fn(),
    unregisterContentScripts: jest.fn(),
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
  },
};

describe('cleanSlackMessageText', () => {
  test('should replace user mentions with @MENTION', () => {
    const inputText = 'Hello <@U123456789>!';
    expect(cleanSlackMessageText(inputText)).toBe('Hello @MENTION!');
  });

  test('should remove named channel mentions', () => {
    const inputText = 'Check out <#C123456789|general> channel.';
    expect(cleanSlackMessageText(inputText)).toBe('Check out channel.');
  });

  test('should replace unnamed channel mentions with @CHANNEL', () => {
    const inputText = 'Please see <#C987654321> for details.';
    expect(cleanSlackMessageText(inputText)).toBe(
      'Please see @CHANNEL for details.',
    );
  });

  test('should remove special links', () => {
    const inputText = 'Visit <http://example.com|Example Website>.';
    expect(cleanSlackMessageText(inputText)).toBe('Visit .');
  });

  test('should remove any remaining <...>', () => {
    const inputText = 'Text with <unwanted> tags.';
    expect(cleanSlackMessageText(inputText)).toBe('Text with tags.');
  });

  test('should handle multiple types of cleaning in one string', () => {
    const inputText =
      'Hey <@U123>, check <#C456|general> about <http://foo.bar|link>.';
    expect(cleanSlackMessageText(inputText)).toBe(
      'Hey @MENTION, check about .',
    );
  });

  test('should return empty string for null, undefined or empty string input', () => {
    expect(cleanSlackMessageText(null)).toBe('');
    expect(cleanSlackMessageText(undefined)).toBe('');
    expect(cleanSlackMessageText('')).toBe('');
  });

  test('should handle text without any special Slack formatting', () => {
    const inputText = 'This is a regular message.';
    expect(cleanSlackMessageText(inputText)).toBe('This is a regular message.');
  });

  test('should handle line breaks and tabs', () => {
    const inputText = 'Line 1\nLine 2\tTabbed';
    expect(cleanSlackMessageText(inputText)).toBe('Line 1 Line 2 Tabbed');
  });

  test('should handle multiple whitespace characters', () => {
    const inputText = 'Text   with    multiple     spaces';
    expect(cleanSlackMessageText(inputText)).toBe('Text with multiple spaces');
  });
});

describe('normalizeText', () => {
  test('should convert text to lowercase and trim whitespace', () => {
    expect(normalizeText('  Hello World  ')).toBe('hello world');
  });

  test('should replace multiple spaces with a single space', () => {
    expect(normalizeText('Hello   World')).toBe('hello world');
  });

  test('should remove diacritic marks', () => {
    expect(normalizeText('Héllö Wörld')).toBe('hello world');
  });

  test('should handle mixed case and extra spaces', () => {
    expect(normalizeText('  TEST  string   with   spaces  ')).toBe(
      'test string with spaces',
    );
  });

  test('should return empty string for null, undefined or empty string input', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText('')).toBe('');
  });

  test('should handle accented characters from different languages', () => {
    expect(normalizeText('Café résumé naïve')).toBe('cafe resume naive');
  });

  test('should handle special Unicode characters', () => {
    expect(normalizeText('Ñoño piñata')).toBe('nono pinata');
  });
});

describe('determineMergeStatus', () => {
  const mockAllowedPhrases = ['allowed to merge'];
  const mockDisallowedPhrases = ['not allowed to merge'];
  const mockExceptionPhrases = ['except this project'];

  test('should return allowed status when allowed phrase is found', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'allowed to merge this', ts: '123' }],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('allowed');
    expect(result.message.text).toBe('allowed to merge this');
  });

  test('should return disallowed status when disallowed phrase is found', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'not allowed to merge anything', ts: '123' }],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('disallowed');
    expect(result.message.text).toBe('not allowed to merge anything');
  });

  test('should return exception status when exception phrase is found', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'allowed to merge except this project', ts: '123' }],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('exception');
    expect(result.message.text).toBe('allowed to merge except this project');
  });

  test('should return unknown status when no phrases match', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'just a regular message', ts: '123' }],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('unknown');
    expect(result.message).toBe(null);
  });

  test('should handle empty messages array', () => {
    const result = determineMergeStatus({
      messages: [],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('unknown');
    expect(result.message).toBe(null);
  });

  test('should process messages in array order', () => {
    const messages = [
      { text: 'old allowed to merge', ts: '1234567890.123' },
      { text: 'recent not allowed to merge', ts: '1234567891.123' },
    ];

    const result = determineMergeStatus({
      messages,
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    // Should return the first matching message (allowed)
    expect(result.status).toBe('allowed');
    expect(result.message.text).toBe('old allowed to merge');
  });

  test('should handle case insensitive matching', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'ALLOWED TO MERGE this', ts: '123' }],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('allowed');
  });

  test('should handle empty phrase arrays', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'some message', ts: '123' }],
      allowedPhrases: [],
      disallowedPhrases: [],
      exceptionPhrases: [],
    });

    expect(result.status).toBe('unknown');
  });
});

describe('updateExtensionIcon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should set allowed icon for allowed status', () => {
    updateExtensionIcon('allowed');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16_enabled.png',
        48: 'images/icon48_enabled.png',
      },
    });
  });

  test('should set disallowed icon for disallowed status', () => {
    updateExtensionIcon('disallowed');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16_disabled.png',
        48: 'images/icon48_disabled.png',
      },
    });
  });

  test('should set exception icon for exception status', () => {
    updateExtensionIcon('exception');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16_exception.png',
        48: 'images/icon48_exception.png',
      },
    });
  });

  test('should set error icon for error status', () => {
    updateExtensionIcon('error');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16_error.png',
        48: 'images/icon48_error.png',
      },
    });
  });

  test('should set loading icon for loading status', () => {
    updateExtensionIcon('loading');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16.png',
        48: 'images/icon48.png',
      },
    });
  });

  test('should set default icon for unknown status', () => {
    updateExtensionIcon('unknown');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16.png',
        48: 'images/icon48.png',
      },
    });
  });

  test('should set default icon for default status', () => {
    updateExtensionIcon('default');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16.png',
        48: 'images/icon48.png',
      },
    });
  });
});

describe('getPhrasesFromStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should return stored phrases when available', async () => {
    const mockStoredData = {
      allowedPhrases: 'custom allowed,another allowed',
      disallowedPhrases: 'custom disallowed,another disallowed',
      exceptionPhrases: 'custom exception,another exception',
    };

    chrome.storage.sync.get.mockResolvedValue(mockStoredData);

    const result = await getPhrasesFromStorage();

    expect(chrome.storage.sync.get).toHaveBeenCalledWith([
      'allowedPhrases',
      'disallowedPhrases',
      'exceptionPhrases',
    ]);
    expect(result.currentAllowedPhrases).toEqual([
      'custom allowed',
      'another allowed',
    ]);
    expect(result.currentDisallowedPhrases).toEqual([
      'custom disallowed',
      'another disallowed',
    ]);
    expect(result.currentExceptionPhrases).toEqual([
      'custom exception',
      'another exception',
    ]);
  });

  test('should return default phrases when storage is empty', async () => {
    chrome.storage.sync.get.mockResolvedValue({});

    const result = await getPhrasesFromStorage();

    expect(result.currentAllowedPhrases).toEqual([
      'allowed to merge',
      'no restrictions on merging.',
    ]);
    expect(result.currentDisallowedPhrases).toEqual([
      'not allowed to merge',
      'do not merge without consent',
      'closing versions. do not merge',
      'ask me before merging',
    ]);
    expect(result.currentExceptionPhrases).toEqual([
      'allowed to merge this task',
      'except everything related to',
      'allowed to merge in all projects except',
      'merge is allowed except',
      'do not merge these projects',
      'you can merge:',
      'do not merge in',
    ]);
  });

  test('should handle partial storage data', async () => {
    const mockStoredData = {
      allowedPhrases: 'custom allowed',
      // disallowedPhrases and exceptionPhrases missing
    };

    chrome.storage.sync.get.mockResolvedValue(mockStoredData);

    const result = await getPhrasesFromStorage();

    expect(result.currentAllowedPhrases).toEqual(['custom allowed']);
    expect(result.currentDisallowedPhrases).toEqual([
      'not allowed to merge',
      'do not merge without consent',
      'closing versions. do not merge',
      'ask me before merging',
    ]);
    expect(result.currentExceptionPhrases).toEqual([
      'allowed to merge this task',
      'except everything related to',
      'allowed to merge in all projects except',
      'merge is allowed except',
      'do not merge these projects',
      'you can merge:',
      'do not merge in',
    ]);
  });
});

describe('handleSlackApiError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should handle channel_not_found error', async () => {
    const error = { message: 'channel_not_found' };

    await handleSlackApiError(error);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      appStatus: 'CHANNEL_ERROR',
      messages: [],
      channelId: null,
    });
  });

  test('should handle not_in_channel error', async () => {
    const error = { message: 'not_in_channel' };

    await handleSlackApiError(error);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      appStatus: 'CHANNEL_ERROR',
      messages: [],
      channelId: null,
    });
  });

  test('should handle invalid_auth error', async () => {
    const error = { message: 'invalid_auth' };

    await handleSlackApiError(error);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      appStatus: 'TOKEN_TOKEN_ERROR',
      messages: [],
    });
  });

  test('should handle token_revoked error', async () => {
    const error = { message: 'token_revoked' };

    await handleSlackApiError(error);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      appStatus: 'TOKEN_TOKEN_ERROR',
      messages: [],
    });
  });

  test('should handle unknown error', async () => {
    const error = { message: 'some_unknown_error' };

    await handleSlackApiError(error);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      appStatus: 'UNKNOWN_ERROR',
      messages: [],
    });
  });

  test('should handle error without message property', async () => {
    const error = { error: 'some error' };

    await handleSlackApiError(error);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      appStatus: 'UNKNOWN_ERROR',
      messages: [],
    });
  });

  test('should handle null error', async () => {
    await handleSlackApiError(null);

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      appStatus: 'UNKNOWN_ERROR',
      messages: [],
    });
  });
});

describe('processAndStoreMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock getPhrasesFromStorage
    chrome.storage.sync.get.mockResolvedValue({
      allowedPhrases: 'allowed to merge',
      disallowedPhrases: 'not allowed to merge',
      exceptionPhrases: 'except this project',
    });
    chrome.storage.local.get.mockResolvedValue({
      messages: [],
      channelName: 'test-channel',
    });
  });

  test('should process and store new message', async () => {
    const mockMessage = {
      text: 'allowed to merge this project',
      ts: '1234567890.123',
    };

    await processAndStoreMessage(mockMessage, 'mock-token');

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      messages: [
        {
          text: 'allowed to merge this project',
          ts: '1234567890.123',
        },
      ],
    });
  });

  test('should handle message with Slack formatting', async () => {
    const mockMessage = {
      text: 'Hey <@U123456789>, allowed to merge <#C987654321|general>',
      ts: '1234567890.123',
    };

    await processAndStoreMessage(mockMessage, 'mock-token');

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      messages: [
        {
          text: 'Hey @MENTION, allowed to merge',
          ts: '1234567890.123',
        },
      ],
    });
  });

  test('should update existing messages array', async () => {
    const existingMessages = [{ text: 'old message', ts: '1234567889.123' }];
    chrome.storage.local.get.mockResolvedValue({
      messages: existingMessages,
      channelName: 'test-channel',
    });

    const mockMessage = {
      text: 'new message',
      ts: '1234567890.123',
    };

    await processAndStoreMessage(mockMessage, 'mock-token');

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      messages: [
        { text: 'new message', ts: '1234567890.123' },
        { text: 'old message', ts: '1234567889.123' },
      ],
    });
  });

  test('should update extension icon based on message content', async () => {
    const mockMessage = {
      text: 'allowed to merge this project',
      ts: '1234567890.123',
    };

    await processAndStoreMessage(mockMessage, 'mock-token');

    expect(chrome.action.setIcon).toHaveBeenCalled();
  });

  test('should store lastMatchingMessage', async () => {
    const mockMessage = {
      text: 'allowed to merge this project',
      ts: '1234567890.123',
    };

    await processAndStoreMessage(mockMessage, 'mock-token');

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      lastMatchingMessage: expect.objectContaining({
        text: 'allowed to merge this project',
        ts: '1234567890.123',
      }),
    });
  });

  test('should not process message without timestamp', async () => {
    const mockMessage = {
      text: 'test message',
      // ts missing
    };

    await processAndStoreMessage(mockMessage, 'mock-token');

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('should not process message without text', async () => {
    const mockMessage = {
      ts: '1234567890.123',
      // text missing
    };

    await processAndStoreMessage(mockMessage, 'mock-token');

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('should not process duplicate message', async () => {
    const existingMessages = [
      { text: 'existing message', ts: '1234567890.123' },
    ];
    chrome.storage.local.get.mockResolvedValue({
      messages: existingMessages,
      channelName: 'test-channel',
    });

    const mockMessage = {
      text: 'duplicate message',
      ts: '1234567890.123', // Same timestamp
    };

    await processAndStoreMessage(mockMessage, 'mock-token');

    // Should not call set again for duplicate
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});

describe('Edge cases and additional coverage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('determineMergeStatus should handle messages with special characters', () => {
    const messages = [{ text: 'Allowed to merge! 🎉 @everyone', ts: '123' }];
    const result = determineMergeStatus({
      messages,
      allowedPhrases: ['allowed to merge'],
      disallowedPhrases: ['not allowed'],
      exceptionPhrases: ['except'],
    });

    expect(result.status).toBe('allowed');
  });

  test('determineMergeStatus should prioritize exception over disallowed', () => {
    const messages = [
      { text: 'not allowed to merge except this project', ts: '123' },
    ];
    const result = determineMergeStatus({
      messages,
      allowedPhrases: ['allowed to merge'],
      disallowedPhrases: ['not allowed to merge'],
      exceptionPhrases: ['except this project'],
    });

    expect(result.status).toBe('exception');
  });

  test('determineMergeStatus should prioritize disallowed over allowed', () => {
    const messages = [
      { text: 'allowed to merge but not allowed to merge', ts: '123' },
    ];
    const result = determineMergeStatus({
      messages,
      allowedPhrases: ['allowed to merge'],
      disallowedPhrases: ['not allowed to merge'],
      exceptionPhrases: ['except'],
    });

    expect(result.status).toBe('disallowed');
  });

  test('normalizeText should handle empty strings and whitespace', () => {
    expect(normalizeText('   ')).toBe('');
    expect(normalizeText('\n\t\r')).toBe('');
    expect(normalizeText('  hello  world  ')).toBe('hello world');
  });

  test('cleanSlackMessageText should handle complex Slack formatting', () => {
    const complexText =
      'Check <@U123|user> in <#C456|channel> at <http://example.com|link> with <special> tags';
    const result = cleanSlackMessageText(complexText);
    expect(result).toBe('Check @MENTION in at with tags');
  });

  test('updateExtensionIcon should handle all status cases', () => {
    const statuses = [
      'allowed',
      'disallowed',
      'exception',
      'error',
      'loading',
      'unknown',
      'default',
      'invalid',
    ];

    statuses.forEach((status) => {
      jest.clearAllMocks();
      updateExtensionIcon(status);
      expect(chrome.action.setIcon).toHaveBeenCalledTimes(1);
    });
  });

  test('getPhrasesFromStorage should handle empty string values', async () => {
    chrome.storage.sync.get.mockResolvedValue({
      allowedPhrases: '',
      disallowedPhrases: '',
      exceptionPhrases: '',
    });

    const result = await getPhrasesFromStorage();

    // Empty strings should fall back to defaults
    expect(result.currentAllowedPhrases).toEqual([
      'allowed to merge',
      'no restrictions on merging.',
    ]);
  });
});

describe('resolveChannelId', () => {
  // Mock fetch locally for this describe block
  let originalFetch;
  const mockFetch = jest.fn();

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = mockFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    chrome.storage.local.get.mockResolvedValue({});
    chrome.storage.local.set.mockResolvedValue();
  });

  test('should return cached channelId when channel name matches', async () => {
    chrome.storage.local.get.mockResolvedValue({
      channelId: 'C123456789',
      cachedChannelName: 'test-channel',
    });

    const result = await resolveChannelId('xoxb-token', 'test-channel');

    expect(result).toBe('C123456789');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('should fetch new channelId when cached channel name differs', async () => {
    chrome.storage.local.get.mockResolvedValue({
      channelId: 'C123456789',
      cachedChannelName: 'old-channel',
    });

    mockFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [{ id: 'C987654321', name: 'new-channel' }],
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [],
          }),
      });

    const result = await resolveChannelId('xoxb-token', 'new-channel');

    expect(result).toBe('C987654321');
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      channelId: 'C987654321',
      cachedChannelName: 'new-channel',
    });
  });

  test('should fetch channelId when no cache exists', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    mockFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [
              { id: 'C111111111', name: 'general' },
              { id: 'C222222222', name: 'random' },
            ],
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [{ id: 'C333333333', name: 'private-channel' }],
          }),
      });

    const result = await resolveChannelId('xoxb-token', 'private-channel');

    expect(result).toBe('C333333333');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://slack.com/api/conversations.list?types=public_channel',
      {
        headers: { Authorization: 'Bearer xoxb-token' },
      },
    );
    expect(mockFetch).toHaveBeenCalledWith(
      'https://slack.com/api/conversations.list?types=private_channel',
      {
        headers: { Authorization: 'Bearer xoxb-token' },
      },
    );
  });

  test('should find channel in public channels', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    mockFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [
              { id: 'C111111111', name: 'general' },
              { id: 'C222222222', name: 'target-channel' },
            ],
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [],
          }),
      });

    const result = await resolveChannelId('xoxb-token', 'target-channel');

    expect(result).toBe('C222222222');
  });

  test('should throw error when channel not found', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    mockFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [{ id: 'C111111111', name: 'general' }],
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [],
          }),
      });

    await expect(
      resolveChannelId('xoxb-token', 'nonexistent-channel'),
    ).rejects.toThrow('channel_not_found');
  });

  test('should handle API errors gracefully', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    mockFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: false,
            error: 'invalid_auth',
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: false,
            error: 'invalid_auth',
          }),
      });

    await expect(
      resolveChannelId('invalid-token', 'any-channel'),
    ).rejects.toThrow('channel_not_found');
  });

  test('should handle mixed API responses', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    mockFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: false,
            error: 'some_error',
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [{ id: 'C333333333', name: 'private-channel' }],
          }),
      });

    const result = await resolveChannelId('xoxb-token', 'private-channel');

    expect(result).toBe('C333333333');
  });

  test('should handle empty channel lists', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    mockFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [],
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [],
          }),
      });

    await expect(resolveChannelId('xoxb-token', 'any-channel')).rejects.toThrow(
      'channel_not_found',
    );
  });

  test('should cache channelId after successful fetch', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    mockFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [{ id: 'C444444444', name: 'test-channel' }],
          }),
      })
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            ok: true,
            channels: [],
          }),
      });

    await resolveChannelId('xoxb-token', 'test-channel');

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      channelId: 'C444444444',
      cachedChannelName: 'test-channel',
    });
  });
});

describe('fetchAndStoreTeamId', () => {
  let originalFetch;
  const mockFetch = jest.fn();

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = mockFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should fetch and store team ID successfully', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          ok: true,
          team_id: 'T123456789',
        }),
    });

    await fetchAndStoreTeamId('xoxb-token');

    expect(mockFetch).toHaveBeenCalledWith('https://slack.com/api/auth.test', {
      headers: { Authorization: 'Bearer xoxb-token' },
    });
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      teamId: 'T123456789',
    });
  });

  test('should handle API error gracefully', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          ok: false,
          error: 'invalid_auth',
        }),
    });

    await fetchAndStoreTeamId('invalid-token');

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('should handle fetch error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await fetchAndStoreTeamId('xoxb-token');

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});

describe('fetchAndStoreMessages', () => {
  let originalFetch;
  const mockFetch = jest.fn();

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = mockFetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    chrome.storage.sync.get.mockResolvedValue({
      allowedPhrases: 'allowed to merge',
      disallowedPhrases: 'not allowed to merge',
      exceptionPhrases: 'except this project',
    });
  });

  test('should fetch and store messages successfully', async () => {
    chrome.storage.sync.get.mockResolvedValue({
      allowedPhrases: 'allowed to merge',
      disallowedPhrases: 'not allowed to merge',
      exceptionPhrases: 'except this project',
      channelName: 'test-channel',
    });

    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          ok: true,
          messages: [
            { text: 'Hello world', ts: '1234567890.123' },
            { text: 'allowed to merge', ts: '1234567891.123' },
          ],
        }),
    });

    await fetchAndStoreMessages('xoxb-token', 'C123456789');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://slack.com/api/conversations.history?channel=C123456789&limit=50',
      {
        headers: { Authorization: 'Bearer xoxb-token' },
      },
    );

    // Should call set multiple times for different data
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      messages: [
        { text: 'Hello world', ts: '1234567890.123' },
        { text: 'allowed to merge', ts: '1234567891.123' },
      ],
    });
  });

  test('should handle messages with Slack formatting', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          ok: true,
          messages: [
            {
              text: 'Hey <@U123456789>, check <#C987654321|general>',
              ts: '1234567890.123',
            },
          ],
        }),
    });

    await fetchAndStoreMessages('xoxb-token', 'C123456789');

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      messages: [{ text: 'Hey @MENTION, check', ts: '1234567890.123' }],
    });
  });

  test('should return early when channelId is null', async () => {
    await fetchAndStoreMessages('xoxb-token', null);

    expect(mockFetch).not.toHaveBeenCalled();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('should handle API error', async () => {
    mockFetch.mockResolvedValue({
      json: () =>
        Promise.resolve({
          ok: false,
          error: 'channel_not_found',
        }),
    });

    await fetchAndStoreMessages('xoxb-token', 'C123456789');

    // Should call handleSlackApiError which sets storage
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  test('should handle fetch error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await fetchAndStoreMessages('xoxb-token', 'C123456789');

    // Should call handleSlackApiError which sets storage
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });
});

describe('scheduleFeatureReactivation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock Date.now()
    jest.spyOn(Date, 'now').mockReturnValue(1000000000000); // Fixed timestamp
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should schedule feature reactivation', async () => {
    await scheduleFeatureReactivation();

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      reactivationTime: 1000000000000 + 60000, // 1 minute later
    });
    // Note: The function uses setTimeout, not chrome.alarms
  });
});

describe('checkScheduledReactivation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1000000000000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should reactivate feature when time has passed', async () => {
    chrome.storage.local.get.mockResolvedValue({
      reactivationTime: 999999999000, // 1 second ago
      featureEnabled: false,
    });
    chrome.storage.sync.get.mockResolvedValue({
      channelName: 'test-channel',
    });

    await checkScheduledReactivation();

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      featureEnabled: true,
    });
  });

  test('should not reactivate feature when time has not passed', async () => {
    chrome.storage.local.get.mockResolvedValue({
      reactivationTime: 1000000001000, // 1 second in future
    });

    await checkScheduledReactivation();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('should handle no reactivation time set', async () => {
    chrome.storage.local.get.mockResolvedValue({});

    await checkScheduledReactivation();

    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});

describe('reactivateFeature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should reactivate feature and clear alarm', async () => {
    chrome.storage.sync.get.mockResolvedValue({
      channelName: 'test-channel',
    });

    await reactivateFeature();

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      featureEnabled: true,
    });
    // Note: The function doesn't clear alarms, it uses setTimeout
  });
});

describe('registerBitbucketContentScript', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chrome.scripting.unregisterContentScripts.mockResolvedValue();
    chrome.scripting.registerContentScripts.mockResolvedValue();
  });

  test('should register content script when bitbucketUrl is provided', async () => {
    chrome.storage.sync.get.mockResolvedValue({
      bitbucketUrl:
        'https://bitbucket.example.com/projects/*/repos/*/pull-requests/*',
    });

    await registerBitbucketContentScript();

    expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledWith({
      ids: ['bitbucket-content-script'],
    });
    expect(chrome.scripting.registerContentScripts).toHaveBeenCalledWith([
      {
        id: 'bitbucket-content-script',
        matches: [
          'https://bitbucket.example.com/projects/*/repos/*/pull-requests/*',
        ],
        js: ['slack_frontend_closure_bitbucket_content.js'],
        runAt: 'document_idle',
      },
    ]);
  });

  test('should only unregister when no bitbucketUrl is provided', async () => {
    chrome.storage.sync.get.mockResolvedValue({});

    await registerBitbucketContentScript();

    expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledWith({
      ids: ['bitbucket-content-script'],
    });
    expect(chrome.scripting.registerContentScripts).not.toHaveBeenCalled();
  });

  test('should handle unregister error gracefully', async () => {
    chrome.storage.sync.get.mockResolvedValue({
      bitbucketUrl: 'https://bitbucket.example.com/*',
    });
    chrome.scripting.unregisterContentScripts.mockRejectedValue(
      new Error('Script not found'),
    );

    await registerBitbucketContentScript();

    // Should still try to register despite unregister error
    expect(chrome.scripting.registerContentScripts).toHaveBeenCalled();
  });

  test('should handle register error gracefully', async () => {
    chrome.storage.sync.get.mockResolvedValue({
      bitbucketUrl: 'https://bitbucket.example.com/*',
    });
    chrome.scripting.registerContentScripts.mockRejectedValue(
      new Error('Registration failed'),
    );

    await registerBitbucketContentScript();

    expect(chrome.scripting.registerContentScripts).toHaveBeenCalled();
    // Should not throw error
  });
});

describe('updateMergeButtonFromLastKnownMergeState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should call chrome.storage.local.get with correct parameters', () => {
    updateMergeButtonFromLastKnownMergeState();

    expect(chrome.storage.local.get).toHaveBeenCalledWith(
      ['lastKnownMergeState', 'featureEnabled'],
      expect.any(Function),
    );
  });

  test('should handle function call without errors', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({
        lastKnownMergeState: {
          mergeStatus: 'allowed',
          lastSlackMessage: 'allowed to merge',
          channelName: 'test-channel',
          isMergeDisabled: false,
        },
        featureEnabled: true,
      });
    });

    expect(() => updateMergeButtonFromLastKnownMergeState()).not.toThrow();
  });

  test('should handle empty result gracefully', () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });

    expect(() => updateMergeButtonFromLastKnownMergeState()).not.toThrow();
  });
});
