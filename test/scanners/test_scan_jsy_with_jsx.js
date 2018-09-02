const { assert } = require('chai')
import { scan_jsy_lines, test_ast_tokens_content, ast_tokens_content } from './_ast_test_utils'


describe @ 'JSY Scanner (with JSX expressions)', @=> ::
  describe @ 'JSX basic', @=> ::
    it @ 'basic body', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section>example</section>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section>"'
            'jsx_content "example"'
            'jsx_tag_close "</section>"'
            'offside_dedent'


    it @ 'basic body with attr', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section class="nice">example</section>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section "'
            'jsx_attr_name "class="'
            'jsx_attr_str2 "\\"nice\\""'
            'jsx_tag_part ">"'
            'jsx_content "example"'
            'jsx_tag_close "</section>"'
            'offside_dedent'


    it @ 'basic body with attr param', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section {param}>example</section>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section "'
            'jsx_param "{"'
            'src "param"'
            'jsx_param_end "}"'
            'jsx_tag_part ">"'
            'jsx_content "example"'
            'jsx_tag_close "</section>"'
            'offside_dedent'


    it @ 'basic body with jsy_op in param', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section {caller @ param}>example</section>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section "'
            'jsx_param "{"'
            'src "caller"'
            'jsy_op " @"'
            'src " param"'
            'jsx_param_end "}"'
            'jsx_tag_part ">"'
            'jsx_content "example"'
            'jsx_tag_close "</section>"'
            'offside_dedent'



  describe @ 'JSX Fragment', @=> ::
    it @ 'basic body', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<>example</>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_frag "<>"'
            'jsx_content "example"'
            'jsx_frag_close "</>"'
            'offside_dedent'


    it @ 'basic body with attr', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<><div /><span>example</span></>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_frag "<>"'
            'jsx_tag "<div />"'
            'jsx_tag "<span>"'
            'jsx_content "example"'
            'jsx_tag_close "</span>"'
            'jsx_frag_close "</>"'
            'offside_dedent'




  describe @ 'JSX self closing', @=> ::
    it @ 'self closing', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section />'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section />"'
            'offside_dedent'


    it @ 'self closing with attr (1)', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section class=\'nice\' />'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section "'
            'jsx_attr_name "class="'
            "jsx_attr_str1 \"'nice' \""
            'jsx_tag_part "/>"'
            'offside_dedent'

    it @ 'self closing with two attrs (1)', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section class=\'nice\' style=\'color: "red"\' />'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section "'
            'jsx_attr_name "class="'
            'jsx_attr_str1 "\'nice\' "'
            'jsx_attr_name "style="'
            'jsx_attr_str1 "\'color: \\"red\\"\' "'
            'jsx_tag_part "/>"'
            'offside_dedent'



    it @ 'self closing with attr (2)', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section class="nice" />'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section "'
            'jsx_attr_name "class="'
            'jsx_attr_str2 "\\"nice\\" "'
            'jsx_tag_part "/>"'
            'offside_dedent'

    it @ 'self closing with two attrs (2)', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section class="nice" style="color: \'red\'" />'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section "'
            'jsx_attr_name "class="'
            'jsx_attr_str2 "\\"nice\\" "'
            'jsx_attr_name "style="'
            'jsx_attr_str2 "\\"color: \'red\'\\" "'
            'jsx_tag_part "/>"'
            'offside_dedent'

    it @ 'self closing with param', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section {param} />'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section "'
            'jsx_param "{"'
            'src "param"'
            'jsx_param_end "}"'
            'jsx_tag_part " />"'
            'offside_dedent'



  describe @ 'JSX nested', @=> ::
    it @ 'body', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<outer>'
        '  <first>aaaa</first>'
        '  <second>bbbb</second>'
        '  <third />'
        '</outer>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<outer>"'
             'offside_dedent'

        @[] 'jsx_tag "<first>"'
            'jsx_content "aaaa"'
            'jsx_tag_close "</first>"'
            'offside_dedent'

        @[] 'jsx_tag "<second>"'
            'jsx_content "bbbb"'
            'jsx_tag_close "</second>"'
            'offside_dedent'

        @[] 'jsx_tag "<third />"'
             'offside_dedent'

        @[] 'jsx_tag_close "</outer>"'
            'offside_dedent'


    it @ 'body with mixed attrs', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<outer>'
        '  <first class="nice">aaaa</first>'
        '  <second class=\'some\' {extra}/>'
        '  <third class={param}>cccc</first>'
        '</outer>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<outer>"'
            'offside_dedent'

        @[] 'jsx_tag "<first "'
            'jsx_attr_name "class="'
            'jsx_attr_str2 "\\"nice\\""'
            'jsx_tag_part ">"'
            'jsx_content "aaaa"'
            'jsx_tag_close "</first>"'
            'offside_dedent'

        @[] 'jsx_tag "<second "'
            'jsx_attr_name "class="'
            'jsx_attr_str1 "\'some\' "'
            'jsx_param "{"'
            'src "extra"'
            'jsx_param_end "}"'
            'jsx_tag_part "/>"'
            'offside_dedent'

        @[] 'jsx_tag "<third "'
            'jsx_attr_name "class="'
            'jsx_param "{"'
            'src "param"'
            'jsx_param_end "}"'
            'jsx_tag_part ">"'
            'jsx_content "cccc</first>"'
            'offside_dedent'

        @[] 'jsx_content "</outer>"'
            'offside_dedent'



  describe @ 'with content param', @=> ::

    it @ 'basic body with content param', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section>before{param}after</section>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section>"'
            'jsx_content "before"'
            'jsx_param "{"'
            'src "param"'
            'jsx_param_end "}"'
            'jsx_content "after"'
            'jsx_tag_close "</section>"'
            'offside_dedent'


    it @ 'basic body with jsy_op in content param', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<section>before{caller @ param}after</section>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<section>"'
            'jsx_content "before"'
            'jsx_param "{"'
            'src "caller"'
            'jsy_op " @"'
            'src " param"'
            'jsx_param_end "}"'
            'jsx_content "after"'
            'jsx_tag_close "</section>"'
            'offside_dedent'

    it @ 'nested body with content param', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<outer>'
        '  <first>'
        '    <second>{param}</second>'
        '  </first>'
        '</outer>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<outer>"'
            'offside_dedent'

        @[] 'jsx_tag "<first>"'
            'offside_dedent'

        @[] 'jsx_tag "<second>"'
            'jsx_param "{"'
            'src "param"'
            'jsx_param_end "}"'
            'jsx_tag_close "</second>"'
            'offside_dedent'

        @[] 'jsx_tag_close "</first>"'
            'offside_dedent'

        @[] 'jsx_tag_close "</outer>"'
            'offside_dedent'


    it @ 'nested body with jsy_op in content param', @=> ::
      const offside_ast = scan_jsy_lines @#
        '<outer>'
        '  <first>'
        '    <second>{caller @ param}</second>'
        '  </first>'
        '</outer>'

      test_ast_tokens_content @ offside_ast,
        @[] 'jsx_tag "<outer>"'
            'offside_dedent'

        @[] 'jsx_tag "<first>"'
            'offside_dedent'

        @[] 'jsx_tag "<second>"'
            'jsx_param "{"'
            'src "caller"'
            'jsy_op " @"'
            'src " param"'
            'jsx_param_end "}"'
            'jsx_tag_close "</second>"'
            'offside_dedent'

        @[] 'jsx_tag_close "</first>"'
            'offside_dedent'

        @[] 'jsx_tag_close "</outer>"'
            'offside_dedent'

