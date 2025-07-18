/**
 * @vitest-environment jsdom
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';

describe('Runtime Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock chrome API
    global.chrome = {
      runtime: {
        sendMessage: vi.fn(),
        lastError: null,
      },
    };

    // Mock console.log
    console.log = vi.fn();
  });

  test('should handle runtime.lastError in sendMessage', () => {
    // Simulate runtime.lastError when sendMessage is called
    chrome.runtime.sendMessage.mockImplementation((message, callback) => {
      if (callback && typeof callback === 'function') {
        // Set runtime.lastError before calling the callback
        chrome.runtime.lastError = { message: 'The message port closed before a response was received.' };
        callback(null);
        // Clear runtime.lastError after callback
        delete chrome.runtime.lastError;
      }
    });

    // Create a function that uses chrome.runtime.sendMessage with error handling
    function sendMessageWithErrorHandling() {
      try {
        chrome.runtime.sendMessage({ action: 'test' }, (response) => {
          // Verificamos si hay un error de runtime.lastError
          if (chrome.runtime.lastError) {
            console.log(
              'Error al recibir respuesta:',
              chrome.runtime.lastError.message,
            );
            return;
          }
          
          console.log('Response received:', response);
        });
      } catch (error) {
        console.log('Error al enviar mensaje:', error);
      }
    }

    // Call the function
    sendMessageWithErrorHandling();

    // Verify that sendMessage was called
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'test' },
      expect.any(Function),
    );

    // Verify that the error was logged
    expect(console.log).toHaveBeenCalledWith(
      'Error al recibir respuesta:',
      'The message port closed before a response was received.',
    );
  });

  test('should handle exception in sendMessage', () => {
    // Simulate exception when sendMessage is called
    chrome.runtime.sendMessage.mockImplementation(() => {
      throw new Error('Test error');
    });

    // Create a function that uses chrome.runtime.sendMessage with error handling
    function sendMessageWithErrorHandling() {
      try {
        chrome.runtime.sendMessage({ action: 'test' }, () => {});
      } catch (error) {
        console.log('Error al enviar mensaje:', error);
      }
    }

    // Call the function
    sendMessageWithErrorHandling();

    // Verify that sendMessage was called
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { action: 'test' },
      expect.any(Function),
    );

    // Verify that the error was logged
    expect(console.log).toHaveBeenCalledWith(
      'Error al enviar mensaje:',
      expect.any(Error),
    );
  });
});
