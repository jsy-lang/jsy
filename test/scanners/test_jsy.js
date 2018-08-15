require('source-map-support').install()

const fs = require('fs').promises
const assert = require('assert')
const { transpile_jsy } = require('jsy-transpile/cjs/all')

if 0 ::
  describe.only @ 'JSY One-offs', @=> ::

    it.skip @ 'file one-off test', @=>> ::
      const filename = require.resolve @
        'jsy-transpile/code/scanner/scan_javascript.jsy'
      const jsy_code = await fs.readFile @ filename, 'utf-8'

      const js_src = transpile_jsy @ jsy_code
      console.dir @ js_src.split('\n')

      //new Function(js_src)

    it.skip @ 'literal one-off test', @=>> ::
      const jsy_code = `
        `

      const js_src = transpile_jsy @ jsy_code
      console.dir @ js_src.split('\n')

      new Function(js_src)
