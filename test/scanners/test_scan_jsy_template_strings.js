const { assert } = require('chai')
import { transpile_jsy } from 'jsy-transpile/esm/all'
import { scan_jsy_lines, test_ast_tokens_content, ast_tokens_content, jsy_scan_throws } from './_ast_test_utils'


describe @ 'JSY Scanner (template strings)', @=> ::
  it @ 'dedent multi-line strings', @=> ::
    const jsy_src = @[]
      'test @ `'
      '     Wouldn\'t it be nice to have your multi-line strings'
      '   auto-shifted based on their indent?'
      ''
      '   After all, if you need greater control, you\'ll likely'
      '     have to manually format the strings anyway… `'

    const js_src = transpile_jsy @ scan_jsy_lines(jsy_src)
    assert.deepEqual @ js_src.split('\n'), @[]
      'test(`'
      '  Wouldn\'t it be nice to have your multi-line strings'
      'auto-shifted based on their indent?'
      ''
      'After all, if you need greater control, you\'ll likely'
      '  have to manually format the strings anyway… `)'


  it @ 'single template strings', @=> ::
    const offside_ast = scan_jsy_lines @#
      'const classes = `header ${ inner() } extra`'

    test_ast_tokens_content @ offside_ast,
      @[] 'src "const classes = "'
          'str_template "`header ${"'
          'template_param ""'
          'src " inner() "'
          'template_param_end "}"'
          'str_template " extra`"'
          'offside_dedent'

  it @ 'single template strings with $ in string', @=> ::
    const offside_ast = scan_jsy_lines @# '`$${name}$`'
    test_ast_tokens_content @ offside_ast,
      @[] 'str_template "`$${"'
          'template_param ""'
          'src "name"'
          'template_param_end "}"'
          'str_template "$`"'
          'offside_dedent'

  it @ 'single template strings with jsy_ops', @=> ::
    const offside_ast = scan_jsy_lines @#
      'const classes = `header ${ first @ second @# third, 42 } extra`'

    test_ast_tokens_content @ offside_ast,
      @[] 'src "const classes = "'
          'str_template "`header ${"'
          'template_param ""'
          'src " first"'
          'jsy_op " @"'
          'src " second"'
          'jsy_op " @#"'
          'src " third, 42 "'
          'template_param_end "}"'
          'str_template " extra`"'
          'offside_dedent'


  it @ 'regexp literal vs template internal', @=> ::
    const offside_ast = scan_jsy_lines @#
      "`$${a.b / 100} / ${c.d}`"

    test_ast_tokens_content @ offside_ast,
      @[] 'str_template "`$${"'
          'template_param ""'
          'src "a.b / 100"'
          'template_param_end "}"'
          'str_template " / ${"'
          'template_param ""'
          'src "c.d"'
          'template_param_end "}"'
          'str_template "`"'
          'offside_dedent'

  it @ 'nested template strings', @=> ::
    const offside_ast = scan_jsy_lines @#
      "const classes = `header ${ isLargeScreen() ? '' :"
      "  `icon-${item.isCollapsed ? 'expander' : 'collapser'}` } extra`"

    test_ast_tokens_content @ offside_ast,
      @[] 'src "const classes = "'
          'str_template "`header ${"'
          'template_param ""'
          'src " isLargeScreen() ? "'
          'str1 "\'\'"'
          'src " :"'
          'offside_dedent'

      @[] 'str_template "`icon-${"'
          'template_param ""'
          'src "item.isCollapsed ? "'
          'str1 "\'expander\'"'
          'src " : "'
          'str1 "\'collapser\'"'
          'template_param_end "}"'
          'str_template "`"'
          'src " "'
          'template_param_end "}"'
          'str_template " extra`"'
          'offside_dedent'



  describe @ 'Syntax Errors', @=> ::
    it @ 'crossing indent levels', @=> ::
      jsy_scan_throws @#
        'if cond_a ::'
        '  if cond_b ::'
        '    render @ `'
        '      <outer>'
        '       <first>'
        '        <second>content</second>'
        '     </first>'
        '  </outer>`'
        ''

    it @ 'mismatched closing in template param', @=> ::
      jsy_scan_throws @#
        'test @ `'
        '  hello ${'
        '    one({two:"three")}'
        '  } there `'
