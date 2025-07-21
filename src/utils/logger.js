import { ErrorHandler } from './errorHandler.js';

export class Logger {
  static log(...args) {
    console.log(...args);
  }

  static error(error, component = 'General', context = {}) {
    const { silentMessages, ...restContext } = context;
    return ErrorHandler.handle(error, {
      component,
      context: restContext,
      silentMessages: silentMessages || [],
    });
  }
}

export default Logger;
