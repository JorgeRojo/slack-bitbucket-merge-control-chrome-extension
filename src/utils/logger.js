import { ErrorHandler } from './errorHandler.js';

export class Logger {
  static log(...args) {
    console.log(...args);
  }

  static error(error, component = 'General', context = {}) {
    return ErrorHandler.handle(error, { component, context });
  }
}

export default Logger;
