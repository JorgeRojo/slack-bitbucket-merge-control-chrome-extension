export class ErrorHandler {
  static handle(error, options = {}) {
    const { component = 'General', context = {}, callback = null } = options;

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

    return { error, context };
  }
}

export default ErrorHandler;
