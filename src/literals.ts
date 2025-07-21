interface PopupLiterals {
  emojiAllowed: string;
  emojiDisallowed: string;
  emojiException: string;
  emojiUnknown: string;
  textWaitingMessages: string;
  textAllowedWithExceptions: string;
  textMergeAllowed: string;
  textMergeNotAllowed: string;
  textCouldNotDetermineStatus: string;
  textCouldNotDetermine: string;
  errorDetails: {
    appTokenMissing: string;
    channelNameMissing: string;
    channelNotFound: string;
    configIncomplete: string;
    processingMessages: string;
    slackTokenMissing: string;
    textConfigNeeded: string;
  };
}

interface OptionsLiterals {
  textOptionsSaved: string;
  textFillAllFields: string;
}

interface AppLiterals {
  popup: PopupLiterals;
  options: OptionsLiterals;
}

export const literals: AppLiterals = {
  popup: {
    emojiAllowed: '✅',
    emojiDisallowed: '❌',
    emojiException: '⚠️',
    emojiUnknown: '❓',
    textWaitingMessages: 'Waiting for messages...',
    textAllowedWithExceptions: 'Allowed with exceptions',
    textMergeAllowed: 'Merge allowed',
    textMergeNotAllowed: 'Merge not allowed',
    textCouldNotDetermineStatus: 'Could not determine status',
    textCouldNotDetermine: 'Could not determine',
    errorDetails: {
      appTokenMissing: 'Missing Slack App Token. Add in options page',
      channelNameMissing: 'Missing channel name. Add in options page',
      channelNotFound: 'Channel not found or bot is not in channel',
      configIncomplete: 'Incomplete configuration. Check all required fields',
      processingMessages: 'Error processing messages',
      slackTokenMissing: 'Missing Slack Bot Token. Add in options page',
      textConfigNeeded: 'Slack token or channel name not configured',
    },
  },
  options: {
    textOptionsSaved: 'Options saved.',
    textFillAllFields: 'Please fill in all fields',
  },
};
