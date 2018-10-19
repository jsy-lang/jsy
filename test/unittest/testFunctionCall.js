
import { genMochaSyntaxTestCases, standardTransforms } from './_xform_syntax_variations'
describe @ 'Function Call Statements',
  genMochaSyntaxTestCases @ iterCalls, standardTransforms

describe @ 'Arrow Call Statements',
  genMochaSyntaxTestCases @ iterArrowCalls, standardTransforms

describe @ 'Arrow Async Call Statements',
  genMochaSyntaxTestCases @ iterArrowAsyncCalls, standardTransforms

describe @ 'Arrow Generator Call Statements',
  genMochaSyntaxTestCases @ iterArrowGeneratorCalls, standardTransforms

describe @ 'Arrow Async Generator Call Statements',
  genMochaSyntaxTestCases @ iterArrowAsyncGeneratorCalls, standardTransforms

describe @ 'Function Array Call Statements',
  genMochaSyntaxTestCases @ iterArrayCalls, standardTransforms

describe @ 'Function Hash Call Statements',
  genMochaSyntaxTestCases @ iterHashCalls, standardTransforms


function * iterCalls() ::
  yield @{} expectValid: true
    title: 'simple call 0 args single line'
    source: @[] 'fn_target @'
    tokens: @[] 'name', '(', ')'

  yield @{} expectValid: true
    title: 'simple call 1 arg single line'
    source: @[] 'fn_target @ one'
    tokens: @[] 'name', '(', 'name', ')'

  yield @{} expectValid: true
    title: 'simple call 2 args single line'
    source: @[] 'fn_target @ one, two'
    tokens: @[] 'name', '(', 'name', ',', 'name', ')'


  yield @{} expectValid: true
    title: 'simple call 0 args multiple lines'
    source: @[]
      'fn_target @'
      ''
    tokens: @[] 'name', '(', ')'

  yield @{} expectValid: true
    title: 'simple call 1 arg multiple lines'
    source: @[] 'fn_target @ one'
    source: @[]
      'fn_target @'
      '  one'
    tokens: @[] 'name', '(', 'name', ')'

  yield @{} expectValid: true
    title: 'simple call 2 args multiple lines'
    source: @[]
      'fn_target @'
      '    one'
      '  , two'
    tokens: @[] 'name', '(', 'name', ',', 'name', ')'


function * iterHashCalls() ::
  yield @{} expectValid: true
    title: 'call with hash 0 args single line'
    source: @[] 'fn_target @:', ''
    tokens: @[] 'name', '(', '{', '}', ')'

  yield @{} expectValid: true
    title: 'call with hash 1 arg single line'
    source: @[] 'fn_target @: one'
    tokens: @[] 'name', '(', '{', 'name', '}', ')'

  yield @{} expectValid: true
    title: 'call with hash 2 args single line'
    source: @[] 'fn_target @: one, two'
    tokens: @[] 'name', '(', '{', 'name', ',', 'name', '}', ')'


  yield @{} expectValid: true
    title: 'call with hash 0 args multiple lines'
    source: @[]
      'fn_target @:'
      ''
    tokens: @[] 'name', '(', '{', '}', ')'

  yield @{} expectValid: true
    title: 'call with hash 1 arg multiple lines'
    source: @[] 'fn_target @: one'
    source: @[]
      'fn_target @:'
      '  one'
    tokens: @[] 'name', '(', '{', 'name', '}', ')'

  yield @{} expectValid: true
    title: 'call with hash 2 args multiple lines'
    source: @[]
      'fn_target @:'
      '    one'
      '  , two'
    tokens: @[] 'name', '(', '{', 'name', ',', 'name', '}', ')'


function * iterArrayCalls() ::
  yield @{} expectValid: true
    title: 'call with array 0 args single line'
    source: @[] 'fn_target @#', ''
    tokens: @[] 'name', '(', '[', ']', ')'

  yield @{} expectValid: true
    title: 'call with array 1 arg single line'
    source: @[] 'fn_target @# one'
    tokens: @[] 'name', '(', '[', 'name', ']', ')'

  yield @{} expectValid: true
    title: 'call with array 2 args single line'
    source: @[] 'fn_target @# one, two'
    tokens: @[] 'name', '(', '[', 'name', ',', 'name', ']', ')'


  yield @{} expectValid: true
    title: 'call with array 0 args multiple lines'
    source: @[]
      'fn_target @#'
      ''
    tokens: @[] 'name', '(', '[', ']', ')'

  yield @{} expectValid: true
    title: 'call with array 1 arg multiple lines'
    source: @[] 'fn_target @# one'
    source: @[]
      'fn_target @#'
      '  one'
    tokens: @[] 'name', '(', '[', 'name', ']', ')'

  yield @{} expectValid: true
    title: 'call with array 2 args multiple lines'
    source: @[]
      'fn_target @#'
      '    one'
      '  , two'
    tokens: @[] 'name', '(', '[', 'name', ',', 'name', ']', ')'


function * iterArrowCalls() ::
  yield @{} expectValid: true
    title: 'vanilla call arrow with single line'
    source: @[] 'fn_target @ () => value'
    tokens: @[] 'name', '(', '(', ')', '=>', 'name', ')'

  yield @{} expectValid: true
    title: 'call arrow with single line expression'
    source: @[] 'fn_target @=> value'
    tokens: @[] 'name', '(', '(', ')', '=>', 'name', ')'

  yield @{} expectValid: true
    title: 'call arrow with multiple line expression'
    source: @[]
      'fn_target @=>'
      '  value'
    tokens: @[] 'name', '(', '(', ')', '=>', 'name', ')'

  yield @{} expectValid: true
    title: 'call arrow with single line vanilla body'
    source: @[] 'fn_target @=> { value }'
    tokens: @[] 'name', '(', '(', ')', '=>', '{', 'name', '}', ')'

  yield @{} expectValid: true
    title: 'call arrow with single line body'
    source: @[] 'fn_target @=> :: value'
    tokens: @[] 'name', '(', '(', ')', '=>', '{', 'name', '}', ')'

  yield @{} expectValid: true
    title: 'call arrow with multiple line body'
    source: @[]
      'fn_target @=> ::'
      '  value'
      '  second'
    tokens: @[] 'name', '(', '(', ')', '=>', '{', 'name', 'name', '}', ')'

  yield @{} expectValid: true
    title: 'call arrow with multiple line paren expression'
    source: @[]
      'fn_target @=> @'
      '    value'
      '  , second'
    tokens: @[] 'name', '(', '(', ')', '=>', '(', 'name', ',', 'name', ')', ')'

  yield @{} expectValid: true
    title: 'call arrow with multiple line hash expression'
    source: @[]
      'fn_target @=> @:'
      '    value'
      '  , second'
    tokens: @[] 'name', '(', '(', ')', '=>', '(', '{', 'name', ',', 'name', '}', ')', ')'

  yield @{} expectValid: true
    title: 'call arrow with multiple line array expression'
    source: @[]
      'fn_target @=> @#'
      '    value'
      '  , second'
    tokens: @[] 'name', '(', '(', ')', '=>', '(', '[', 'name', ',', 'name', ']', ')', ')'


function * iterArrowAsyncCalls() ::
  yield @{} expectValid: true
    title: 'vanilla call async arrow with single line'
    source: @[] 'fn_target @ async () => value'
    tokens: @[] 'name', '(', 'name', '(', ')', '=>', 'name', ')'

  yield @{} expectValid: true
    title: 'call async arrow with single line expression'
    source: @[] 'fn_target @=>> value'
    tokens: @[] 'name', '(', 'name', '(', ')', '=>', 'name', ')'

  yield @{} expectValid: true
    title: 'call async arrow with multiple line expression'
    source: @[]
      'fn_target @=>>'
      '  value'
    tokens: @[] 'name', '(', 'name', '(', ')', '=>', 'name', ')'

  yield @{} expectValid: true
    title: 'call async arrow with single line vanilla body'
    source: @[] 'fn_target @=>> { value }'
    tokens: @[] 'name', '(', 'name', '(', ')', '=>', '{', 'name', '}', ')'

  yield @{} expectValid: true
    title: 'call async arrow with single line body'
    source: @[] 'fn_target @=>> :: value'
    tokens: @[] 'name', '(', 'name', '(', ')', '=>', '{', 'name', '}', ')'

  yield @{} expectValid: true
    title: 'call async arrow with multiple line body'
    source: @[]
      'fn_target @=>> ::'
      '  value'
      '  second'
    tokens: @[] 'name', '(', 'name', '(', ')', '=>', '{', 'name', 'name', '}', ')'

  yield @{} expectValid: true
    title: 'call async arrow with multiple line paren expression'
    source: @[]
      'fn_target @=>> @'
      '    value'
      '  , second'
    tokens: @[] 'name', '(', 'name', '(', ')', '=>', '(', 'name', ',', 'name', ')', ')'

  yield @{} expectValid: true
    title: 'call async arrow with multiple line hash expression'
    source: @[]
      'fn_target @=>> @:'
      '    value'
      '  , second'
    tokens: @[] 'name', '(', 'name', '(', ')', '=>', '(', '{', 'name', ',', 'name', '}', ')', ')'

  yield @{} expectValid: true
    title: 'call async arrow with multiple line array expression'
    source: @[]
      'fn_target @=>> @#'
      '    value'
      '  , second'
    tokens: @[] 'name', '(', 'name', '(', ')', '=>', '(', '[', 'name', ',', 'name', ']', ')', ')'


function * iterArrowGeneratorCalls() ::
  yield @{}
    title: `immediately invoked generator expression (@=>*)`
    source: `@=>* yield expression_body`
    tokens: @[] '(', 'function', '*', '(', ')', '{', 'name', 'name', '}', ')', '.', 'name', '(', 'this', ')'

  yield @{}
    title: `immediately invoked generator expression - two lines (@=>*)`
    source: @[]
      '@=>*'
      '  yield stmt_a'
      '  yield stmt_b'
    tokens: @[] '(', 'function', '*', '(', ')', '{', 'name', 'name', 'name', 'name', '}', ')', '.', 'name', '(', 'this', ')'

  yield @{}
    title: `immediately invoked generator expression (@=>*)`
    source: @[]
      `@=>* ::`
      '  yield stmt_a'
      '  yield stmt_b'
    tokens: @[] '(', 'function', '*', '(', ')', '{', '{', 'name', 'name', 'name', 'name', '}', '}', ')', '.', 'name', '(', 'this', ')'


function * iterArrowAsyncGeneratorCalls() ::
  yield @{}
    title: `async immediately invoked generator expression (@=>>*)`
    source: `@=>>* yield await expression_body`
    tokens: @[] '(', 'name', 'function', '*', '(', ')', '{', 'name', 'name', 'name', '}', ')', '.', 'name', '(', 'this', ')'

  yield @{}
    title: `async immediately invoked generator expression - two lines (@=>>*)`
    source: @[]
      '@=>>*'
      '  yield await stmt_a'
      '  yield await stmt_b'
    tokens: @[] '(', 'name', 'function', '*', '(', ')', '{', 'name', 'name', 'name', 'name', 'name', 'name', '}', ')', '.', 'name', '(', 'this', ')'

  yield @{}
    title: `async immediately invoked generator expression (@=>>*)`
    source: @[]
      `@=>>* ::`
      '  yield await stmt_a'
      '  yield await stmt_b'
    tokens: @[] '(', 'name', 'function', '*', '(', ')', '{', '{', 'name', 'name', 'name', 'name', 'name', 'name', '}', '}', ')', '.', 'name', '(', 'this', ')'

