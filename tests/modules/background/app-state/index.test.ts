import { updateExtensionIcon } from '@src/modules/background/app-state';
import { MERGE_STATUS } from '@src/modules/common/constants';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

describe('App State', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateExtensionIcon', () => {
    test('should set icon for LOADING status', () => {
      updateExtensionIcon(MERGE_STATUS.LOADING);
      expect(chrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16.png',
          48: 'images/icon48.png',
        },
      });
    });

    test('should set icon for ALLOWED status', () => {
      updateExtensionIcon(MERGE_STATUS.ALLOWED);
      expect(chrome.action.setIcon).toHaveBeenCalledWith({
        path: {
          16: 'images/icon16_enabled.png',
          48: 'images/icon48_enabled.png',
        },
      });
    });
  });
});
