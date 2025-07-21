export class ErrorHandler {
  static handle(error, options = {}) {
    const {
      component = 'General',
      context = {},
      callback = null,
      silentMessages = [],
    } = options;

    const errorMessage = error instanceof Error ? error.message : String(error);

    const shouldSilence = silentMessages.some((silentMsg) =>
      errorMessage.includes(silentMsg),
    );

    if (shouldSilence) {
      return { error, context, silenced: true };
    }

    console.error(`[${component}]`, error);

    if (Object.keys(context).length > 0) {
      console.error('Context:', context);
    }

    if (callback && typeof callback === 'function') {
      try {
        callback(error, context);
      } catch (callbackError) {
        console.error('Error in error handler callback:', callbackError);
      }
    }

    return { error, context, silenced: false };
  }
}

export default ErrorHandler;
