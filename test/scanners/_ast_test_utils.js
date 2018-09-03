const { assert } = require('chai')
import { scan_jsy, transpile_jsy } from 'jsy-transpile/esm/all'

export function scan_jsy_lines(jsy_lines) ::
  return scan_jsy @ jsy_lines.join('\n')

export function jsy_scan_throws(error, jsy_lines) ::
  if Array.isArray(error) ::
    jsy_lines = error
    error = SyntaxError

  return assert.throws @ 
    @=> scan_jsy_lines(jsy_lines)
    error

export function ast_tokens(offside_ast) ::
  return offside_ast
    .filter @ ln => ! ln.is_blank
    .map @ ln =>
      ln.content.map @ e => e.type

export function ast_tokens_content(offside_ast) ::
  return offside_ast
    .filter @ ln => ! ln.is_blank
    .map @ ln =>
      ln.content.map @ e =>
        `${e.type} ${JSON.stringify(e.content) || ''}`.trim()


export function test_ast_tokens(offside_ast, ... expected) ::
  const tokens = ast_tokens(offside_ast)
  assert.deepEqual @ tokens, expected
  transpile_jsy(offside_ast)

export function test_ast_tokens_content(offside_ast, ... expected) ::
  const tokens = ast_tokens_content(offside_ast)
  try ::
    assert.deepEqual @ tokens, expected
  catch err ::
    console.dir @ tokens
    throw err

  transpile_jsy(offside_ast)

