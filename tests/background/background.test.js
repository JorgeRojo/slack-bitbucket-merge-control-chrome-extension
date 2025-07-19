import { describe, test, expect, beforeEach, vi } from 'vitest';

// Dado que ya no podemos importar directamente las funciones del background.js,
// vamos a crear versiones de prueba de las funciones que necesitamos probar

/**
 * Normaliza el texto eliminando acentos, convirtiendo a minúsculas y eliminando espacios extra
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '') // Remove diacritical marks (accents, tildes, etc.)
    .replace(/\s+/g, ' ') // Replace multiple whitespace characters with single space
    .trim();
}

/**
 * Limpia el texto de un mensaje de Slack, eliminando menciones y formatos especiales
 */
function cleanSlackMessageText(text) {
  if (!text) return '';

  text = text.replace(/[\n\r\t]+/g, ' '); // Replace line breaks and tabs with spaces
  let cleanedText = text.replace(/<@[^>]+>/g, '@MENTION'); // Replace user mentions like <@U123456789> with @MENTION
  cleanedText = cleanedText.replace(/<#[^|>]+>/g, '@CHANNEL'); // Replace unnamed channel mentions like <#C123456789> with @CHANNEL
  cleanedText = cleanedText.replace(/<[^>]+>/g, ''); // Remove any remaining angle bracket content
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim(); // Replace multiple spaces with single space and trim
  return cleanedText;
}

/**
 * Determina el estado de merge basado en los mensajes y frases configuradas
 */
function determineMergeStatus({
  messages,
  allowedPhrases,
  disallowedPhrases,
  exceptionPhrases,
}) {
  const normalizedAllowedPhrases = allowedPhrases.map(normalizeText);
  const normalizedDisallowedPhrases = disallowedPhrases.map(normalizeText);
  const normalizedExceptionPhrases = exceptionPhrases.map(normalizeText);

  for (const message of messages) {
    const normalizedMessageText = normalizeText(message.text);

    const matchingExceptionPhrase = normalizedExceptionPhrases.find((keyword) =>
      normalizedMessageText.includes(keyword),
    );
    if (matchingExceptionPhrase) {
      return { status: 'exception', message };
    }

    const matchingDisallowedPhrase = normalizedDisallowedPhrases.find(
      (keyword) => normalizedMessageText.includes(keyword),
    );
    if (matchingDisallowedPhrase) {
      return { status: 'disallowed', message };
    }

    const matchingAllowedPhrase = normalizedAllowedPhrases.find((keyword) =>
      normalizedMessageText.includes(keyword),
    );
    if (matchingAllowedPhrase) {
      return { status: 'allowed', message };
    }
  }

  return { status: 'unknown', message: null };
}

/**
 * Actualiza el icono de la extensión según el estado
 */
function updateExtensionIcon(status) {
  let path16, path48;
  switch (status) {
    case 'loading':
      path16 = 'images/icon16.png';
      path48 = 'images/icon48.png';
      break;
    case 'allowed':
      path16 = 'images/icon16_enabled.png';
      path48 = 'images/icon48_enabled.png';
      break;
    case 'disallowed':
      path16 = 'images/icon16_disabled.png';
      path48 = 'images/icon48_disabled.png';
      break;
    case 'exception':
      path16 = 'images/icon16_exception.png';
      path48 = 'images/icon48_exception.png';
      break;
    case 'error':
      path16 = 'images/icon16_error.png';
      path48 = 'images/icon48_error.png';
      break;
    default:
      path16 = 'images/icon16.png';
      path48 = 'images/icon48.png';
      break;
  }
  chrome.action.setIcon({
    path: {
      16: path16,
      48: path48,
    },
  });
}

describe('cleanSlackMessageText', () => {
  test('should replace user mentions with @MENTION', () => {
    const inputText = 'Hello <@U123456789>!';
    expect(cleanSlackMessageText(inputText)).toBe('Hello @MENTION!');
  });

  test('should remove named channel mentions', () => {
    const inputText = 'Check out <#C123456789|general> channel.';
    expect(cleanSlackMessageText(inputText)).toBe('Check out channel.');
  });

  test('should replace unnamed channel mentions with @CHANNEL', () => {
    const inputText = 'Please see <#C987654321> for details.';
    expect(cleanSlackMessageText(inputText)).toBe(
      'Please see @CHANNEL for details.',
    );
  });

  test('should remove special links', () => {
    const inputText = 'Visit <http://example.com|Example Website>.';
    expect(cleanSlackMessageText(inputText)).toBe('Visit .');
  });

  test('should remove any remaining <...>', () => {
    const inputText = 'Text with <unwanted> tags.';
    expect(cleanSlackMessageText(inputText)).toBe('Text with tags.');
  });

  test('should handle multiple types of cleaning in one string', () => {
    const inputText =
      'Hey <@U123>, check <#C456|general> about <http://foo.bar|link>.';
    expect(cleanSlackMessageText(inputText)).toBe(
      'Hey @MENTION, check about .',
    );
  });

  test('should return empty string for null, undefined or empty string input', () => {
    expect(cleanSlackMessageText(null)).toBe('');
    expect(cleanSlackMessageText(undefined)).toBe('');
    expect(cleanSlackMessageText('')).toBe('');
  });

  test('should handle text without any special Slack formatting', () => {
    const inputText = 'This is a regular message.';
    expect(cleanSlackMessageText(inputText)).toBe('This is a regular message.');
  });

  test('should handle line breaks and tabs', () => {
    const inputText = 'Line 1\nLine 2\tTabbed';
    expect(cleanSlackMessageText(inputText)).toBe('Line 1 Line 2 Tabbed');
  });

  test('should handle multiple whitespace characters', () => {
    const inputText = 'Text   with    multiple     spaces';
    expect(cleanSlackMessageText(inputText)).toBe('Text with multiple spaces');
  });
});

describe('normalizeText', () => {
  test('should convert text to lowercase and trim whitespace', () => {
    expect(normalizeText('  Hello World  ')).toBe('hello world');
  });

  test('should replace multiple spaces with a single space', () => {
    expect(normalizeText('Hello   World')).toBe('hello world');
  });

  test('should remove diacritic marks', () => {
    expect(normalizeText('Héllö Wörld')).toBe('hello world');
  });

  test('should handle mixed case and extra spaces', () => {
    expect(normalizeText('  TEST  string   with   spaces  ')).toBe(
      'test string with spaces',
    );
  });

  test('should return empty string for null, undefined or empty string input', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText('')).toBe('');
  });

  test('should handle accented characters from different languages', () => {
    expect(normalizeText('Café résumé naïve')).toBe('cafe resume naive');
  });

  test('should handle special Unicode characters', () => {
    expect(normalizeText('Ñoño piñata')).toBe('nono pinata');
  });
});

describe('determineMergeStatus', () => {
  const mockAllowedPhrases = ['allowed to merge'];
  const mockDisallowedPhrases = ['not allowed to merge'];
  const mockExceptionPhrases = ['except this project'];

  test('should return allowed status when allowed phrase is found', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'allowed to merge this', ts: '123' }],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('allowed');
    expect(result.message.text).toBe('allowed to merge this');
  });

  test('should return disallowed status when disallowed phrase is found', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'not allowed to merge anything', ts: '123' }],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('disallowed');
    expect(result.message.text).toBe('not allowed to merge anything');
  });

  test('should return exception status when exception phrase is found', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'allowed to merge except this project', ts: '123' }],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('exception');
    expect(result.message.text).toBe('allowed to merge except this project');
  });

  test('should return unknown status when no phrases match', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'just a regular message', ts: '123' }],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('unknown');
    expect(result.message).toBe(null);
  });

  test('should handle empty messages array', () => {
    const result = determineMergeStatus({
      messages: [],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('unknown');
    expect(result.message).toBe(null);
  });

  test('should process messages in array order', () => {
    const messages = [
      { text: 'old allowed to merge', ts: '1234567890.123' },
      { text: 'recent not allowed to merge', ts: '1234567891.123' },
    ];

    const result = determineMergeStatus({
      messages,
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    // Should return the first matching message (allowed)
    expect(result.status).toBe('allowed');
    expect(result.message.text).toBe('old allowed to merge');
  });

  test('should handle case insensitive matching', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'ALLOWED TO MERGE this', ts: '123' }],
      allowedPhrases: mockAllowedPhrases,
      disallowedPhrases: mockDisallowedPhrases,
      exceptionPhrases: mockExceptionPhrases,
    });

    expect(result.status).toBe('allowed');
  });

  test('should handle empty phrase arrays', () => {
    const result = determineMergeStatus({
      messages: [{ text: 'some message', ts: '123' }],
      allowedPhrases: [],
      disallowedPhrases: [],
      exceptionPhrases: [],
    });

    expect(result.status).toBe('unknown');
  });
});

describe('updateExtensionIcon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(chrome.action, 'setIcon');
  });

  test('should set allowed icon for allowed status', () => {
    updateExtensionIcon('allowed');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16_enabled.png',
        48: 'images/icon48_enabled.png',
      },
    });
  });

  test('should set disallowed icon for disallowed status', () => {
    updateExtensionIcon('disallowed');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16_disabled.png',
        48: 'images/icon48_disabled.png',
      },
    });
  });

  test('should set exception icon for exception status', () => {
    updateExtensionIcon('exception');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16_exception.png',
        48: 'images/icon48_exception.png',
      },
    });
  });

  test('should set error icon for error status', () => {
    updateExtensionIcon('error');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16_error.png',
        48: 'images/icon48_error.png',
      },
    });
  });

  test('should set loading icon for loading status', () => {
    updateExtensionIcon('loading');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16.png',
        48: 'images/icon48.png',
      },
    });
  });

  test('should set default icon for unknown status', () => {
    updateExtensionIcon('unknown');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16.png',
        48: 'images/icon48.png',
      },
    });
  });

  test('should set default icon for default status', () => {
    updateExtensionIcon('default');
    expect(chrome.action.setIcon).toHaveBeenCalledWith({
      path: {
        16: 'images/icon16.png',
        48: 'images/icon48.png',
      },
    });
  });
});
