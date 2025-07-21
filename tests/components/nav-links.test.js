import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { mockRuntime } from '../setup.js';
import '../../src/components/nav-links.js';

const waitForRender = async () => {
  return new Promise((resolve) => setTimeout(resolve, 50));
};

describe('NavLinks Component', () => {
  let navLinks;
  let originalOpenOptionsPage;
  let originalGetURL;

  beforeEach(async () => {
    originalOpenOptionsPage = mockRuntime.openOptionsPage;
    originalGetURL = mockRuntime.getURL;

    mockRuntime.openOptionsPage = vi.fn();
    mockRuntime.getURL = vi.fn((path) => `chrome-extension://fake-id/${path}`);

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
    const container = navLinks.querySelector('div');
    const optionsLink = navLinks.querySelector('#options-link');
    const helpLink = navLinks.querySelector('#help-link');
    const separator = navLinks.querySelector('.link-separator');

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
    document.body.removeChild(navLinks);
    navLinks = document.createElement('nav-links');
    navLinks.setAttribute('id', 'custom-id');
    navLinks.setAttribute('class', 'custom-class');
    document.body.appendChild(navLinks);

    await waitForRender();

    const container = navLinks.querySelector('div');
    expect(container.id).toBe('custom-id');
    expect(container.className).toBe('custom-class');
  });

  test('should open options page when options link is clicked', async () => {
    const optionsLink = navLinks.querySelector('#options-link');
    optionsLink.click();
    expect(mockRuntime.openOptionsPage).toHaveBeenCalledTimes(1);
  });

  test('should open options page via URL when mockRuntime.openOptionsPage is not available', async () => {
    mockRuntime.openOptionsPage = undefined;

    const originalWindowOpen = window.open;
    window.open = vi.fn();

    const optionsLink = navLinks.querySelector('#options-link');
    optionsLink.click();

    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith(
      'chrome-extension://fake-id/options.html',
    );

    window.open = originalWindowOpen;
  });

  test('should open help page when help link is clicked', async () => {
    const originalWindowOpen = window.open;
    window.open = vi.fn();

    const helpLink = navLinks.querySelector('#help-link');
    helpLink.click();

    expect(window.open).toHaveBeenCalledTimes(1);
    expect(window.open).toHaveBeenCalledWith(
      'chrome-extension://fake-id/help.html',
    );

    window.open = originalWindowOpen;
  });

  test('should handle missing links gracefully', async () => {
    document.body.removeChild(navLinks);
    navLinks = document.createElement('nav-links');

    Object.defineProperty(navLinks, 'innerHTML', {
      set: () => {},
    });

    document.body.appendChild(navLinks);

    const NavLinksClass = customElements.get('nav-links');
    const instance = new NavLinksClass();

    expect(() => {
      instance.addEventListeners();
    }).not.toThrow();
  });
});
