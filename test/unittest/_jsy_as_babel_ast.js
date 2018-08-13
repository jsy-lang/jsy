const jsy_transpile = require('jsy-transpile/dist/scan_jsy')
const babel = require('babel-core')

const babel_opt = @{}
  babelrc: false
  highlightCode: false

function jsy_as_babel_ast(jsy_code) ::
  if Array.isArray(jsy_code) ::
    jsy_code = jsy_code.join('\n')

  const js_vanilla = jsy_transpile(jsy_code)
  return babel.transform @ js_vanilla, babel_opt

module.exports = exports = jsy_as_babel_ast
