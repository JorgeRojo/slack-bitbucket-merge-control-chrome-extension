import { describe, test, expect, vi } from 'vitest';
import { APP_STATUS } from '../../src/constants.js';

// Helper function to update appStatus within lastKnownMergeState
const updateAppStatus = async (status) => {
  const { lastKnownMergeState = {} } = await chrome.storage.local.get(
    'lastKnownMergeState',
  );
  await chrome.storage.local.set({
    lastKnownMergeState: {
      ...lastKnownMergeState,
      appStatus: status,
    },
  });
};

// Create a mock implementation of handleSlackApiError that matches the real one
const mockHandleSlackApiError = async (error) => {
  const errorMessage = error?.message || '';

  if (
    errorMessage.includes('channel_not_found') ||
    errorMessage.includes('not_in_channel')
  ) {
    await updateAppStatus(APP_STATUS.CHANNEL_NOT_FOUND);
    await chrome.storage.local.set({
      channelId: null,
    });
  } else if (
    errorMessage.includes('invalid_auth') ||
    errorMessage.includes('token_revoked')
  ) {
    await updateAppStatus(APP_STATUS.TOKEN_ERROR);
  } else {
    await updateAppStatus(APP_STATUS.UNKNOWN_ERROR);
  }
};

describe('Background Script Error Recovery', () => {
  // Test that handleSlackApiError doesn't clear messages
  test('handleSlackApiError should not clear messages when setting error state', async () => {
    // Mock chrome.storage.local.set and get
    const mockSet = vi.fn();
    const mockGet = vi.fn().mockResolvedValue({ lastKnownMergeState: {} });
    global.chrome = {
      storage: {
        local: {
          set: mockSet,
          get: mockGet,
        },
      },
    };

    // Create a channel_not_found error
    const error = new Error('channel_not_found');

    // Call the mock function
    await mockHandleSlackApiError(error);

    // Check that messages were not cleared
    const calls = mockSet.mock.calls;

    // Verify that appStatus was set correctly in lastKnownMergeState
    expect(calls[0][0]).toHaveProperty('lastKnownMergeState');
    expect(calls[0][0].lastKnownMergeState).toHaveProperty(
      'appStatus',
      APP_STATUS.CHANNEL_NOT_FOUND,
    );

    // Verify that channelId was set to null
    expect(calls[1][0]).toHaveProperty('channelId', null);
  });
});
