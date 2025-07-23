import { describe, test, expect } from 'vitest';
import {
  toErrorType,
  toString,
  toStringOrUndefined,
  isString,
  isError,
} from '../../src/modules/common/utils/type-helpers';
describe('Type Helpers', () => {
  describe('toErrorType', () => {
    test('should return Error instance as-is', () => {
      const error = new Error('test error');
      expect(toErrorType(error)).toBe(error);
    });
    test('should convert string to Error', () => {
      const result = toErrorType('test error');
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('test error');
    });
    test('should convert unknown values to Error', () => {
      const result = toErrorType(123);
      expect(result).toBeInstanceOf(Error);
      expect(result.message).toBe('123');
    });
    test('should handle null and undefined', () => {
      expect(toErrorType(null).message).toBe('null');
      expect(toErrorType(undefined).message).toBe('undefined');
    });
  });
  describe('toString', () => {
    test('should return string as-is', () => {
      expect(toString('test')).toBe('test');
    });
    test('should convert Error to message', () => {
      const error = new Error('test error');
      expect(toString(error)).toBe('test error');
    });
    test('should convert other types to string', () => {
      expect(toString(123)).toBe('123');
      expect(toString(true)).toBe('true');
      expect(toString(null)).toBe('null');
      expect(toString(undefined)).toBe('undefined');
    });
  });
  describe('toStringOrUndefined', () => {
    test('should return string as-is', () => {
      expect(toStringOrUndefined('test')).toBe('test');
    });
    test('should convert Error to message', () => {
      const error = new Error('test error');
      expect(toStringOrUndefined(error)).toBe('test error');
    });
    test('should convert non-null values to string', () => {
      expect(toStringOrUndefined(123)).toBe('123');
      expect(toStringOrUndefined(true)).toBe('true');
    });
    test('should return undefined for null/undefined', () => {
      expect(toStringOrUndefined(null)).toBeUndefined();
      expect(toStringOrUndefined(undefined)).toBeUndefined();
    });
  });
  describe('isString', () => {
    test('should return true for strings', () => {
      expect(isString('test')).toBe(true);
      expect(isString('')).toBe(true);
    });
    test('should return false for non-strings', () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString({})).toBe(false);
    });
  });
  describe('isError', () => {
    test('should return true for Error instances', () => {
      expect(isError(new Error('test'))).toBe(true);
      expect(isError(new TypeError('test'))).toBe(true);
    });
    test('should return false for non-Error values', () => {
      expect(isError('error')).toBe(false);
      expect(isError(123)).toBe(false);
      expect(isError(null)).toBe(false);
      expect(isError(undefined)).toBe(false);
      expect(isError({})).toBe(false);
    });
  });
});
