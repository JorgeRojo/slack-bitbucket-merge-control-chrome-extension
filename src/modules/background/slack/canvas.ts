import { resolveChannelId } from '@src/modules/background/slack/api';
import { fetchAndStoreMessages } from '@src/modules/background/slack/messages';
import { SLACK_CANVAS_GET_DOCUMENT_URL } from '@src/modules/common/constants';
import { Logger } from '@src/modules/common/utils/Logger';
import { toErrorType } from '@src/modules/common/utils/type-helpers';

/**
 * Fetches canvas content from Slack API
 */
export async function fetchCanvasContent(
  slackToken: string,
  canvasId: string
): Promise<string | null> {
  try {
    const response = await fetch(`${SLACK_CANVAS_GET_DOCUMENT_URL}?file=${canvasId}`, {
      headers: { Authorization: `Bearer ${slackToken}` },
    });
    const data = await response.json();

    if (data.ok && data.file && data.file.title_blocks) {
      const titleBlocks = data.file.title_blocks;

      const extractTextFromRichText = (elements: any[]): string => {
        return elements
          .map((element: any) => {
            if (element.type === 'text' && element.text) {
              return element.text;
            } else if (element.type === 'rich_text_section' && element.elements) {
              return extractTextFromRichText(element.elements);
            } else if (element.type === 'rich_text_list' && element.elements) {
              return extractTextFromRichText(element.elements);
            } else if (element.type === 'rich_text_preformatted' && element.elements) {
              return extractTextFromRichText(element.elements);
            } else if (element.type === 'rich_text_quote' && element.elements) {
              return extractTextFromRichText(element.elements);
            }
            return '';
          })
          .join('\n');
      };

      const canvasText = titleBlocks
        .map((block: any) => {
          if (block.type === 'rich_text' && block.elements) {
            return extractTextFromRichText(block.elements);
          } else if (block.type === 'text' && block.text) {
            return block.text;
          }
          return '';
        })
        .join('\n');
      return canvasText;
    }
    return null;
  } catch (error) {
    Logger.error(toErrorType(error), 'fetchCanvasContent', {
      canvasId,
    });
    return null;
  }
}

/**
 * Handles canvas changed events from Slack
 */
export async function handleCanvasChangedEvent(fileId: string): Promise<void> {
  const { slackToken, channelName } = await chrome.storage.sync.get(['slackToken', 'channelName']);

  if (slackToken && channelName) {
    const channelId = await resolveChannelId(slackToken, channelName);
    if (channelId) {
      await fetchAndStoreMessages(slackToken, channelId, fileId);
    }
  }
}
