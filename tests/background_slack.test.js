import { jest } from '@jest/globals';
import {
  resolveChannelId,
  handleSlackApiError,
  fetchAndStoreTeamId,
} from '../src/background_slack.js';

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
};

// Mock WebSocket
global.WebSocket = jest.fn().mockImplementation(() => ({
  close: jest.fn(),
  onopen: null,
  onmessage: null,
  onclose: null,
  onerror: null,
}));

describe('Slack Background Functions', () => {
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
    chrome.storage.sync.get.mockResolvedValue({});
  });

  describe('resolveChannelId', () => {
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
    });

    test('should throw error when channel not found', async () => {
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

      await expect(
        resolveChannelId('xoxb-token', 'nonexistent-channel'),
      ).rejects.toThrow('channel_not_found');
    });
  });

  describe('fetchAndStoreTeamId', () => {
    test('should fetch and store team ID successfully', async () => {
      mockFetch.mockResolvedValue({
        json: () =>
          Promise.resolve({
            ok: true,
            team_id: 'T123456789',
          }),
      });

      await fetchAndStoreTeamId('xoxb-token');

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
  });

  describe('handleSlackApiError', () => {
    test('should handle channel_not_found error', async () => {
      const error = { message: 'channel_not_found' };

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
  });
});
