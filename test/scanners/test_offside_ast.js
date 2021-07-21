const { assert } = require('chai')
import { scan_javascript } from 'jsy-transpile/esm/scanner/index.js'

describe @ 'Scanners', @=> ::
  describe @ 'hash_fnv32 example', @=> ::
    let offside_ast
    beforeEach @=> ::
      // source from https://github.com/shanewholloway/js-consistent-fnvxor32/blob/d2554377c4a540258f93f2958d4259c1f4f03ff9/code/fnvxor32.jsy on 2018-08-09
      offside_ast = scan_javascript @ `
        export function hash_fnv32(sz) ::
          // FNV32, from https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function#FNV-1a_hash
          let h = 0x811C9DC5 // fnv-1a 32 bit initial value
          for let i=0; i < sz.length; i++ ::
            h ^= sz.charCodeAt(i)
            h += (h << 24) + (h << 8) + (h << 7) + (h << 4) + (h << 1)
          return h

        `
        .replace(/^\s*\r?\n/, '') // trim off the first newline for test stability


    it @ 'can self-verify locations match original source', @=> ::
      const to_source = node => node.loc.start.slice @ node.loc.end
      for const ln of offside_ast ::
        if ln.is_blank :: continue

        assert.equal @ ln.indent.indent, to_source(ln.indent)
        for const part of ln.content ::
          assert.equal @ part.content, to_source(part)

    it @ 'line 0 matches this offside AST structure', @=> ::
      check_ast_entry @ 'line 0', offside_ast[0], @{}
        type: 'offside_line'
        loc: @{} start: { line: 1, pos: 0, line_pos: 0 }, end: { line: 1, pos: 33, line_pos: 0 }
        len_indent: 0, len_dedent: 2, len_inner: 2

        indent: @{}
           type: 'offside_indent'
           loc: @{} start: { line: 1, pos: 0, line_pos: 0 }, end: { line: 1, pos: 0, line_pos: 0 }
           len_indent: 0, indent: ''

        content: @[]
         @{} type: 'src'
             loc: @{} start: { line: 1, pos: 0, line_pos: 0 }, end: { line: 1, pos: 33, line_pos: 0 }
             content: 'export function hash_fnv32(sz) ::'


    it @ 'line 1 matches this offside AST structure', @=> ::
      check_ast_entry @ 'line 1', offside_ast[1], @{}
        type: 'offside_line'
        loc: @{} start: { line: 2, pos: 34, line_pos: 34 }, end: { line: 2, pos: 137, line_pos: 34 }
        len_indent: 2, len_dedent: 2

        indent: @{}
           type: 'offside_indent',
           loc: @{} start: { line: 2, pos: 34, line_pos: 34 }, end: { line: 2, pos: 36, line_pos: 34 }
           len_indent: 2, indent: '  '

        content: @[]
         @{} type: 'comment_eol',
             loc: @{} start: { line: 2, pos: 36, line_pos: 34 }, end: { line: 2, pos: 137, line_pos: 34 }
             content: '// FNV32, from https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function#FNV-1a_hash'

    it @ 'line 2 matches this offside AST structure', @=> ::
      check_ast_entry @ 'line 2', offside_ast[2], @{}
        type: 'offside_line'
        loc: @{} start: { line: 3, pos: 138, line_pos: 138 }, end: { line: 3, pos: 189, line_pos: 138 }
        len_indent: 2, len_dedent: 2

        indent: @{}
          type: 'offside_indent',
          loc: { start: { line: 3, pos: 138, line_pos: 138 }, end: { line: 3, pos: 140, line_pos: 138 } },
          len_indent: 2, indent: '  '

        content: @[]
         @{} type: 'src',
             loc: { start: { line: 3, pos: 140, line_pos: 138 }, end: { line: 3, pos: 159, line_pos: 138 } },
             content: 'let h = 0x811C9DC5 '

         @{} type: 'comment_eol',
             loc: { start: { line: 3, pos: 159, line_pos: 138 }, end: { line: 3, pos: 189, line_pos: 138 } },
             content: '// fnv-1a 32 bit initial value'

    it @ 'line 3 matches this offside AST structure', @=> ::
      check_ast_entry @ 'line 3', offside_ast[3], @{}
        type: 'offside_line',
        loc: { start: { line: 4, pos: 190, line_pos: 190 }, end: { line: 4, pos: 226, line_pos: 190 } },
        len_indent: 2, len_dedent: 4, len_inner: 4

        indent: @{}
           type: 'offside_indent',
           loc: { start: { line: 4, pos: 190, line_pos: 190 }, end: { line: 4, pos: 192, line_pos: 190 } },
           len_indent: 2, indent: '  '

        content: @[]
         @{} type: 'src',
             loc: { start: { line: 4, pos: 192, line_pos: 190 }, end: { line: 4, pos: 226, line_pos: 190 } },
             content: 'for let i=0; i < sz.length; i++ ::'

    it @ 'line 4 matches this offside AST structure', @=> ::
      check_ast_entry @ 'line 4', offside_ast[4], @{}
        type: 'offside_line',
        loc: { start: { line: 5, pos: 227, line_pos: 227 }, end: { line: 5, pos: 252, line_pos: 227 } },
        len_indent: 4, len_dedent: 4

        indent: @{}
           type: 'offside_indent'
           loc: { start: { line: 5, pos: 227, line_pos: 227 }, end: { line: 5, pos: 231, line_pos: 227 } },
           len_indent: 4, indent: '    '

        content: @[]
         @{} type: 'src'
             loc: { start: { line: 5, pos: 231, line_pos: 227 }, end: { line: 5, pos: 252, line_pos: 227 } },
             content: 'h ^= sz.charCodeAt(i)'

    it @ 'line 5 matches this offside AST structure', @=> ::
      check_ast_entry @ 'line 5', offside_ast[5], @{}
        type: 'offside_line'
        loc: { start: { line: 6, pos: 253, line_pos: 253 }, end: { line: 6, pos: 315, line_pos: 253 } },
        len_indent: 4, len_dedent: 2

        indent: @{}
           type: 'offside_indent'
           loc: { start: { line: 6, pos: 253, line_pos: 253 }, end: { line: 6, pos: 257, line_pos: 253 } },
           len_indent: 4, indent: '    '

        content: @[]
         @{} type: 'src'
             loc: { start: { line: 6, pos: 257, line_pos: 253 }, end: { line: 6, pos: 315, line_pos: 253 } },
             content: 'h += (h << 24) + (h << 8) + (h << 7) + (h << 4) + (h << 1)'

    it @ 'line 6 matches this offside AST structure', @=> ::
      check_ast_entry @ 'line 6', offside_ast[6], @{}
        type: 'offside_line'
        loc: { start: { line: 7, pos: 316, line_pos: 316 }, end: { line: 7, pos: 326, line_pos: 316 } },
        len_indent: 2, len_dedent: 0

        indent: @{}
           type: 'offside_indent'
           loc: { start: { line: 7, pos: 316, line_pos: 316 }, end: { line: 7, pos: 318, line_pos: 316 } },
           len_indent: 2, indent: '  '

        content: @[]
         @{} type: 'src'
             loc: { start: { line: 7, pos: 318, line_pos: 316 }, end: { line: 7, pos: 326, line_pos: 316 } },
             content: 'return h'

    it @ 'line 7 matches this offside AST structure', @=> ::
      check_ast_entry @ 'line 7', offside_ast[7], @{}
        type: 'offside_blank_line'
        loc: { start: { line: 8, pos: 327, line_pos: 327 }, end: { line: 8, pos: 327, line_pos: 327 } },
        is_blank: true


  it @ 'hashbang', @=> ::
    const offside_ast = scan_javascript @
      @[] '#!/usr/bin/env jsy-node'
          ''
          'if test() ::'
          '  console.log @'
          '    "hello JSY world!"'
      .join('\n')

    check_ast_entry @ 'line 0', offside_ast[0], @{}
      type: 'offside_line'
      loc: { start: { line: 1, pos: 0, line_pos: 0 }, end: { line: 1, pos: 23, line_pos: 0 } },
      len_indent: 0, len_dedent: 0

      indent: @{}
         type: 'offside_indent'
         loc: { start: { line: 1, pos: 0, line_pos: 0 }, end: { line: 1, pos: 0, line_pos: 0 } },
         len_indent: 0, indent: ''

      content: @[]
       @{} type: 'hashbang'
           loc: { start: { line: 1, pos: 0, line_pos: 0 }, end: { line: 1, pos: 23, line_pos: 0 } }
           content: '#!/usr/bin/env jsy-node'



function check_ast_entry(lineno, ast, structure) ::
  ast = JSON.parse @ JSON.stringify @ ast
  try ::
    assert.deepEqual @ ast, structure
  catch err ::
    if 0 ::
      console.dir @ ast, @{} depth: null
      throw new Error @ `AST mismatch (${lineno})`
    else ::
      console.log @ lineno
      throw err

