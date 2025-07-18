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
  // Mock fetch globally
  const mockFetch = jest.fn();
  global.fetch = mockFetch;

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
