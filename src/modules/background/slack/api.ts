import {
  ERROR_MESSAGES,
  SLACK_AUTH_TEST_URL,
  SLACK_CONVERSATIONS_INFO_URL,
  SLACK_CONVERSATIONS_LIST_URL,
} from '@src/modules/common/constants';
import { SlackChannel, SlackConversationsListResponse } from '@src/modules/common/types/slack';
import { Logger } from '@src/modules/common/utils/Logger';
import { toErrorType } from '@src/modules/common/utils/type-helpers';

/**
 * Fetches all channels (both public and private) from Slack API
 */
export async function fetchAllChannels(slackToken: string): Promise<SlackChannel[]> {
  const channelTypes = ['public_channel', 'private_channel'];
  const promises = channelTypes.map(type =>
    fetch(`${SLACK_CONVERSATIONS_LIST_URL}?types=${type}`, {
      headers: { Authorization: `Bearer ${slackToken}` },
    }).then(res => res.json() as Promise<SlackConversationsListResponse>)
  );

  const results = await Promise.allSettled(promises);

  let allChannels: SlackChannel[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.ok && result.value.channels) {
      allChannels = allChannels.concat(result.value.channels);
    }
  }

  return allChannels;
}

/**
 * Resolves a channel name to its ID, using cache when possible
 */
export async function resolveChannelId(slackToken: string, channelName: string): Promise<string> {
  let { channelId, cachedChannelName } = await chrome.storage.local.get([
    'channelId',
    'cachedChannelName',
  ]);

  if (cachedChannelName !== channelName) {
    channelId = undefined;
  }

  if (!channelId) {
    const allChannels = await fetchAllChannels(slackToken);
    const foundChannel = allChannels.find(c => c.name === channelName);

    if (!foundChannel) {
      throw new Error(ERROR_MESSAGES.CHANNEL_NOT_FOUND);
    }

    channelId = foundChannel.id;
    await chrome.storage.local.set({
      channelId,
      cachedChannelName: channelName,
    });
  }
  return channelId;
}

/**
 * Fetches and stores the team ID from Slack API
 */
export async function fetchAndStoreTeamId(slackToken: string): Promise<void> {
  try {
    const response = await fetch(SLACK_AUTH_TEST_URL, {
      headers: { Authorization: `Bearer ${slackToken}` },
    });
    const data = await response.json();
    if (data.ok) {
      await chrome.storage.local.set({ teamId: data.team_id });
    } else {
      // Log an error if the API response is not ok
      Logger.error(toErrorType(new Error(data.error || 'Unknown error during auth.test')));
    }
  } catch (error) {
    Logger.error(toErrorType(error));
  }
}

/**
 * Fetches channel information from Slack API
 */
export async function fetchChannelInfo(slackToken: string, channelId: string): Promise<any> {
  const response = await fetch(`${SLACK_CONVERSATIONS_INFO_URL}?channel=${channelId}`, {
    headers: { Authorization: `Bearer ${slackToken}` },
  });
  return await response.json();
}
