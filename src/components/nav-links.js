class NavLinks extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const id = this.getAttribute('id') || '';
    const classes = this.getAttribute('class') || '';

    this.innerHTML = `
      <div id="${id}" class="${classes}">
        <a id="options-link" href="#" class="link">Options</a>
        <span class="link-separator">|</span>
        <a id="help-link" href="#" class="link">Help</a>
      </div>
    `;

    this.addEventListeners();
  }

  addEventListeners() {
    const optionsLink = this.querySelector('#options-link');
    const helpLink = this.querySelector('#help-link');

    if (optionsLink) {
      optionsLink.addEventListener('click', e => {
        e.preventDefault();
        if (chrome.runtime.openOptionsPage) {
          chrome.runtime.openOptionsPage();
        } else {
          window.open(chrome.runtime.getURL('options.html'));
        }
      });
    }

    if (helpLink) {
      helpLink.addEventListener('click', e => {
        e.preventDefault();
        window.open(chrome.runtime.getURL('help.html'));
      });
    }
  }
}

customElements.define('nav-links', NavLinks);
