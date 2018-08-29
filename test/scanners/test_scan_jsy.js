const { assert } = require('chai')
import { transpile_jsy, scan_jsy } from 'jsy-transpile/esm/all'
import { test_ast_tokens_content, ast_tokens_content } from './_ast_test_utils'
const { SourceMapGenerator } = require('source-map')

describe @ 'JSY Scanner (doc example)', @=> ::
  let offside_ast, offside_src
  beforeEach @=> ::
    // source from https://github.com/shanewholloway/js-consistent-fnvxor32/blob/d2554377c4a540258f93f2958d4259c1f4f03ff9/code/fnvxor32.jsy on 2018-08-09
    offside_ast = scan_jsy @ offside_src = `
      const apiUrl = 'http://api.example.com'

      class ExampleApi extends SomeBaseClass ::
        constructor( credentials ) ::
          const apiCall = async ( pathName, body ) => ::
            const res = await fetch @ \`$\{apiUrl}/$\{pathName}\`, @{}
                method: 'POST'
              , headers: @{}
                'Content-Type': 'application/json'
              , body: JSON.stringify @ body

            return await res.json()

          Object.assign @ this, @{}
              add: data => apiCall @ 'add', data
            , modify: data => apiCall @ 'send', data
            , retrieve: data => apiCall @ 'get', data

        compare(a,b) ::
          if a > b ::
            console.log @ 'JSY is the best!'
          else if a < b ::
            console.log @ 'JSY rocks!'
          else ::
            console.log @ 'JSY is still awesome!'

        print_q(q) ::
          while 0 != q.length ::
            console.log @ q.pop()
      `

  it @ 'can self-verify locations match original source', @=> ::
    const to_source = node => node.loc.start.slice @ node.loc.end
    for const ln of offside_ast ::
      if ln.is_blank :: continue

      assert.equal @ ln.indent.indent, to_source(ln.indent)
      for const part of ln.content ::
        if !part.loc || !part.content :: continue

        assert.equal @ part.content, to_source(part)

  it @ 'transpiles to valid JavaScript', @=> ::
    const js_src = transpile_jsy @ offside_ast
    new Function(`{\njs_src\n}`)

  it @ 'has source-maps', @=> ::
    const sourcemap = new SourceMapGenerator()

    const source = 'example.jsy'
    sourcemap.setSourceContent @ source, offside_src

    const js_src = transpile_jsy @ offside_ast, @{}
      addSourceMapping(arg) ::
        arg.source = source
        sourcemap.addMapping(arg)
      inlineSourceMap() ::
        return sourcemap.toString()

    const rx_sourcemap = /^\/\/# sourceMappingURL=/m ;
    assert.ok @ rx_sourcemap.test(js_src)


describe @ 'JSY Scanner (misc)', @=> ::
  it @ 'hashbang', @=> ::
    const jsy_src = @[]
      '#!/usr/bin/env jsy-node'
      ''
      'if test() ::'
      '  console.log @'
      '    "hello JSY world!"'

    const js_src = transpile_jsy @ scan_jsy @ jsy_src.join('\n')
    assert.deepEqual @ js_src.split('\n'), @[]
      '#!/usr/bin/env jsy-node'
      ''
      'if( test()){'
      '  console.log('
      '    "hello JSY world!")}'

  it @ 'single template strings', @=> ::
    const jsy_src = @[]
      "const classes = `header ${ inner() } extra`"

    const offside_ast = scan_jsy @ jsy_src.join('\n')

    test_ast_tokens_content @ offside_ast, @[]
      @[] @[] 'src', 'const classes = '
          @[] 'str_multi', '`header ${'
          @[] 'template_param', ''
          @[] 'src', ' inner() '
          @[] 'template_param_end', '}'
          @[] 'str_multi', ' extra`'
          @[] 'offside_dedent', undefined

  it @ 'nested template strings', @=> ::
    const jsy_src = @[]
      "const classes = `header ${ isLargeScreen() ? '' :"
      "  `icon-${item.isCollapsed ? 'expander' : 'collapser'}` } extra`"

    const offside_ast = scan_jsy @ jsy_src.join('\n')

    test_ast_tokens_content @ offside_ast, @[]
      @[] @[] 'src', 'const classes = '
          @[] 'str_multi', '`header ${'
          @[] 'template_param', ''
          @[] 'src', ' isLargeScreen() ? '
          @[] 'str_single', "''"
          @[] 'src', ' :'
          @[] 'offside_dedent', undefined

      @[] @[] 'str_multi', '`icon-${'
          @[] 'template_param', ''
          @[] 'src', 'item.isCollapsed ? '
          @[] 'str_single', "'expander'"
          @[] 'src', ' : '
          @[] 'str_single', "'collapser'"
          @[] 'template_param_end', '}'
          @[] 'str_multi', '`'
          @[] 'src', ' '
          @[] 'template_param_end', '}'
          @[] 'str_multi', ' extra`'
          @[] 'offside_dedent', undefined

