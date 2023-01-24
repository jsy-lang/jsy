//import { jsy_transpile_srcmap } from 'jsy-transpile/esm/index.min.js'
import { jsy_transpile_srcmap } from './esm/index.min.js'

export { jsy_transpile_srcmap }

export function jsy_script(code, ref) {
  if (null == code)
    return fetch(ref, {mode: 'cors'})
      .then(res => res.text())
      .then(code => jsy_script(code, ref))

  let el = (this?.ownerDocument || document).createElement('script')
  el.dataset.transpiled = 'jsy'
  el.jsy_source = code
  el.type = 'module'
  el.textContent = jsy_transpile_srcmap(code, ref, {})
  return el
}

export class JSYScript extends HTMLElement {
  async connectedCallback() {
    this.jsy_script ||= jsy_script
    this.style = 'display: none'

    let el, src = this.getAttribute('src')
    if (src)
      el = await this.jsy_script(null, src)
    else el = this.jsy_script(this.textContent, src)

    this.textContent = ''
    this.append(el)
  }
}

window.customElements.define('jsy-script', JSYScript)
