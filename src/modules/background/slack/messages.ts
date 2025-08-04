import { updateIconBasedOnCurrentMessages } from '@src/modules/background/app-state';
import { updateContentScriptMergeState } from '@src/modules/background/bitbucket';
import { getPhrasesFromStorage } from '@src/modules/background/config';
import { determineMergeStatus } from '@src/modules/background/message-analysis';
import { fetchChannelInfo } from '@src/modules/background/slack/api';
import { fetchCanvasContent } from '@src/modules/background/slack/canvas';
import { MAX_MESSAGES, SLACK_CONVERSATIONS_HISTORY_URL } from '@src/modules/common/constants';
import { ProcessedMessage } from '@src/modules/common/types/app';
import { SlackMessage } from '@src/modules/common/types/slack';

/**
 * Cleans Slack message text by removing formatting and special characters
 */
export function cleanSlackMessageText(text: string | undefined): string {
  if (!text) return '';

  const NEWLINES_AND_TABS_REGEX = /[\n\r\t]+/g;
  const USER_MENTION_REGEX = /<@[^>]+>/g;
  const CHANNEL_MENTION_REGEX = /<#[^>]+>/g;
  const SLACK_LINK_REGEX = /<([^|>]+)\|([^>]+)>/g; // Matches <URL|text> and captures URL and text
  const REMAINING_BRACKETS_REGEX = /<[^>]+>/g; // Catches any other <...> patterns
  const MULTIPLE_WHITESPACE_REGEX = /\s+/g;

  let cleanedText = text.replace(NEWLINES_AND_TABS_REGEX, ' ');
  cleanedText = cleanedText.replace(USER_MENTION_REGEX, '@MENTION');
  cleanedText = cleanedText.replace(CHANNEL_MENTION_REGEX, '@CHANNEL');
  cleanedText = cleanedText.replace(SLACK_LINK_REGEX, '$2'); // Replace with captured link text
  cleanedText = cleanedText.replace(REMAINING_BRACKETS_REGEX, '');
  cleanedText = cleanedText.replace(MULTIPLE_WHITESPACE_REGEX, ' ').trim();
  return cleanedText;
}

/**
 * Processes and stores a new Slack message
 */
export async function processAndStoreMessage(message: SlackMessage): Promise<void> {
  if (!message.ts || !message.text) {
    return;
  }

  const messageTs = String(Math.floor(Number(message.ts) * 1000));

  let messages = (await chrome.storage.local.get('messages')).messages || [];

  // Check for duplicate messages before adding
  const isDuplicate = messages.some(
    (existingMsg: ProcessedMessage) => existingMsg.ts === messageTs
  );
  if (isDuplicate) {
    return;
  }

  messages.push({
    text: cleanSlackMessageText(message.text),
    ts: messageTs,
    user: message.user,
  });

  messages.sort((a: ProcessedMessage, b: ProcessedMessage) => Number(b.ts) - Number(a.ts));

  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(0, MAX_MESSAGES);
  }

  await chrome.storage.local.set({
    messages: messages,
  });

  const { currentAllowedPhrases, currentDisallowedPhrases, currentExceptionPhrases } =
    await getPhrasesFromStorage();

  const { message: matchingMessage } = determineMergeStatus({
    messages: messages,
    allowedPhrases: currentAllowedPhrases,
    disallowedPhrases: currentDisallowedPhrases,
    exceptionPhrases: currentExceptionPhrases,
  });

  await chrome.storage.local.set({ lastMatchingMessage: matchingMessage });

  await updateIconBasedOnCurrentMessages();
}

/**
 * Determines and fetches canvas content based on file ID or channel info
 */
export async function determineAndFetchCanvasContent(
  slackToken: string,
  canvasFileId: string | undefined,
  channelInfoResponse: any
): Promise<{ content: string; ts: string } | null> {
  let determinedCanvasId: string | null = null;

  if (canvasFileId) {
    determinedCanvasId = canvasFileId;
  } else if (
    channelInfoResponse.ok &&
    channelInfoResponse.channel?.properties?.tabs?.[0]?.data?.file_id
  ) {
    determinedCanvasId = channelInfoResponse.channel.properties.tabs[0].data.file_id;
  }

  return determinedCanvasId ? await fetchCanvasContent(slackToken, determinedCanvasId) : null;
}

/**
 * Fetches and stores messages from a Slack channel
 */
export async function fetchAndStoreMessages(
  slackToken: string,
  channelId: string,
  canvasFileId?: string
): Promise<void> {
  if (!channelId) {
    return;
  }

  await chrome.storage.local.set({ lastMatchingMessage: null });

  const results = await Promise.allSettled([
    fetch(`${SLACK_CONVERSATIONS_HISTORY_URL}?channel=${channelId}&limit=${MAX_MESSAGES}`, {
      headers: { Authorization: `Bearer ${slackToken}` },
    }).then(res => res.json()),
    fetchChannelInfo(slackToken, channelId),
  ]);

  const historyResponse =
    results[0].status === 'fulfilled'
      ? results[0].value
      : { ok: false, error: 'Failed to fetch history' };

  const channelInfoResponse = results[1].status === 'fulfilled' ? results[1].value : { ok: false };

  const canvasData = await determineAndFetchCanvasContent(
    slackToken,
    canvasFileId,
    channelInfoResponse
  );

  if (historyResponse.ok) {
    let allMessages = historyResponse.messages.map((msg: SlackMessage) => ({
      text: cleanSlackMessageText(msg.text),
      ts: String(Math.floor(Number(msg.ts) * 1000)),
      user: msg.user,
    }));

    if (canvasData) {
      // Assign a new timestamp to canvasData.ts that is slightly greater than the current time
      canvasData.ts = String(Date.now() + 1);

      allMessages.push({
        text: cleanSlackMessageText(canvasData.content),
        ts: canvasData.ts,
        user: 'canvas',
      });
    }

    allMessages.sort((a: ProcessedMessage, b: ProcessedMessage) => Number(b.ts) - Number(a.ts));

    // Filter out duplicate messages based on timestamp
    const uniqueMessages = allMessages.filter(
      (message: { ts: number }, index: number, self: any[]) =>
        index === self.findIndex((m: { ts: number }) => Number(m.ts) === Number(message.ts))
    );

    if (uniqueMessages.length > MAX_MESSAGES) {
      allMessages = uniqueMessages.slice(0, MAX_MESSAGES);
    } else {
      allMessages = uniqueMessages;
    }

    await chrome.storage.local.set({ messages: allMessages });

    const { currentAllowedPhrases, currentDisallowedPhrases, currentExceptionPhrases } =
      await getPhrasesFromStorage();

    const { message: determinedMessage } = determineMergeStatus({
      messages: allMessages,
      allowedPhrases: currentAllowedPhrases,
      disallowedPhrases: currentDisallowedPhrases,
      exceptionPhrases: currentExceptionPhrases,
    });

    await chrome.storage.local.set({
      lastMatchingMessage: determinedMessage,
    });

    await updateIconBasedOnCurrentMessages();

    const { channelName } = await chrome.storage.sync.get('channelName');
    await updateContentScriptMergeState(channelName);
  } else {
    throw new Error(historyResponse.error);
  }
}
