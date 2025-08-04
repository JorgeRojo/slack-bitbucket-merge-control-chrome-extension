import { getPhrasesFromStorage } from '@src/modules/background/config';
import { normalizeText } from '@src/modules/background/text-utils';
import { MERGE_STATUS } from '@src/modules/common/constants';
import { ProcessedMessage } from '@src/modules/common/types/app';

interface DetermineMergeStatusParams {
  messages: ProcessedMessage[];
  allowedPhrases: string[];
  disallowedPhrases: string[];
  exceptionPhrases: string[];
}

interface DetermineMergeStatusResult {
  status: MERGE_STATUS;
  message: ProcessedMessage | null;
}

/**
 * Determines the merge status based on a unified list of messages and canvas content.
 */
export function determineMergeStatus({
  messages,
  allowedPhrases,
  disallowedPhrases,
  exceptionPhrases,
}: DetermineMergeStatusParams): DetermineMergeStatusResult {
  const normalizedAllowedPhrases = allowedPhrases.map(normalizeText);
  const normalizedDisallowedPhrases = disallowedPhrases.map(normalizeText);
  const normalizedExceptionPhrases = exceptionPhrases.map(normalizeText);

  for (const message of messages) {
    const normalizedMessageText = normalizeText(message.text);

    const matchingExceptionPhrase = normalizedExceptionPhrases.find(keyword =>
      normalizedMessageText.includes(keyword)
    );
    if (matchingExceptionPhrase) {
      return { status: MERGE_STATUS.EXCEPTION, message };
    }

    const matchingDisallowedPhrase = normalizedDisallowedPhrases.find(keyword =>
      normalizedMessageText.includes(keyword)
    );
    if (matchingDisallowedPhrase) {
      return { status: MERGE_STATUS.DISALLOWED, message };
    }

    const matchingAllowedPhrase = normalizedAllowedPhrases.find(keyword =>
      normalizedMessageText.includes(keyword)
    );
    if (matchingAllowedPhrase) {
      return { status: MERGE_STATUS.ALLOWED, message };
    }
  }

  return { status: MERGE_STATUS.UNKNOWN, message: null };
}

/**
 * Gets the current merge status from stored messages
 */
export async function getCurrentMergeStatusFromMessages(): Promise<MERGE_STATUS> {
  const { messages = [] } = await chrome.storage.local.get('messages');

  if (messages.length === 0) {
    return MERGE_STATUS.UNKNOWN;
  }

  const { currentAllowedPhrases, currentDisallowedPhrases, currentExceptionPhrases } =
    await getPhrasesFromStorage();

  const { status } = determineMergeStatus({
    messages,
    allowedPhrases: currentAllowedPhrases,
    disallowedPhrases: currentDisallowedPhrases,
    exceptionPhrases: currentExceptionPhrases,
  });

  return status;
}
