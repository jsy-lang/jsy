const { assert } = require('chai')

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

export function test_ast_tokens_content(offside_ast, expected) ::
  assert.deepEqual @ ast_tokens_content(offside_ast), expected


