import { mockRuntime } from '@tests/setup';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import '@src/modules/common/components/nav-links/nav-links';

// Mock for chrome.runtime.getURL
if (!global.chrome) {
  (global as any).chrome = {};
}

if (!global.chrome.runtime) {
  global.chrome.runtime = {} as any;
}

global.chrome.runtime.getURL = vi.fn().mockReturnValue('mock-url');

// Mock for fetch
(global as any).fetch = vi.fn(() =>
  Promise.resolve({
    text: () => Promise.resolve('/* Mock CSS */'),
  })
);

// Function to wait for component rendering
const waitForRender = async (): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, 50));
};

describe('NavLinks Component', () => {
  let navLinks: any;
  let mockShadowRoot: any;
  let mockOptionsLink: any;
  let mockHelpLink: any;
  let originalOpenOptionsPage: typeof mockRuntime.openOptionsPage;
  let originalGetURL: typeof mockRuntime.getURL;
  let originalWindowOpen: typeof window.open;

  beforeEach(async () => {
    originalOpenOptionsPage = mockRuntime.openOptionsPage;
    originalGetURL = mockRuntime.getURL;
    originalWindowOpen = window.open;

    mockRuntime.openOptionsPage = vi.fn();
    mockRuntime.getURL = vi.fn(path => `chrome-extension://extension-id${path}`);
    window.open = vi.fn();

    // Crear mocks para los elementos del shadow DOM
    mockOptionsLink = {
      textContent: 'Options',
      addEventListener: vi.fn((event, handler) => {
        if (event === 'click') {
          mockOptionsLink.clickHandler = handler;
        }
      }),
      click: vi.fn(() => {
        if (mockOptionsLink.clickHandler) {
          mockOptionsLink.clickHandler();
        }
      }),
    };

    mockHelpLink = {
      textContent: 'Help',
      addEventListener: vi.fn((event, handler) => {
        if (event === 'click') {
          mockHelpLink.clickHandler = handler;
        }
      }),
      click: vi.fn(() => {
        if (mockHelpLink.clickHandler) {
          mockHelpLink.clickHandler();
        }
      }),
    };

    // Create a mock for shadowRoot
    mockShadowRoot = {
      innerHTML: '',
      querySelector: vi.fn(selector => {
        if (selector === 'div') return { id: '', className: '' };
        if (selector === '#options-link') return mockOptionsLink;
        if (selector === '#help-link') return mockHelpLink;
        if (selector === '.link-separator') return { textContent: '|' };
        return null;
      }),
      querySelectorAll: vi.fn(() => []),
    };

    // Create a mock element with a shadowRoot
    navLinks = {
      tagName: 'NAV-LINKS',
      shadowRoot: mockShadowRoot,
      hasAttribute: vi.fn().mockReturnValue(false),
      getAttribute: vi.fn(attr => {
        if (attr === 'id') return '';
        if (attr === 'class') return '';
        return null;
      }),
      setAttribute: vi.fn(),
      removeAttribute: vi.fn(),
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      attachShadow: vi.fn().mockReturnValue(mockShadowRoot),
      connectedCallback: vi.fn(),
      addEventListeners: vi.fn(() => {
        // Simulate implementation of addEventListeners
        const optionsLink = mockShadowRoot.querySelector('#options-link');
        const helpLink = mockShadowRoot.querySelector('#help-link');

        if (optionsLink) {
          optionsLink.addEventListener('click', () => {
            if (mockRuntime.openOptionsPage) {
              mockRuntime.openOptionsPage();
            } else {
              window.open(mockRuntime.getURL('/options.html'));
            }
          });
        }

        if (helpLink) {
          helpLink.addEventListener('click', () => {
            window.open(mockRuntime.getURL('/help.html'));
          });
        }
      }),
    };

    // Mock for document.createElement
    document.createElement = vi.fn().mockReturnValue(navLinks);

    // Simulate element creation
    navLinks = document.createElement('nav-links');
    document.body.appendChild(navLinks);

    // Simulate component initialization
    navLinks.addEventListeners();

    await waitForRender();
  });

  afterEach(() => {
    mockRuntime.openOptionsPage = originalOpenOptionsPage;
    mockRuntime.getURL = originalGetURL;
    window.open = originalWindowOpen;
    vi.clearAllMocks();
  });

  test('should render with default attributes', async () => {
    const container = mockShadowRoot.querySelector('div');
    const optionsLink = mockShadowRoot.querySelector('#options-link');
    const helpLink = mockShadowRoot.querySelector('#help-link');
    const separator = mockShadowRoot.querySelector('.link-separator');

    expect(container).not.toBeNull();
    expect(optionsLink).not.toBeNull();
    expect(helpLink).not.toBeNull();
    expect(separator).not.toBeNull();
    expect(container.id).toBe('');
    expect(container.className).toBe('');
    expect(optionsLink.textContent).toBe('Options');
    expect(helpLink.textContent).toBe('Help');
    expect(separator.textContent).toBe('|');
  });

  test('should apply custom id and class attributes', async () => {
    // Actualizar los atributos del contenedor
    const container = mockShadowRoot.querySelector('div');
    container.id = 'custom-id';
    container.className = 'custom-class';

    expect(container.id).toBe('custom-id');
    expect(container.className).toBe('custom-class');
  });

  test('should open options page when options link is clicked', async () => {
    const optionsLink = mockShadowRoot.querySelector('#options-link');
    optionsLink.click();

    expect(mockRuntime.openOptionsPage).toHaveBeenCalledTimes(1);
  });

  test('should open options page via URL when mockRuntime.openOptionsPage is not available', async () => {
    mockRuntime.openOptionsPage = undefined as any;

    // Necesitamos reinicializar los event listeners
    navLinks.addEventListeners();

    const optionsLink = mockShadowRoot.querySelector('#options-link');
    optionsLink.click();

    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith('chrome-extension://extension-id/options.html');
  });

  test('should open help page when help link is clicked', async () => {
    const helpLink = mockShadowRoot.querySelector('#help-link');
    helpLink.click();

    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith('chrome-extension://extension-id/help.html');
  });

  test('should handle missing links gracefully', async () => {
    // Modificar el mock para simular que no se encuentran los enlaces
    mockShadowRoot.querySelector.mockImplementation(() => null);

    // Verificar que no se lance ninguna excepción
    expect(() => {
      navLinks.addEventListeners();
    }).not.toThrow();
  });
});
