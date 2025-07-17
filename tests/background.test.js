import { cleanSlackMessageText, normalizeText } from '../src/background.js';

describe('cleanSlackMessageText', () => {
  test('should replace user mentions with @MENTION', () => {
    const inputText = 'Hello <@U123456789>!';
    expect(cleanSlackMessageText(inputText)).toBe('Hello @MENTION!');
  });

  test('should remove named channel mentions', () => {
    const inputText = 'Check out <#C123456789|general> channel.';
    expect(cleanSlackMessageText(inputText)).toBe('Check out channel.');
  });

  test('should replace unnamed channel mentions with @CHANNEL', () => {
    const inputText = 'Please see <#C987654321> for details.';
    expect(cleanSlackMessageText(inputText)).toBe(
      'Please see @CHANNEL for details.',
    );
  });

  test('should remove special links', () => {
    const inputText = 'Visit <http://example.com|Example Website>.';
    expect(cleanSlackMessageText(inputText)).toBe('Visit .');
  });

  test('should remove any remaining <...>', () => {
    const inputText = 'Text with <unwanted> tags.';
    expect(cleanSlackMessageText(inputText)).toBe('Text with tags.');
  });

  test('should handle multiple types of cleaning in one string', () => {
    const inputText = 'Hey <@U123>, check <#C456|general> about <http://foo.bar|link>.';
    expect(cleanSlackMessageText(inputText)).toBe(
      'Hey @MENTION, check about .',
    );
  });

  test('should return empty string for null, undefined or empty string input', () => {
    expect(cleanSlackMessageText(null)).toBe('');
    expect(cleanSlackMessageText(undefined)).toBe('');
    expect(cleanSlackMessageText('')).toBe('');
  });

  test('should handle text without any special Slack formatting', () => {
    const inputText = 'This is a regular message.';
    expect(cleanSlackMessageText(inputText)).toBe('This is a regular message.');
  });
});

describe('normalizeText', () => {
  test('should convert text to lowercase and trim whitespace', () => {
    expect(normalizeText('  Hello World  ')).toBe('hello world');
  });

  test('should replace multiple spaces with a single space', () => {
    expect(normalizeText('Hello   World')).toBe('hello world');
  });

  test('should remove diacritic marks', () => {
    expect(normalizeText('Héllö Wörld')).toBe('hello world');
  });

  test('should handle mixed case and extra spaces', () => {
    expect(normalizeText('  TEST  string   with   spaces  ')).toBe('test string with spaces');
  });

  test('should return empty string for null, undefined or empty string input', () => {
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
    expect(normalizeText('')).toBe('');
  });
});