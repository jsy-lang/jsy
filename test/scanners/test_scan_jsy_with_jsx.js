const { assert } = require('chai')
import { scan_jsy_lines, test_ast_tokens_content, ast_tokens_content } from './_ast_test_utils'

describe @ 'JSY Scanner (with JSX expressions)', @=> ::
  describe @ 'JSX basic', @=> ::
    it @ 'basic body', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section>example</section>'

      test_ast_tokens_content @ offside_ast, @[]
        @[] @[] 'jsx0', '<section'
            @[] 'jsx', '>example</section>'
            @[] 'offside_dedent', undefined


    it @ 'basic body with attr', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section class="nice">example</section>'

      test_ast_tokens_content @ offside_ast, @[]
        @[] @[] 'jsx0', '<section'
            @[] 'jsx', ' class='
            @[] 'xmlattrstr', '"nice"'
            @[] 'jsx', '>example</section>'
            @[] 'jsx_end', ''
            @[] 'offside_dedent', undefined


    it @ 'basic body with param', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section {param}>example</section>'

      test_ast_tokens_content @ offside_ast, @[]
        @[] @[] 'jsx0', '<section'
            @[] 'jsx', ' {'
            @[] 'jsx_param', ''
            @[] 'src', 'param'
            @[] 'jsx_param_end', '}'
            @[] 'jsx', '>example</section>'
            @[] 'jsx_end', ''
            @[] 'offside_dedent', undefined


    it @ 'basic body with jsy_op in param', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section {caller @ param}>example</section>'

      test_ast_tokens_content @ offside_ast, @[]
        @[] @[] 'jsx0', '<section'
            @[] 'jsx', ' {'
            @[] 'jsx_param', ''
            @[] 'src', 'caller'
            @[] 'jsy_op', ' @'
            @[] 'src', ' param'
            @[] 'jsx_param_end', '}'
            @[] 'jsx', '>example</section>'
            @[] 'jsx_end', ''
            @[] 'offside_dedent', undefined


  describe @ 'JSX Fragment', @=> ::
    it @ 'basic body', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<>example</>'

      test_ast_tokens_content @ offside_ast, @[]
        @[] @[] 'jsx0', '<'
            @[] 'jsx', '>example</>'
            @[] 'offside_dedent', undefined


    it @ 'basic body with attr', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<><div /><span>example</span></>'

      test_ast_tokens_content @ offside_ast, @[]
        @[] @[] 'jsx0', '<'
            @[] 'jsx', '><div /><span>example</span></>'
            @[] 'offside_dedent', undefined


  describe.skip @ 'JSX self closing', @=> ::
    it @ 'self closing', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section />'

      test_ast_tokens_content @ offside_ast, @[]
        @[] @[] 'jsx0', '<section'
            @[] 'offside_dedent', undefined


    it @ 'self closing with attr', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section class="nice" />'

      test_ast_tokens_content @ offside_ast, @[]
        @[] @[] 'jsx0', '<section'
            @[] 'jsx', ' class="nice" />'
            @[] 'offside_dedent', undefined

    it @ 'self closing with param', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section {param} />'

      test_ast_tokens_content @ offside_ast, @[]
        @[] @[] 'jsx0', '<section'
            @[] 'jsx', '/>'
            @[] 'offside_dedent', undefined
