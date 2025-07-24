import { ERROR_MESSAGES } from '@src/modules/common/constants';

interface ErrorHandlerOptions {
  component?: string;
  context?: Record<string, any>;
  callback?: ((error: Error | string, context: Record<string, any>) => void) | null;
  silentMessages?: string[];
}

interface ErrorHandlerResult {
  error: Error | string;
  context: Record<string, any>;
  silenced: boolean;
}

export class ErrorHandler {
  static handle(error: Error | string, options: ErrorHandlerOptions = {}): ErrorHandlerResult {
    const { component = 'General', context = {}, callback = null, silentMessages = [] } = options;

    const errorMessage = error instanceof Error ? error.message : String(error);

    const shouldSilence = silentMessages.some(silentMsg => errorMessage.includes(silentMsg));

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
        console.error(ERROR_MESSAGES.IN_CALLBACK, callbackError);
      }
    }

    return { error, context, silenced: false };
  }
}

export default ErrorHandler;
