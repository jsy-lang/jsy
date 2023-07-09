//import { jsy_transpile_srcmap, version } from '@jsy-lang/jsy/esm/index.min.js'
import { jsy_transpile_srcmap, version } from './esm/index.min.js'

export { jsy_transpile_srcmap, version }

export function jsy_script(code, ref) {
  let el = document.createElement('script')
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

    let href = this.getAttribute('src')
    let code = href ? null : this.textContent
    return this.run_jsy(code, href)
  }

  async run_jsy(code, href) {
    this.textContent = '' // clear content
    if (!code && href)
      code = this.fetch_jsy(href)
    this.append( this.jsy_script(await code, href) )
  }

  async fetch_jsy(href) {
    let req = await fetch(href, {mode: 'cors'})
    return req.text()
  }
}

window.customElements.define('jsy-script', JSYScript)
