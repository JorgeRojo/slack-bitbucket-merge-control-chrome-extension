import { describe, test, expect, vi } from 'vitest';
import { initializeToggleFeatureStatus } from '../src/modules/popup/popup-toggle-feature-status';

// Mock the modules
vi.mock('../src/modules/common/utils/logger');
vi.mock('../src/modules/common/components/toggle-switch/toggle-switch');

// Mock chrome API
vi.mock(
  'chrome',
  () => ({
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({ featureEnabled: true }),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: vi.fn(),
      },
    },
  }),
  { virtual: true }
);

// Mock document
document.getElementById = vi.fn().mockReturnValue({
  style: { display: 'none' },
  textContent: '',
});

describe('popup-toggle-feature-status.js', () => {
  describe('initializeToggleFeatureStatus', () => {
    test('should handle null toggle element', async () => {
      // This test should pass without modifying the source code
      await expect(initializeToggleFeatureStatus(null)).resolves.not.toThrow();
    });
  });
});
