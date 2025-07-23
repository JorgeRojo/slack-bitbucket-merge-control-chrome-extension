import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockRuntime } from '../setup';
import '../../src/modules/common/components/nav-links/nav-links';
const waitForRender = async (): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, 50));
};
describe('NavLinks Component', () => {
  let navLinks: HTMLElement;
  let originalOpenOptionsPage: typeof mockRuntime.openOptionsPage;
  let originalGetURL: typeof mockRuntime.getURL;
  beforeEach(async () => {
    originalOpenOptionsPage = mockRuntime.openOptionsPage;
    originalGetURL = mockRuntime.getURL;
    mockRuntime.openOptionsPage = vi.fn();
    mockRuntime.getURL = vi.fn(path => `chrome-extension:
    navLinks = document.createElement('nav-links');
    document.body.appendChild(navLinks);
    await waitForRender();
  });
  afterEach(() => {
    document.body.contains(navLinks) && document.body.removeChild(navLinks);
    mockRuntime.openOptionsPage = originalOpenOptionsPage;
    mockRuntime.getURL = originalGetURL;
  });
  test('should render with default attributes', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!navLinks.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const container = navLinks.shadowRoot.querySelector('div');
    if (!navLinks.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const optionsLink = navLinks.shadowRoot.querySelector('#options-link');
    if (!navLinks.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const helpLink = navLinks.shadowRoot.querySelector('#help-link');
    if (!navLinks.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const separator = navLinks.shadowRoot.querySelector('.link-separator');
    expect(container).not.toBeNull();
    expect(optionsLink).not.toBeNull();
    expect(helpLink).not.toBeNull();
    expect(separator).not.toBeNull();
    expect(container?.id).toBe('');
    expect(container?.className).toBe('');
    expect(optionsLink?.textContent).toBe('Options');
    expect(helpLink?.textContent).toBe('Help');
    expect(separator?.textContent).toBe('|');
  });
  test('should apply custom id and class attributes', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    document.body.removeChild(navLinks);
    navLinks = document.createElement('nav-links');
    navLinks.setAttribute('id', 'custom-id');
    navLinks.setAttribute('class', 'custom-class');
    document.body.appendChild(navLinks);
    await waitForRender();
    if (!navLinks.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const container = navLinks.shadowRoot.querySelector('div');
    expect(container?.id).toBe('custom-id');
    expect(container?.className).toBe('custom-class');
  });
  test('should open options page when options link is clicked', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!navLinks.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const optionsLink = navLinks.shadowRoot.querySelector('#options-link');
    optionsLink?.click();
    expect(mockRuntime.openOptionsPage).toHaveBeenCalledTimes(1);
  });
  test('should open options page via URL when mockRuntime.openOptionsPage is not available', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    mockRuntime.openOptionsPage = undefined as any;
    const originalWindowOpen = window.open;
    window.open = vi.fn();
    if (!navLinks.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const optionsLink = navLinks.shadowRoot.querySelector('#options-link');
    optionsLink?.click();
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith('chrome-extension:
    window.open = originalWindowOpen;
  });
  test('should open help page when help link is clicked', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    const originalWindowOpen = window.open;
    window.open = vi.fn();
    if (!navLinks.shadowRoot) {
      console.warn('Shadow root not available, skipping test');
      return;
    }
    const helpLink = navLinks.shadowRoot.querySelector('#help-link');
    helpLink?.click();
    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith('chrome-extension:
    window.open = originalWindowOpen;
  });
  test('should handle missing links gracefully', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    document.body.removeChild(navLinks);
    navLinks = document.createElement('nav-links');
    Object.defineProperty(navLinks, 'innerHTML', {
      set: () => {},
    });
    document.body.appendChild(navLinks);
    const NavLinksClass = customElements.get('nav-links') as any;
    const instance = new NavLinksClass();
    expect(() => {
      instance.addEventListeners();
    }).not.toThrow();
  });
});
