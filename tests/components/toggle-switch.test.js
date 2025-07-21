import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/components/toggle-switch/toggle-switch.js';

// Mock Logger locally for toggle-switch tests
vi.mock('../../src/utils/logger.js', () => ({
  Logger: {
    log: vi.fn(),
    error: vi.fn(),
  },
}));

import { Logger } from '../../src/utils/logger.js';

global.fetch = vi.fn(() =>
  Promise.resolve({
    text: () => Promise.resolve('/* mocked CSS */'),
  }),
);

const waitForRender = async () => {
  return new Promise((resolve) => setTimeout(resolve, 50));
};

describe('ToggleSwitch Component', () => {
  let toggleSwitch;

  beforeEach(async () => {
    fetch.mockClear();

    toggleSwitch = document.createElement('toggle-switch');
    document.body.appendChild(toggleSwitch);

    await waitForRender();
  });

  afterEach(() => {
    document.body.removeChild(toggleSwitch);
  });

  test('should initialize with default attributes', async () => {
    const input = toggleSwitch.shadowRoot.querySelector('input');
    const label = toggleSwitch.shadowRoot.querySelector('.switch-label');

    expect(input).not.toBeNull();
    expect(input.checked).toBe(false);
    expect(input.disabled).toBe(false);
    expect(label.textContent).toBe('');
  });

  test('should initialize with checked attribute', async () => {
    document.body.removeChild(toggleSwitch);
    toggleSwitch = document.createElement('toggle-switch');
    toggleSwitch.setAttribute('checked', '');
    document.body.appendChild(toggleSwitch);

    await waitForRender();

    const input = toggleSwitch.shadowRoot.querySelector('input');
    expect(input.checked).toBe(true);
  });

  test('should initialize with disabled attribute', async () => {
    document.body.removeChild(toggleSwitch);
    toggleSwitch = document.createElement('toggle-switch');
    toggleSwitch.setAttribute('disabled', '');
    document.body.appendChild(toggleSwitch);

    await waitForRender();

    const input = toggleSwitch.shadowRoot.querySelector('input');
    expect(input.disabled).toBe(true);
  });

  test('should initialize with label attribute', async () => {
    const testLabel = 'Test Label';

    document.body.removeChild(toggleSwitch);
    toggleSwitch = document.createElement('toggle-switch');
    toggleSwitch.setAttribute('label', testLabel);
    document.body.appendChild(toggleSwitch);

    await waitForRender();

    const label = toggleSwitch.shadowRoot.querySelector('.switch-label');
    expect(label.textContent).toBe(testLabel);
  });

  test('should update checked state when clicked', async () => {
    const input = toggleSwitch.shadowRoot.querySelector('input');

    const changeEvent = new Event('change');
    Object.defineProperty(changeEvent, 'target', { value: { checked: true } });

    input.dispatchEvent(changeEvent);

    expect(toggleSwitch.hasAttribute('checked')).toBe(true);
  });

  test('should dispatch toggle event when clicked', async () => {
    const input = toggleSwitch.shadowRoot.querySelector('input');

    const toggleHandler = vi.fn();
    toggleSwitch.addEventListener('toggle', toggleHandler);

    const changeEvent = new Event('change');
    Object.defineProperty(changeEvent, 'target', { value: { checked: true } });

    input.dispatchEvent(changeEvent);

    expect(toggleHandler).toHaveBeenCalledTimes(1);
    expect(toggleHandler.mock.calls[0][0].detail.checked).toBe(true);
  });

  test('should update when checked attribute changes', async () => {
    toggleSwitch.setAttribute('checked', '');
    await waitForRender();

    const input = toggleSwitch.shadowRoot.querySelector('input');
    expect(input.checked).toBe(true);

    toggleSwitch.removeAttribute('checked');
    await waitForRender();
    expect(input.checked).toBe(false);
  });

  test('should update when disabled attribute changes', async () => {
    toggleSwitch.setAttribute('disabled', '');
    await waitForRender();

    const input = toggleSwitch.shadowRoot.querySelector('input');
    expect(input.disabled).toBe(true);

    toggleSwitch.removeAttribute('disabled');
    await waitForRender();
    expect(input.disabled).toBe(false);
  });

  test('should update when label attribute changes', async () => {
    const newLabel = 'New Label';
    toggleSwitch.setAttribute('label', newLabel);
    await waitForRender();

    const label = toggleSwitch.shadowRoot.querySelector('.switch-label');
    expect(label.textContent).toBe(newLabel);
  });

  test('should have correct DOM structure', async () => {
    const container =
      toggleSwitch.shadowRoot.querySelector('.switch-container');
    const switchLabel = toggleSwitch.shadowRoot.querySelector('.switch');
    const input = toggleSwitch.shadowRoot.querySelector('input');
    const slider = toggleSwitch.shadowRoot.querySelector('.slider');
    const label = toggleSwitch.shadowRoot.querySelector('.switch-label');

    expect(container).not.toBeNull();
    expect(switchLabel).not.toBeNull();
    expect(input).not.toBeNull();
    expect(slider).not.toBeNull();
    expect(label).not.toBeNull();

    expect(input.type).toBe('checkbox');
  });

  test('should verify Logger mock is available', async () => {
    // Simple test to verify Logger mock is working
    expect(Logger.error).toBeDefined();
    expect(typeof Logger.error).toBe('function');
    expect(Logger.log).toBeDefined();
    expect(typeof Logger.log).toBe('function');
  });
});
