import { vi } from 'vitest';

export const Logger = {
  log: vi.fn(),
  error: vi.fn().mockImplementation(() => ({ silenced: false })),
};

export default Logger;
