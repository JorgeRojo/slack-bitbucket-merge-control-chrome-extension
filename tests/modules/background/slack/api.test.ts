import {
  fetchAllChannels,
  fetchAndStoreTeamId,
  resolveChannelId,
} from '@src/modules/background/slack/api';
import { ERROR_MESSAGES } from '@src/modules/common/constants';
import { Logger } from '@src/modules/common/utils/Logger';
import { mockFetchResponses, mockStorage } from '@tests/setup';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@src/modules/common/utils/Logger', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Slack API Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAllChannels', () => {
    test('should fetch both public and private channels', async () => {
      mockFetchResponses([
        {
          response: {
            ok: true,
            channels: [
              { id: 'C123', name: 'general', is_private: false },
              { id: 'C456', name: 'random', is_private: false },
            ],
          },
        },
        {
          response: {
            ok: true,
            channels: [{ id: 'P123', name: 'private-channel', is_private: true }],
          },
        },
      ]);

      const channels = await fetchAllChannels('test-token');

      expect(channels).toHaveLength(3);
      expect(channels).toEqual(
        expect.arrayContaining([
          { id: 'C123', name: 'general', is_private: false },
          { id: 'C456', name: 'random', is_private: false },
          { id: 'P123', name: 'private-channel', is_private: true },
        ])
      );

      expect(fetch).toHaveBeenCalledTimes(2);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('types=public_channel'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('types=private_channel'),
        expect.objectContaining({
          headers: { Authorization: 'Bearer test-token' },
        })
      );
    });

    test('should handle API errors gracefully', async () => {
      mockFetchResponses([
        {
          response: {
            ok: false,
            error: 'invalid_auth',
          },
        },
        {
          response: {
            ok: true,
            channels: [{ id: 'P123', name: 'private-channel', is_private: true }],
          },
        },
      ]);

      const channels = await fetchAllChannels('test-token');

      expect(channels).toHaveLength(1);
      expect(channels[0].name).toBe('private-channel');
    });

    test('should handle network errors gracefully', async () => {
      mockFetchResponses([
        {
          mustReject: true,
        },
        {
          response: {
            ok: true,
            channels: [{ id: 'P123', name: 'private-channel', is_private: true }],
          },
        },
      ]);

      const channels = await fetchAllChannels('test-token');

      expect(channels).toHaveLength(1);
      expect(channels[0].name).toBe('private-channel');
    });
  });

  describe('resolveChannelId', () => {
    test('should throw error if channel not found', async () => {
      mockStorage.local.get.mockResolvedValueOnce({});

      await expect(resolveChannelId('test-token', 'test-channel')).rejects.toThrow(
        ERROR_MESSAGES.CHANNEL_NOT_FOUND
      );
    });
  });

  describe('fetchAndStoreTeamId', () => {
    test('should fetch and store team ID successfully', async () => {
      mockFetchResponses([
        {
          response: {
            ok: true,
            team_id: 'T123',
            team: 'Test Team',
          },
        },
      ]);

      await fetchAndStoreTeamId('test-token');

      expect(mockStorage.local.set).toHaveBeenCalledWith({
        teamId: 'T123',
      });
    });

    test('should log error if API response is not ok', async () => {
      mockFetchResponses([
        {
          response: {
            ok: false,
            error: 'invalid_auth',
          },
        },
      ]);

      await fetchAndStoreTeamId('test-token');

      expect(Logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'invalid_auth' })
      );
    });

    test('should handle network errors', async () => {
      mockFetchResponses([
        {
          mustReject: true,
        },
      ]);

      await fetchAndStoreTeamId('test-token');

      expect(Logger.error).toHaveBeenCalled();
    });
  });
});
