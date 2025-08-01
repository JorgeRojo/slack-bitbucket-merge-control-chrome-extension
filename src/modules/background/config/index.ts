import {
  DEFAULT_ALLOWED_PHRASES,
  DEFAULT_DISALLOWED_PHRASES,
  DEFAULT_EXCEPTION_PHRASES,
} from '@src/modules/common/constants';

/**
 * Gets phrases from storage or returns defaults
 */
export async function getPhrasesFromStorage(): Promise<{
  currentAllowedPhrases: string[];
  currentDisallowedPhrases: string[];
  currentExceptionPhrases: string[];
}> {
  try {
    const result = await chrome.storage.sync.get([
      'allowedPhrases',
      'disallowedPhrases',
      'exceptionPhrases',
    ]);

    const { allowedPhrases, disallowedPhrases, exceptionPhrases } = result || {};

    const currentAllowedPhrases =
      allowedPhrases && allowedPhrases.trim() ? allowedPhrases.split(',') : DEFAULT_ALLOWED_PHRASES;

    const currentDisallowedPhrases =
      disallowedPhrases && disallowedPhrases.trim()
        ? disallowedPhrases.split(',')
        : DEFAULT_DISALLOWED_PHRASES;

    const currentExceptionPhrases =
      exceptionPhrases && exceptionPhrases.trim()
        ? exceptionPhrases.split(',')
        : DEFAULT_EXCEPTION_PHRASES;

    return {
      currentAllowedPhrases,
      currentDisallowedPhrases,
      currentExceptionPhrases,
    };
  } catch (_error) {
    return {
      currentAllowedPhrases: DEFAULT_ALLOWED_PHRASES,
      currentDisallowedPhrases: DEFAULT_DISALLOWED_PHRASES,
      currentExceptionPhrases: DEFAULT_EXCEPTION_PHRASES,
    };
  }
}
