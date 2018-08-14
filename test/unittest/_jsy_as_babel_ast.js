const {jsy_transpile} = require('jsy-transpile')
const babel = require('babel-core')

const babel_opt = @{}
  babelrc: false
  highlightCode: false
  plugins: @[] 
    'syntax-async-generators'

function jsy_as_babel_ast(jsy_code) ::
  if Array.isArray(jsy_code) ::
    jsy_code = jsy_code.join('\n')

  const js_vanilla = jsy_transpile(jsy_code)
  try ::
    return babel.transform @ js_vanilla, babel_opt
  catch err ::
    console.error @# jsy_code.split(/\r?\n/), js_vanilla.split(/\r?\n/)
    throw new Error @ `Babel transform error: ${err.message}`

module.exports = exports = jsy_as_babel_ast
