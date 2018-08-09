const babel = require('babel-core')

const babel_opt = @{}
  babelrc: false
  highlightCode: false
  plugins: @[] 'offside-js' // TODO: replace with jsy-transpile

function jsy_as_babel_ast(jsy_code) ::
  if Array.isArray(jsy_code) ::
    jsy_code = jsy_code.join('\n')

  const js_vanilla = jsy_code
  //const js_vanilla = jsy_transpile(jsy_code)
  return babel.transform @ js_vanilla, babel_opt

module.exports = exports = jsy_as_babel_ast
