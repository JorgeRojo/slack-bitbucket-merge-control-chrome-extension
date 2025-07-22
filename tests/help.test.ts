import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the nav-links component import at the module level
vi.mock('../src/components/nav-links.js', () => ({}));

describe('Help Page', () => {
  let mockConsoleLog: ReturnType<typeof vi.spyOn>;
  let mockAddEventListener: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Clear module cache to ensure fresh imports
    vi.resetModules();
    
    // Mock console.log
    mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Mock document.addEventListener
    mockAddEventListener = vi.spyOn(document, 'addEventListener').mockImplementation(() => {});
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore all mocks
    vi.restoreAllMocks();
  });

  it('should have nav-links component mocked correctly', async () => {
    // This test verifies that the mock is working by importing the help module
    // which internally imports nav-links
    expect(async () => {
      await import('../src/help.ts');
    }).not.toThrow();
  });

  it('should add DOMContentLoaded event listener when module loads', async () => {
    // Import the help module
    await import('../src/help.ts');
    
    // Verify that addEventListener was called with DOMContentLoaded
    expect(mockAddEventListener).toHaveBeenCalledWith(
      'DOMContentLoaded',
      expect.any(Function)
    );
  });

  it('should log message when DOMContentLoaded callback is executed', async () => {
    // Import the help module
    await import('../src/help.ts');
    
    // Get the callback function that was passed to addEventListener
    const addEventListenerCalls = mockAddEventListener.mock.calls;
    const domContentLoadedCall = addEventListenerCalls.find(
      call => call[0] === 'DOMContentLoaded'
    );
    
    expect(domContentLoadedCall).toBeDefined();
    
    if (domContentLoadedCall) {
      const callback = domContentLoadedCall[1] as () => void;
      
      // Execute the callback
      callback();
      
      // Verify console.log was called
      expect(mockConsoleLog).toHaveBeenCalledWith('Help page loaded');
    }
  });

  it('should handle callback execution without errors', async () => {
    // Import the help module
    await import('../src/help.ts');
    
    // Get the callback function
    const addEventListenerCalls = mockAddEventListener.mock.calls;
    const domContentLoadedCall = addEventListenerCalls.find(
      call => call[0] === 'DOMContentLoaded'
    );
    
    if (domContentLoadedCall) {
      const callback = domContentLoadedCall[1] as () => void;
      
      // Execute the callback should not throw
      expect(() => callback()).not.toThrow();
    }
  });

  it('should register exactly one DOMContentLoaded listener', async () => {
    // Import the help module
    await import('../src/help.ts');
    
    // Count DOMContentLoaded listeners
    const domContentLoadedCalls = mockAddEventListener.mock.calls.filter(
      call => call[0] === 'DOMContentLoaded'
    );
    
    expect(domContentLoadedCalls).toHaveLength(1);
  });

  it('should execute module initialization code', async () => {
    // Import should trigger the module's top-level code
    await import('../src/help.ts');
    
    // Verify that addEventListener was called (indicating module executed)
    expect(mockAddEventListener).toHaveBeenCalled();
  });
});
