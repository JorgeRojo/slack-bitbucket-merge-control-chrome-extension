import { USER_ERROR_MESSAGES } from './constants.js';

export const literals = {
  popup: {
    emojiAllowed: '✅',
    emojiDisallowed: '❌',
    emojiException: '⚠️',
    emojiUnknown: '❓',

    textWaitingMessages: 'Waiting for messages...',
    textAllowedWithExceptions: 'Allowed with exceptions',
    textMergeAllowed: 'Merge allowed',
    textMergeNotAllowed: 'Merge not allowed',
    textCouldNotDetermineStatus: USER_ERROR_MESSAGES.COULD_NOT_DETERMINE_STATUS,
    textConfigNeeded: USER_ERROR_MESSAGES.CONFIG_NEEDED,
    textErrorProcessingMessages: USER_ERROR_MESSAGES.ERROR_PROCESSING_MESSAGES,
    textChannelNotFound: USER_ERROR_MESSAGES.CHANNEL_NOT_FOUND,
    textCouldNotDetermine: 'Could not determine',

    errorDetails: {
      slackTokenMissing: USER_ERROR_MESSAGES.SLACK_TOKEN_MISSING,
      appTokenMissing: USER_ERROR_MESSAGES.APP_TOKEN_MISSING,
      channelNameMissing: USER_ERROR_MESSAGES.CHANNEL_NAME_MISSING,
      configurationIncomplete: USER_ERROR_MESSAGES.CONFIGURATION_INCOMPLETE,
    },
  },
  options: {
    textOptionsSaved: 'Options saved.',
    textFillAllFields: USER_ERROR_MESSAGES.FILL_ALL_FIELDS,
  },
};
