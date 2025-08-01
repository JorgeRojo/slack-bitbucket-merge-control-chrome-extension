import { updateAppStatus } from '@src/modules/background/app-state';
import { handleSlackApiError } from '@src/modules/background/slack/error-handler';
import { APP_STATUS, ERROR_MESSAGES } from '@src/modules/common/constants';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock dependencies
vi.mock('@src/modules/background/app-state', () => ({
  updateAppStatus: vi.fn(),
}));

describe('Slack Error Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock chrome API
    global.chrome = {
      storage: {
        local: {
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    } as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('should handle channel not found error', async () => {
    await handleSlackApiError(new Error(`Error: ${ERROR_MESSAGES.CHANNEL_NOT_FOUND}`));

    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.CHANNEL_NOT_FOUND);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      channelId: null,
    });
  });

  test('should handle not in channel error', async () => {
    await handleSlackApiError(new Error(`Error: ${ERROR_MESSAGES.NOT_IN_CHANNEL}`));

    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.CHANNEL_NOT_FOUND);
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      channelId: null,
    });
  });

  test('should handle invalid auth error', async () => {
    await handleSlackApiError(new Error(`Error: ${ERROR_MESSAGES.INVALID_AUTH}`));

    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.TOKEN_ERROR);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('should handle token revoked error', async () => {
    await handleSlackApiError(new Error(`Error: ${ERROR_MESSAGES.TOKEN_REVOKED}`));

    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.TOKEN_ERROR);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('should handle unknown errors', async () => {
    await handleSlackApiError(new Error('Some unknown error'));

    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.UNKNOWN_ERROR);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('should handle non-Error objects', async () => {
    await handleSlackApiError('String error message');

    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.UNKNOWN_ERROR);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });

  test('should handle null or undefined errors', async () => {
    await handleSlackApiError(null);

    expect(updateAppStatus).toHaveBeenCalledWith(APP_STATUS.UNKNOWN_ERROR);
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
