import { getPhrasesFromStorage } from '@src/modules/background/config';
import { normalizeText } from '@src/modules/background/text-utils';
import { MERGE_STATUS } from '@src/modules/common/constants';
import { MergeDecisionSource, ProcessedMessage } from '@src/modules/common/types/app';

interface DetermineMergeStatusParams {
  messages: ProcessedMessage[];
  allowedPhrases: string[];
  disallowedPhrases: string[];
  exceptionPhrases: string[];
  canvasContent?: string | null;
}

interface DetermineMergeStatusResult {
  status: MERGE_STATUS;
  message: ProcessedMessage | null;
  source: MergeDecisionSource;
  canvasContent?: string | null;
}

/**
 * Determines the merge status based on messages and canvas content
 */
export function determineMergeStatus({
  messages,
  allowedPhrases,
  disallowedPhrases,
  exceptionPhrases,
  canvasContent,
}: DetermineMergeStatusParams): DetermineMergeStatusResult {
  const normalizedAllowedPhrases = allowedPhrases.map(normalizeText);
  const normalizedDisallowedPhrases = disallowedPhrases.map(normalizeText);
  const normalizedExceptionPhrases = exceptionPhrases.map(normalizeText);

  // Prioritize Canvas content if available
  if (canvasContent) {
    const normalizedCanvasContent = normalizeText(canvasContent);

    const matchingExceptionPhrase = normalizedExceptionPhrases.find(keyword =>
      normalizedCanvasContent.includes(keyword)
    );
    if (matchingExceptionPhrase) {
      return {
        status: MERGE_STATUS.EXCEPTION,
        message: null,
        source: 'canvas',
        canvasContent,
      };
    }

    const matchingDisallowedPhrase = normalizedDisallowedPhrases.find(keyword =>
      normalizedCanvasContent.includes(keyword)
    );
    if (matchingDisallowedPhrase) {
      return {
        status: MERGE_STATUS.DISALLOWED,
        message: null,
        source: 'canvas',
        canvasContent,
      };
    }

    const matchingAllowedPhrase = normalizedAllowedPhrases.find(keyword =>
      normalizedCanvasContent.includes(keyword)
    );
    if (matchingAllowedPhrase) {
      return {
        status: MERGE_STATUS.ALLOWED,
        message: null,
        source: 'canvas',
        canvasContent,
      };
    }
  }

  // Fallback to messages if no decision from Canvas
  for (const message of messages) {
    const normalizedMessageText = normalizeText(message.text);

    const matchingExceptionPhrase = normalizedExceptionPhrases.find(keyword =>
      normalizedMessageText.includes(keyword)
    );
    if (matchingExceptionPhrase) {
      return { status: MERGE_STATUS.EXCEPTION, message, source: 'message' };
    }

    const matchingDisallowedPhrase = normalizedDisallowedPhrases.find(keyword =>
      normalizedMessageText.includes(keyword)
    );
    if (matchingDisallowedPhrase) {
      return { status: MERGE_STATUS.DISALLOWED, message, source: 'message' };
    }

    const matchingAllowedPhrase = normalizedAllowedPhrases.find(keyword =>
      normalizedMessageText.includes(keyword)
    );
    if (matchingAllowedPhrase) {
      return { status: MERGE_STATUS.ALLOWED, message, source: 'message' };
    }
  }

  return { status: MERGE_STATUS.UNKNOWN, message: null, source: 'message' };
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
