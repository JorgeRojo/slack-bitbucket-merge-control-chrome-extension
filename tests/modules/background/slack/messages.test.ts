import { updateIconBasedOnCurrentMessages } from '@src/modules/background/app-state';
import { updateContentScriptMergeState } from '@src/modules/background/bitbucket';
import { getPhrasesFromStorage } from '@src/modules/background/config';
import { determineMergeStatus } from '@src/modules/background/message-analysis';
import { fetchChannelInfo } from '@src/modules/background/slack/api';
import { fetchCanvasContent } from '@src/modules/background/slack/canvas';
import {
  cleanSlackMessageText,
  determineAndFetchAllCanvasContent,
  fetchAndStoreMessages,
  processAndStoreMessage,
} from '@src/modules/background/slack/messages';
import { MAX_MESSAGES, SLACK_CONVERSATIONS_HISTORY_URL } from '@src/modules/common/constants';
import { ProcessedMessage } from '@src/modules/common/types/app';
import { SlackMessage } from '@src/modules/common/types/slack';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Define interface for chrome storage mock
interface ChromeStorageMock {
  messages?: ProcessedMessage[];
  [key: string]: any;
}

// Mock dependencies
vi.mock('@src/modules/background/app-state', () => ({
  updateIconBasedOnCurrentMessages: vi.fn(),
}));

vi.mock('@src/modules/background/bitbucket', () => ({
  updateContentScriptMergeState: vi.fn(),
}));

vi.mock('@src/modules/background/config', () => ({
  getPhrasesFromStorage: vi.fn(),
}));

vi.mock('@src/modules/background/message-analysis', () => ({
  determineMergeStatus: vi.fn(),
}));

vi.mock('@src/modules/background/slack/api', () => ({
  fetchChannelInfo: vi.fn(),
}));

vi.mock('@src/modules/background/slack/canvas', () => ({
  fetchCanvasContent: vi.fn(),
}));

describe('Slack Messages Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock chrome API
    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
        },
        sync: {
          get: vi.fn().mockResolvedValue({ channelName: 'test-channel' }),
        },
      },
    } as any;

    // Mock fetch
    global.fetch = vi.fn();

    // Mock getPhrasesFromStorage
    (getPhrasesFromStorage as any).mockResolvedValue({
      currentAllowedPhrases: ['allowed'],
      currentDisallowedPhrases: ['disallowed'],
      currentExceptionPhrases: ['exception'],
    });

    // Mock determineMergeStatus
    (determineMergeStatus as any).mockReturnValue({
      message: { text: 'test message', ts: '123456789', user: 'U123' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('cleanSlackMessageText', () => {
    test('should handle undefined text', () => {
      expect(cleanSlackMessageText(undefined)).toBe('');
    });

    test('should clean newlines and tabs', () => {
      expect(cleanSlackMessageText('Hello\nWorld\tTest')).toBe('Hello World Test');
    });

    test('should replace user mentions', () => {
      expect(cleanSlackMessageText('Hello <@U123456>')).toBe('Hello @MENTION');
    });

    test('should replace channel mentions', () => {
      expect(cleanSlackMessageText('Check <#C123456>')).toBe('Check @CHANNEL');
    });

    test('should handle Slack links with text', () => {
      expect(cleanSlackMessageText('Visit <http://example.com|Example>')).toBe('Visit Example');
    });

    test('should handle Slack links without text', () => {
      expect(cleanSlackMessageText('Visit <http://example.com>')).toBe('Visit');
    });

    test('should handle multiple whitespace', () => {
      expect(cleanSlackMessageText('Too    many    spaces')).toBe('Too many spaces');
    });

    test('should handle complex formatting', () => {
      const input =
        'Hello <@U123456>,\n\nPlease check <#C123456> and <http://example.com|this link>.\t\tThanks!';
      const expected = 'Hello @MENTION, Please check @CHANNEL and this link. Thanks!';
      expect(cleanSlackMessageText(input)).toBe(expected);
    });
  });

  describe('processAndStoreMessage', () => {
    test('should ignore messages without ts or text', async () => {
      await processAndStoreMessage({} as SlackMessage);
      expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('should ignore duplicate messages', async () => {
      const message = { ts: '123456789', text: 'Test message', user: 'U123' };

      vi.clearAllMocks();

      chrome.storage.local.get = vi.fn().mockResolvedValue({
        messages: [{ ts: '123456789000', text: 'Test message', user: 'U123' }],
      } as ChromeStorageMock);

      await processAndStoreMessage(message);

      expect(chrome.storage.local.set).not.toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.any(Array),
        })
      );
    });

    test('should process and store new message', async () => {
      const message = { ts: '123456789', text: 'Test message', user: 'U123' };
      chrome.storage.local.get = vi.fn().mockResolvedValue({
        messages: [],
      } as ChromeStorageMock);

      await processAndStoreMessage(message);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        messages: [{ ts: '123456789000', text: 'Test message', user: 'U123' }],
      });
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        lastMatchingMessage: expect.any(Object),
      });
      expect(updateIconBasedOnCurrentMessages).toHaveBeenCalled();
    });

    test('should limit the number of stored messages', async () => {
      const message = { ts: '999999999', text: 'New message', user: 'U123' };

      // Create array with MAX_MESSAGES + 5 messages
      const existingMessages = Array.from({ length: MAX_MESSAGES + 5 }, (_, i) => ({
        ts: String(i),
        text: `Message ${i}`,
        user: 'U123',
      }));

      chrome.storage.local.get = vi.fn().mockResolvedValue({
        messages: existingMessages,
      } as ChromeStorageMock);

      await processAndStoreMessage(message);

      // Verify only MAX_MESSAGES were stored
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        messages: expect.arrayContaining([expect.objectContaining({ ts: '999999999000' })]),
      });

      const setCall = vi.mocked(chrome.storage.local.set).mock.calls[0][0] as ChromeStorageMock;
      expect(setCall.messages!.length).toBe(MAX_MESSAGES);
    });

    test('should sort messages by timestamp in descending order', async () => {
      const message = { ts: '2', text: 'Middle message', user: 'U123' };

      chrome.storage.local.get = vi.fn().mockResolvedValue({
        messages: [
          { ts: '3000', text: 'Newest message', user: 'U123' },
          { ts: '1000', text: 'Oldest message', user: 'U123' },
        ],
      } as ChromeStorageMock);

      await processAndStoreMessage(message);

      const setCall = vi.mocked(chrome.storage.local.set).mock.calls[0][0] as ChromeStorageMock;
      expect(setCall.messages![0].ts).toBe('3000'); // Newest first
      expect(setCall.messages![1].ts).toBe('2000');
      expect(setCall.messages![2].ts).toBe('1000');
    });
  });

  describe('determineAndFetchAllCanvasContent', () => {
    test('should use provided canvas file ID and return single canvas', async () => {
      (fetchCanvasContent as any).mockResolvedValue({ content: 'Canvas content', ts: '123456789' });

      const result = await determineAndFetchAllCanvasContent('xoxb-test-token', 'F12345', {
        ok: true,
      });

      expect(fetchCanvasContent).toHaveBeenCalledWith('xoxb-test-token', 'F12345');
      expect(result).toEqual([{ content: 'Canvas content', ts: '123456789', fileId: 'F12345' }]);
    });

    test('should fetch all canvas from channel tabs when no specific file ID provided', async () => {
      (fetchCanvasContent as any)
        .mockResolvedValueOnce({ content: 'Canvas 1 content', ts: '123456789' })
        .mockResolvedValueOnce({ content: 'Canvas 2 content', ts: '987654321' });

      const result = await determineAndFetchAllCanvasContent('xoxb-test-token', undefined, {
        ok: true,
        channel: {
          properties: {
            tabs: [
              {
                type: 'canvas',
                data: {
                  file_id: 'F67890',
                },
              },
              {
                type: 'canvas',
                data: {
                  file_id: 'F11111',
                },
              },
              {
                type: 'files',
                data: {
                  file_id: 'F22222',
                },
              },
            ],
          },
        },
      });

      expect(fetchCanvasContent).toHaveBeenCalledWith('xoxb-test-token', 'F67890');
      expect(fetchCanvasContent).toHaveBeenCalledWith('xoxb-test-token', 'F11111');
      expect(fetchCanvasContent).toHaveBeenCalledTimes(2);
      expect(result).toEqual([
        { content: 'Canvas 1 content', ts: '123456789', fileId: 'F67890' },
        { content: 'Canvas 2 content', ts: '987654321', fileId: 'F11111' },
      ]);
    });

    test('should return empty array if no canvas tabs are available', async () => {
      const result = await determineAndFetchAllCanvasContent('xoxb-test-token', undefined, {
        ok: true,
        channel: {
          properties: {
            tabs: [
              {
                type: 'files',
                data: {
                  file_id: 'F22222',
                },
              },
            ],
          },
        },
      });

      expect(fetchCanvasContent).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test('should return empty array if channel info is not ok', async () => {
      const result = await determineAndFetchAllCanvasContent('xoxb-test-token', undefined, {
        ok: false,
      });

      expect(fetchCanvasContent).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    test('should handle canvas fetch failures gracefully', async () => {
      (fetchCanvasContent as any)
        .mockResolvedValueOnce({ content: 'Canvas 1 content', ts: '123456789' })
        .mockResolvedValueOnce(null); // Second canvas fails

      const result = await determineAndFetchAllCanvasContent('xoxb-test-token', undefined, {
        ok: true,
        channel: {
          properties: {
            tabs: [
              {
                type: 'canvas',
                data: {
                  file_id: 'F67890',
                },
              },
              {
                type: 'canvas',
                data: {
                  file_id: 'F11111',
                },
              },
            ],
          },
        },
      });

      expect(fetchCanvasContent).toHaveBeenCalledTimes(2);
      expect(result).toEqual([{ content: 'Canvas 1 content', ts: '123456789', fileId: 'F67890' }]);
    });
  });

  describe('fetchAndStoreMessages', () => {
    test('should return early if channelId is not provided', async () => {
      await fetchAndStoreMessages('xoxb-test-token', '');

      expect(fetch).not.toHaveBeenCalled();
      expect(fetchChannelInfo).not.toHaveBeenCalled();
    });

    test('should fetch and store messages with multiple canvas successfully', async () => {
      // Mock fetch response
      (global.fetch as any).mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          ok: true,
          messages: [
            { ts: '123', text: 'Message 1', user: 'U123' },
            { ts: '456', text: 'Message 2', user: 'U456' },
          ],
        }),
      });

      // Mock fetchChannelInfo response
      (fetchChannelInfo as any).mockResolvedValue({
        ok: true,
        channel: {
          properties: {
            tabs: [
              {
                type: 'canvas',
                data: {
                  file_id: 'F12345',
                },
              },
              {
                type: 'canvas',
                data: {
                  file_id: 'F67890',
                },
              },
            ],
          },
        },
      });

      // Mock fetchCanvasContent responses
      (fetchCanvasContent as any)
        .mockResolvedValueOnce({ content: 'Canvas 1 content', ts: '789000' })
        .mockResolvedValueOnce({ content: 'Canvas 2 content', ts: '999000' });

      await fetchAndStoreMessages('xoxb-test-token', 'C12345');

      // Verify API calls
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `${SLACK_CONVERSATIONS_HISTORY_URL}?channel=C12345&limit=${MAX_MESSAGES}`
        ),
        expect.any(Object)
      );
      expect(fetchChannelInfo).toHaveBeenCalledWith('xoxb-test-token', 'C12345');
      expect(fetchCanvasContent).toHaveBeenCalledTimes(2);
      expect(fetchCanvasContent).toHaveBeenCalledWith('xoxb-test-token', 'F12345');
      expect(fetchCanvasContent).toHaveBeenCalledWith('xoxb-test-token', 'F67890');

      // Verify that chrome.storage.local.set was called with messages including canvas content
      const setCalls = vi.mocked(chrome.storage.local.set).mock.calls;
      const messagesCall = setCalls.find(call => call[0] && 'messages' in call[0]);
      expect(messagesCall).toBeDefined();

      const storedMessages = (messagesCall![0] as ChromeStorageMock).messages;
      expect(storedMessages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ text: 'Message 1', user: 'U123' }),
          expect.objectContaining({ text: 'Message 2', user: 'U456' }),
          expect.objectContaining({ text: 'Canvas 1 content', user: 'canvas-F12345' }),
          expect.objectContaining({ text: 'Canvas 2 content', user: 'canvas-F67890' }),
        ])
      );

      // Verify other function calls
      expect(updateIconBasedOnCurrentMessages).toHaveBeenCalled();
      expect(updateContentScriptMergeState).toHaveBeenCalledWith('test-channel');
    });

    test('should throw error if history fetch fails', async () => {
      // Mock fetch response with error
      (global.fetch as any).mockResolvedValue({
        json: vi.fn().mockResolvedValue({
          ok: false,
          error: 'channel_not_found',
        }),
      });

      // Mock fetchChannelInfo response
      (fetchChannelInfo as any).mockResolvedValue({ ok: true });

      await expect(fetchAndStoreMessages('xoxb-test-token', 'C12345')).rejects.toThrow(
        'channel_not_found'
      );
    });

    test('should handle fetch rejection', async () => {
      // Mock fetch rejection
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      // Mock fetchChannelInfo response
      (fetchChannelInfo as any).mockResolvedValue({ ok: true });

      await expect(fetchAndStoreMessages('xoxb-test-token', 'C12345')).rejects.toThrow();
    });
  });
});
