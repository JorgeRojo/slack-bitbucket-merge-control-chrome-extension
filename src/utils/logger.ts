import { ErrorHandler } from './errorHandler';

interface ErrorContext {
  silentMessages?: string[];
  [key: string]: any;
}

export class Logger {
  static log(...args: any[]): void {
    console.log(...args);
  }

  static error(
    error: Error | string,
    component: string = 'General',
    context: ErrorContext = {}
  ): void {
    const { silentMessages, ...restContext } = context;
    ErrorHandler.handle(error, {
      component,
      context: restContext,
      silentMessages: silentMessages || [],
    });
  }
}

export default Logger;
