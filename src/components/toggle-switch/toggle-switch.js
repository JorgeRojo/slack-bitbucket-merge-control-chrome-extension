/**
 * Custom Toggle Switch Web Component
 */
class ToggleSwitch extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    const checked = this.hasAttribute('checked');
    const disabled = this.hasAttribute('disabled');
    const label = this.getAttribute('label') || '';

    this.render(checked, disabled, label);
    this.setupEventListeners();
  }

  setupEventListeners() {
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
    }
  }

  async render(checked, disabled, label) {
    // Fetch the CSS
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

  attributeChangedCallback(_name, _oldValue, _newValue) {
    if (this.shadowRoot.querySelector('.switch-container')) {
      const checked = this.hasAttribute('checked');
      const disabled = this.hasAttribute('disabled');
      const label = this.getAttribute('label') || '';

      this.render(checked, disabled, label);
      this.setupEventListeners();
    }
  }

  static get observedAttributes() {
    return ['checked', 'disabled', 'label'];
  }
}

// Define the custom element
customElements.define('toggle-switch', ToggleSwitch);

export default ToggleSwitch;
