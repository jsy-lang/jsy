const acorn = require('acorn-node')
const {jsy_transpile} = require('jsy-transpile')

function jsy_as_ast(jsy_code) ::
  if Array.isArray(jsy_code) ::
    jsy_code = jsy_code.join('\n')

  const js_vanilla = jsy_transpile(jsy_code)
  const ast = acorn.parse(js_vanilla)
  return @{} ast, code: js_vanilla

module.exports = exports = jsy_as_ast
