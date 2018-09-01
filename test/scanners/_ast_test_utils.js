const { assert } = require('chai')
import { scan_jsy, transpile_jsy } from 'jsy-transpile/esm/all'

export function scan_jsy_lines(jsy_lines) ::
  return scan_jsy @ jsy_lines.join('\n')

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
        @[] e.type, e.content


export function test_ast_tokens(offside_ast, expected) ::
  assert.deepEqual @ ast_tokens(offside_ast), expected
  transpile_jsy(offside_ast)

export function test_ast_tokens_content(offside_ast, expected) ::
  assert.deepEqual @ ast_tokens_content(offside_ast), expected
  transpile_jsy(offside_ast)

