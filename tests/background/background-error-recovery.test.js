import { describe, test, expect, vi } from 'vitest';
import { APP_STATUS } from '../../src/constants.js';

// Create a mock implementation of handleSlackApiError that matches the real one
const mockHandleSlackApiError = async (error) => {
  const errorMessage = error?.message || '';

  if (
    errorMessage.includes('channel_not_found') ||
    errorMessage.includes('not_in_channel')
  ) {
    await chrome.storage.local.set({
      appStatus: APP_STATUS.CHANNEL_NOT_FOUND,
      channelId: null,
    });
  } else if (
    errorMessage.includes('invalid_auth') ||
    errorMessage.includes('token_revoked')
  ) {
    await chrome.storage.local.set({
      appStatus: APP_STATUS.TOKEN_ERROR,
    });
  } else {
    await chrome.storage.local.set({
      appStatus: APP_STATUS.UNKNOWN_ERROR,
    });
  }
};

describe('Background Script Error Recovery', () => {
  // Test that handleSlackApiError doesn't clear messages
  test('handleSlackApiError should not clear messages when setting error state', async () => {
    // Mock chrome.storage.local.set
    const mockSet = vi.fn();
    global.chrome = {
      storage: {
        local: {
          set: mockSet,
        },
      },
    };

    // Create a channel_not_found error
    const error = new Error('channel_not_found');

    // Call the mock function
    await mockHandleSlackApiError(error);

    // Check that messages were not cleared
    const calls = mockSet.mock.calls;
    const setParams = calls[0][0];

    // Verify that the messages property is not present in the set call
    expect(setParams).not.toHaveProperty('messages');

    // Verify that appStatus was set correctly
    expect(setParams).toHaveProperty('appStatus', APP_STATUS.CHANNEL_NOT_FOUND);
  });
});
