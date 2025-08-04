import { fetchCanvasContent } from '@src/modules/background/slack/canvas';
import { Logger } from '@src/modules/common/utils/Logger';
import { mockFetchResponses } from '@tests/setup';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// Mock dependencies
vi.mock('@src/modules/common/utils/Logger', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Slack Canvas Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchCanvasContent', () => {
    test('should fetch and return canvas content and timestamp successfully', async () => {
      mockFetchResponses([
        {
          response: {
            ok: true,
            file: {
              updated: 1678886400,
              title_blocks: [
                { type: 'rich_text', elements: [{ type: 'text', text: 'Canvas Content 1' }] },
                { type: 'text', text: 'Canvas Content 2' },
              ],
              blocks: [
                {
                  type: 'section',
                  elements: [
                    { type: 'rich_text', elements: [{ type: 'text', text: 'Section Content' }] },
                  ],
                },
                {
                  type: 'rich_text_list',
                  elements: [
                    {
                      type: 'rich_text_list_item',
                      elements: [{ type: 'text', text: 'List Item' }],
                    },
                  ],
                },
                {
                  type: 'rich_text_preformatted',
                  elements: [{ type: 'text', text: 'Preformatted Text' }],
                },
                {
                  type: 'rich_text_quote',
                  elements: [{ type: 'text', text: 'Quoted Text' }],
                },
              ],
            },
          },
        },
      ]);

      const result = await fetchCanvasContent('token', 'canvasId');
      expect(result).toEqual({
        content: `Canvas Content 1
Canvas Content 2
Section Content
List Item
Preformatted Text
Quoted Text`,
        ts: '1678886400000',
      });
    });

    test('should return null if fetch fails', async () => {
      mockFetchResponses([
        {
          response: { ok: false, error: 'fetch error' },
        },
      ]);

      const content = await fetchCanvasContent('token', 'canvasId');
      expect(content).toBeNull();
    });

    test('should return null if data.ok is false', async () => {
      mockFetchResponses([
        {
          response: { ok: false, error: 'slack error' },
        },
      ]);

      const content = await fetchCanvasContent('token', 'canvasId');
      expect(content).toBeNull();
    });

    test('should return null if file or title_blocks are missing', async () => {
      mockFetchResponses([
        {
          response: { ok: true, file: {} },
        },
      ]);

      const content = await fetchCanvasContent('token', 'canvasId');
      expect(content).toBeNull();
    });

    test('should handle network error', async () => {
      mockFetchResponses([
        {
          mustReject: true,
        },
      ]);

      const content = await fetchCanvasContent('test-token', 'test-canvasId');

      expect(content).toBeNull();
      expect(Logger.error).toHaveBeenCalledWith(expect.any(Error), 'fetchCanvasContent', {
        canvasId: 'test-canvasId',
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith('https://slack.com/api/files.info?file=test-canvasId', {
        headers: {
          Authorization: 'Bearer test-token',
        },
      });
    });
  });
});
