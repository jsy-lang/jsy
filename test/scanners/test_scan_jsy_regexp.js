import { scan_jsy_lines, test_ast_tokens_content } from './_ast_test_utils'

describe @ 'JSY RegExp handling', @=> ::
  it @ 'allow division operator', @=> ::
    const offside_ast = scan_jsy_lines @#
      'line1'
      'const expr = first/second'
      'line3'

    test_ast_tokens_content @ offside_ast,
      @[] 'src "line1"'
          'offside_dedent'

      @[] 'src "const expr = first/second"'
          'offside_dedent'

      @[] 'src "line3"'
          'offside_dedent'

  it @ 'allow regexp with single quote tokens', @=> ::
    const offside_ast = scan_jsy_lines @#
      'line1'
      "const rx_single_quote = /first ' second/"
      'line3'

    test_ast_tokens_content @ offside_ast,
      @[] 'src "line1"'
          'offside_dedent'

      @[] 'src "const rx_single_quote = "'
          "regexp /first ' second/"
          'offside_dedent'

      @[] 'src "line3"'
          'offside_dedent'

  it @ 'allow regexp with double quote tokens', @=> ::
    const offside_ast = scan_jsy_lines @#
      'line1'
      'const rx_double_quote = /first " second/'
      'line3'

    test_ast_tokens_content @ offside_ast,
      @[] 'src "line1"'
          'offside_dedent'

      @[] 'src "const rx_double_quote = "'
          'regexp /first " second/'
          'offside_dedent'

      @[] 'src "line3"'
          'offside_dedent'

  it @ 'allow regexp with template quote tokens', @=> ::
    const offside_ast = scan_jsy_lines @#
      'line1'
      'const rx_multi_quote = /first ` second/'
      'line3'

    test_ast_tokens_content @ offside_ast,
      @[] 'src "line1"'
          'offside_dedent'

      @[] 'src "const rx_multi_quote = "'
          'regexp /first ` second/'
          'offside_dedent'

      @[] 'src "line3"'
          'offside_dedent'

  it @ 'allow complex regexp with quote tokens', @=> ::
    const offside_ast = scan_jsy_lines @#
      'line1'
      'const rx_close = /\\s*($|\\/?>|[{\'"]|[a-zA-Z0-9_:.\\-]+=)/'
      'line3'

    test_ast_tokens_content @ offside_ast,
      @[] 'src "line1"'
          'offside_dedent'

      @[] 'src "const rx_close = "'
          'regexp /\\s*($|\\/?>|[{\'"]|[a-zA-Z0-9_:.\\-]+=)/'
          'offside_dedent'

      @[] 'src "line3"'
          'offside_dedent'

  it @ 'allow complex regexp with nested slashes', @=> ::
    const offside_ast = scan_jsy_lines @#
      'line1'
      'const rx_close = /(^[*!]|[/()[\\]{}"])/'
      'line3'

    test_ast_tokens_content @ offside_ast,
      @[] 'src "line1"'
          'offside_dedent'

      @[] 'src "const rx_close = "'
          'regexp /(^[*!]|[/()[\\]{}"])/'
          'offside_dedent'

      @[] 'src "line3"'
          'offside_dedent'

  it @ 'a complex template string that fights like a regexp', @=> ::
    const offside_ast = scan_jsy_lines @#
      "return `//# ${'sourceMapping'}URL=data:application/json;charset=utf-8;base64,${b64}`}"

    test_ast_tokens_content @ offside_ast,
      @[] 'src "return "'
          'str_template "`//# ${"'
          'template_param ""'
          'str1 "\'sourceMapping\'"'
          'template_param_end "}"'
          'str_template "URL=data:application/json;charset=utf-8;base64,${"'
          'template_param ""'
          'src "b64"'
          'template_param_end "}"'
          'str_template "`"'
          'src "}"'
          'offside_dedent'

