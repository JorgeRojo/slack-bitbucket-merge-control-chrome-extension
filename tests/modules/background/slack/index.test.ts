import * as slackIndex from '@src/modules/background/slack';
import * as slackApi from '@src/modules/background/slack/api';
import * as slackCanvas from '@src/modules/background/slack/canvas';
import * as slackErrorHandler from '@src/modules/background/slack/error-handler';
import * as slackMessages from '@src/modules/background/slack/messages';
import { describe, expect, test } from 'vitest';

describe('Slack Index', () => {
  test('should export all API functions', () => {
    expect(slackIndex.fetchAllChannels).toBe(slackApi.fetchAllChannels);
    expect(slackIndex.resolveChannelId).toBe(slackApi.resolveChannelId);
    expect(slackIndex.fetchAndStoreTeamId).toBe(slackApi.fetchAndStoreTeamId);
    expect(slackIndex.fetchChannelInfo).toBe(slackApi.fetchChannelInfo);
  });

  test('should export all message functions', () => {
    expect(slackIndex.cleanSlackMessageText).toBe(slackMessages.cleanSlackMessageText);
    expect(slackIndex.processAndStoreMessage).toBe(slackMessages.processAndStoreMessage);
    expect(slackIndex.determineAndFetchCanvasContent).toBe(
      slackMessages.determineAndFetchCanvasContent
    );
    expect(slackIndex.fetchAndStoreMessages).toBe(slackMessages.fetchAndStoreMessages);
  });

  test('should export all canvas functions', () => {
    expect(slackIndex.fetchCanvasContent).toBe(slackCanvas.fetchCanvasContent);
    expect(slackIndex.handleCanvasChangedEvent).toBe(slackCanvas.handleCanvasChangedEvent);
  });

  test('should export all error handler functions', () => {
    expect(slackIndex.handleSlackApiError).toBe(slackErrorHandler.handleSlackApiError);
  });
});
