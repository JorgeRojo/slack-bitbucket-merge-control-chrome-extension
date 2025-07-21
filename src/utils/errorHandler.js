export class ErrorHandler {
  static handle(error, options = {}) {
    const { component = 'General', context = {}, callback = null } = options;

    const errorMessage = error instanceof Error ? error.message : error;

    console.error(`[${component}] ${errorMessage}`, { error, context });

    if (callback && typeof callback === 'function') {
      try {
        callback(error, context);
      } catch (callbackError) {
        console.error('Error in error handler callback:', callbackError);
      }
    }

    return { error, context };
  }
}

export default ErrorHandler;
