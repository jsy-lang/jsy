
import { genMochaSyntaxTestCases, standardTransforms } from './_xform_syntax_variations'
describe @ 'Previous Syntax Bugs',
  genMochaSyntaxTestCases @ iterSyntaxVariations, standardTransforms




function * iterSyntaxVariations() ::
  yield * iterBugWithBlankFirstLine()
  yield * iterBugWithOptionalCommas()


function * iterBugWithOptionalCommas() ::
  yield @{} expectValid: true
    title: 'Msg-Fabric plugin/web problem with optional commas'
    source: @[]
      'websock.addEventListener @ "open"'
      '  () => resolve()'
      '  @{} passive: true, once: true'
    
    tokens: @[] 'name', '.', 'name', '(', 'string', ',', '(', ')', '=>', 'name', '(', ')', ',', '{', 'name', ':', 'true', ',', 'name', ':', 'true', '}', ')'

  yield @{} expectValid: true
    title: 'Msg-Fabric plugin/web problem with optional commas'
    source: @[]
      'websock.addEventListener @ "open"'
      '  (() => resolve())'
      '  @{} passive: true, once: true'
    
    tokens: @[] 'name', '.', 'name', '(', 'string', ',', '(', '(', ')', '=>', 'name', '(', ')', ')', ',', '{', 'name', ':', 'true', ',', 'name', ':', 'true', '}', ')'


  yield @{} expectValid: true
    title: 'Msg-Fabric plugin/web problem with optional commas'
    source: @[]
      'websock.addEventListener @ "open"'
      '  @=> resolve()'
      '  @{} passive: true, once: true'
    
    tokens: @[] 'name', '.', 'name', '(', 'string', ',', '(', '(', ')', '=>', 'name', '(', ')', ')', ',', '{', 'name', ':', 'true', ',', 'name', ':', 'true', '}', ')'


function * iterBugWithBlankFirstLine() ::
  yield @{} expectValid: true
    title: 'Filled first line of block '
    source: @[]
      'const a = @{}'
      '    v1: 1'
      '  , v2: \'two\''
      ''
      '  , v3: null'
    tokens: @[] 'const', 'name', '=', '{', 'name', ':', 'num', ',', 'name', ':', 'string', ',', 'name', ':', 'null', '}'

  yield @{} expectValid: true
    title: 'Blank first line of block '
    source: @[]
      'const a = @{}'
      ''
      '    v1: 1'
      '  , v2: \'two\''
      ''
      '  , v3: null'
    tokens: @[] 'const', 'name', '=', '{', 'name', ':', 'num', ',', 'name', ':', 'string', ',', 'name', ':', 'null', '}'

