import { cleanSlackMessageText } from '../background.js';

describe('cleanSlackMessageText', () => {
  test('should replace user mentions with @MENTION', () => {
    const inputText = 'Hello <@U123456789|john.doe>!';
    expect(cleanSlackMessageText(inputText)).toBe('Hello @MENTION!');
  });

  test('should remove channel mentions and keep channel name', () => {
    const inputText = 'Check out <#C123456789|general> channel.';
    expect(cleanSlackMessageText(inputText)).toBe('Check out general channel.');
  });

  test('should remove special links and keep link text', () => {
    const inputText = 'Visit <http://example.com|Example Website>.';
    expect(cleanSlackMessageText(inputText)).toBe('Visit Example Website.');
  });

  test('should remove any remaining <...>', () => {
    const inputText = 'Text with <unwanted> tags.';
    expect(cleanSlackMessageText(inputText)).toBe('Text with tags.');
  });

  test('should handle multiple types of cleaning in one string', () => {
    const inputText =
      'Hey <@U123|user>, check <#C456|dev> about <http://foo.bar|link>.';
    expect(cleanSlackMessageText(inputText)).toBe(
      'Hey @MENTION, check dev about link.',
    );
  });

  test('should return empty string for null or undefined input', () => {
    expect(cleanSlackMessageText(null)).toBe('');
    expect(cleanSlackMessageText(undefined)).toBe('');
  });

  test('should handle empty string input', () => {
    expect(cleanSlackMessageText('')).toBe('');
  });

  test('should handle text without any special Slack formatting', () => {
    const inputText = 'This is a regular message.';
    expect(cleanSlackMessageText(inputText)).toBe('This is a regular message.');
  });
});
