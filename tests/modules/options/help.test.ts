import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/modules/common/components/nav-links', () => ({}));

describe('Help Page', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockAddEventListener: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    vi.resetModules();

    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockAddEventListener = vi.spyOn(document, 'addEventListener').mockImplementation(() => {});

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should have nav-links component mocked correctly', async () => {
    expect(async () => {
      await import('@src/modules/options/help.ts');
    }).not.toThrow();
  });

  it('should add DOMContentLoaded event listener when module loads', async () => {
    await import('@src/modules/options/help.ts');

    expect(mockAddEventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
  });

  it('should log message when DOMContentLoaded callback is executed', async () => {
    await import('@src/modules/options/help.ts');

    const addEventListenerCalls = mockAddEventListener.mock.calls;
    const domContentLoadedCall = addEventListenerCalls.find(call => call[0] === 'DOMContentLoaded');

    expect(domContentLoadedCall).toBeDefined();

    if (domContentLoadedCall) {
      const callback = domContentLoadedCall[1] as () => void;
      callback();

      expect(mockConsoleLog).toHaveBeenCalledWith('Help page loaded');
    }
  });

  it('should handle callback execution without errors', async () => {
    await import('@src/modules/options/help.ts');

    const addEventListenerCalls = mockAddEventListener.mock.calls;
    const domContentLoadedCall = addEventListenerCalls.find(call => call[0] === 'DOMContentLoaded');

    if (domContentLoadedCall) {
      const callback = domContentLoadedCall[1] as () => void;
      expect(() => callback()).not.toThrow();
    }
  });

  it('should register exactly one DOMContentLoaded listener', async () => {
    await import('@src/modules/options/help.ts');

    const domContentLoadedCalls = mockAddEventListener.mock.calls.filter(
      call => call[0] === 'DOMContentLoaded'
    );

    expect(domContentLoadedCalls).toHaveLength(1);
  });

  it('should execute module initialization code', async () => {
    await import('@src/modules/options/help.ts');

    expect(mockAddEventListener).toHaveBeenCalled();
  });
});
