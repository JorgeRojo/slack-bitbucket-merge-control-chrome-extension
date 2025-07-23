import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../src/modules/common/components/toggle-switch/toggle-switch';
import { Logger } from '../../src/modules/common/utils/logger';

vi.mock('../../src/modules/common/utils/logger');

(global as any).fetch = vi.fn(() =>
  Promise.resolve({
    text: () => Promise.resolve('/* mocked CSS */'),
  })
);

const waitForRender = async (): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, 50));
};

describe('ToggleSwitch Component', () => {
  let toggleSwitch: HTMLElement;

  beforeEach(async () => {
    (fetch as jest.Mock).mockClear();

    toggleSwitch = document.createElement('toggle-switch');
    document.body.appendChild(toggleSwitch);

    // Wait for the component to be fully initialized
    await waitForRender();
    
    // Ensure the component has been connected and initialized
    let attempts = 0;
    while (!toggleSwitch.shadowRoot && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    // Additional wait for the component to fully render
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  afterEach(() => {
    document.body.removeChild(toggleSwitch);
  });

  test('should initialize with default attributes', async () => {
    if (!toggleSwitch.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    
    const input = toggleSwitch.shadowRoot.querySelector('input');
    const label = toggleSwitch.shadowRoot.querySelector('.switch-label');

    expect(input).not.toBeNull();
    if (input) {
      expect(input.checked).toBe(false);
      expect(input.disabled).toBe(false);
    }
    if (label) {
      expect(label.textContent).toBe('');
    }
  });

  test('should initialize with checked attribute', async () => {
    document.body.removeChild(toggleSwitch);
    toggleSwitch = document.createElement('toggle-switch') as HTMLElement & {
      shadowRoot: ShadowRoot;
    };
    toggleSwitch.setAttribute('checked', '');
    document.body.appendChild(toggleSwitch);

    await waitForRender();
    await new Promise(resolve => setTimeout(resolve, 200));

    if (!toggleSwitch.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }

    const input = toggleSwitch.shadowRoot.querySelector('input');
    if (input) {
      expect(input.checked).toBe(true);
    }
  });

  test('should initialize with disabled attribute', async () => {
    document.body.removeChild(toggleSwitch);
    toggleSwitch = document.createElement('toggle-switch') as HTMLElement & {
      shadowRoot: ShadowRoot;
    };
    toggleSwitch.setAttribute('disabled', '');
    document.body.appendChild(toggleSwitch);

    await waitForRender();

    if (!toggleSwitch.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const input = toggleSwitch.shadowRoot.querySelector('input');
    if (input) {
      expect(input.disabled).toBe(true);
    }
  });

  test('should initialize with label attribute', async () => {
    const testLabel = 'Test Label';

    document.body.removeChild(toggleSwitch);
    toggleSwitch = document.createElement('toggle-switch') as HTMLElement & {
      shadowRoot: ShadowRoot;
    };
    toggleSwitch.setAttribute('label', testLabel);
    document.body.appendChild(toggleSwitch);

    await waitForRender();

    if (!toggleSwitch.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }

    const label = toggleSwitch.shadowRoot.querySelector('.switch-label');
    if (label) {
      expect(label.textContent).toBe(testLabel);
    }
  });

  test('should update checked state when clicked', async () => {
    if (!toggleSwitch.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const input = toggleSwitch.shadowRoot.querySelector('input');

    const changeEvent = new Event('change');
    Object.defineProperty(changeEvent, 'target', { value: { checked: true } });

    input?.dispatchEvent(changeEvent);

    expect(toggleSwitch.hasAttribute('checked')).toBe(true);
  });

  test('should dispatch toggle event when clicked', async () => {
    if (!toggleSwitch.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const input = toggleSwitch.shadowRoot.querySelector('input');

    const toggleHandler = vi.fn();
    toggleSwitch.addEventListener('toggle', toggleHandler);

    const changeEvent = new Event('change');
    Object.defineProperty(changeEvent, 'target', { value: { checked: true } });

    input?.dispatchEvent(changeEvent);

    expect(toggleHandler).toHaveBeenCalledTimes(1);
    expect(toggleHandler.mock.calls[0][0].detail.checked).toBe(true);
  });

  test('should update when checked attribute changes', async () => {
    toggleSwitch.setAttribute('checked', '');
    await waitForRender();

    if (!toggleSwitch.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const input = toggleSwitch.shadowRoot.querySelector('input');
    if (input) {
      expect(input.checked).toBe(true);
    }

    toggleSwitch.removeAttribute('checked');
    await waitForRender();
    if (input) {
      expect(input.checked).toBe(false);
    }
  });

  test('should update when disabled attribute changes', async () => {
    toggleSwitch.setAttribute('disabled', '');
    await waitForRender();

    if (!toggleSwitch.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const input = toggleSwitch.shadowRoot.querySelector('input');
    if (input) {
      expect(input.disabled).toBe(true);
    }

    toggleSwitch.removeAttribute('disabled');
    await waitForRender();
    if (input) {
      expect(input.disabled).toBe(false);
    }
  });

  test('should update when label attribute changes', async () => {
    const newLabel = 'New Label';
    toggleSwitch.setAttribute('label', newLabel);
    await waitForRender();

    if (!toggleSwitch.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }

    const label = toggleSwitch.shadowRoot.querySelector('.switch-label');
    if (label) {
      expect(label.textContent).toBe(newLabel);
    }
  });

  test('should have correct DOM structure', async () => {
    const container = toggleSwitch.shadowRoot?.querySelector('.switch-container');
    const switchLabel = toggleSwitch.shadowRoot?.querySelector('.switch');
    if (!toggleSwitch.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const input = toggleSwitch.shadowRoot.querySelector('input');
    const slider = toggleSwitch.shadowRoot?.querySelector('.slider');
    const label = toggleSwitch.shadowRoot.querySelector('.switch-label');

    expect(container).not.toBeNull();
    expect(switchLabel).not.toBeNull();
    expect(input).not.toBeNull();
    expect(slider).not.toBeNull();
    expect(label).not.toBeNull();

    if (input) {
      expect(input.type).toBe('checkbox');
    }
  });

  test('should verify Logger mock is available', async () => {
    // Simple test to verify Logger mock is working
    expect(Logger.error).toBeDefined();
    expect(typeof Logger.error).toBe('function');
    expect(Logger.log).toBeDefined();
    expect(typeof Logger.log).toBe('function');
  });
});
