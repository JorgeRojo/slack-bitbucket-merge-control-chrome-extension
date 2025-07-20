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
    textCouldNotDetermineStatus: 'Could not determine status',
    textConfigNeeded: 'Slack token or channel name not configured.',
    textErrorProcessingMessages: 'Error processing messages',
    textChannelNotFound: 'Channel not found or bot is not in channel.',
    textCouldNotDetermine: 'Could not determine',

    // Detailed error messages
    errorDetails: {
      slackTokenMissing:
        'Slack Bot Token is missing. Please add it in the options page.',
      appTokenMissing:
        'Slack App Token is missing. Please add it in the options page.',
      channelNameMissing:
        'Channel name is missing. Please add it in the options page.',
      configurationIncomplete:
        'Configuration is incomplete. Please check all required fields in the options page.',
    },
  },
  options: {
    textOptionsSaved: 'Options saved.',
    textFillAllFields: 'Please fill in all fields.',
  },
};
