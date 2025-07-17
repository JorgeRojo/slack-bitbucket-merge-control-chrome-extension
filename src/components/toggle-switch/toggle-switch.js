/**
 * Custom Toggle Switch Web Component
 */
class ToggleSwitch extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  async connectedCallback() {
    const checked = this.hasAttribute('checked');
    const disabled = this.hasAttribute('disabled');
    const label = this.getAttribute('label') || '';

    await this.render(checked, disabled, label);
    await this.setupEventListeners();
  }

  async setupEventListeners() {
    const switchInput = this.shadowRoot.querySelector('input');
    if (switchInput) {
      switchInput.addEventListener('change', (e) => {
        const isChecked = e.target.checked;

        if (isChecked) {
          this.setAttribute('checked', '');
        } else {
          this.removeAttribute('checked');
        }

        this.dispatchEvent(
          new CustomEvent('toggle', {
            bubbles: true,
            composed: true,
            detail: { checked: isChecked },
          }),
        );
      });
    } else {
      console.warn('Toggle switch input element not found');
    }
  }

  async render(checked, disabled, label) {
    const response = await fetch(
      new URL('./toggle-switch.css', import.meta.url),
    );
    const css = await response.text();

    this.shadowRoot.innerHTML = `
      <style>${css}</style>
      
      <div class="switch-container">
        <label class="switch">
          <input 
            type="checkbox" 
            ${checked ? 'checked' : ''}
            ${disabled ? 'disabled' : ''}
          >
          <span class="slider"></span>
        </label>
        <span class="switch-label">${label}</span>
      </div>
    `;
  }

  attributeChangedCallback(attributeName) {
    if (!this.shadowRoot.querySelector('.switch-container')) return;

    const switchInput = this.shadowRoot.querySelector('input');
    const labelElement = this.shadowRoot.querySelector('.switch-label');

    switch (attributeName) {
      case 'checked':
        if (switchInput) switchInput.checked = this.hasAttribute('checked');
        break;
      case 'disabled':
        if (switchInput) switchInput.disabled = this.hasAttribute('disabled');
        break;
      case 'label':
        if (labelElement)
          labelElement.textContent = this.getAttribute('label') || '';
        break;
    }
  }

  static get observedAttributes() {
    return ['checked', 'disabled', 'label'];
  }
}

// Define the custom element
customElements.define('toggle-switch', ToggleSwitch);

export default ToggleSwitch;
