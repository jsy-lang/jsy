import * as acorn from 'acorn'
import jsy_transpile from 'jsy-transpile'

export default jsy_as_ast
export function jsy_as_ast(jsy_code) ::
  if Array.isArray(jsy_code) ::
    jsy_code = jsy_code.join('\n')

  const js_vanilla = jsy_transpile(jsy_code)
  try ::
    const ast = acorn.parse @ js_vanilla,
      @{} ecmaVersion: 11, sourceType:'module'
    return @{} ast, code: js_vanilla
  catch err ::
    console.error()
    console.error @ "--- Vanilla JS ---"
    console.error()
    console.error @ js_vanilla
    console.error()
    console.error @ "------------------"
    console.error()
    throw new SyntaxError @ err.message

