import { genMochaSyntaxTestCases, standardTransforms } from './_xform_syntax_variations'

describe @ 'Immediately Invoked Expressions', @=> ::

  describe @ 'Immediately Invoked Function Expressions',
    genMochaSyntaxTestCases @ iterImmediatelyInvokedFunctionExpressionTests, standardTransforms

  describe @ 'Immediately Invoked Async Function Expressions',
    genMochaSyntaxTestCases @ iterImmediatelyInvokedGeneratorExpressionTests, standardTransforms

  describe @ 'Immediately Invoked Function Expressions (Variants)',
    genMochaSyntaxTestCases @ iterImmediatelyInvokedGeneratorExpressionVariationsTests

  describe @ 'Immediately Invoked Block Expressions',
    genMochaSyntaxTestCases @ iterImmediatelyInvokedBlockExpressionTests, standardTransforms


function * iterImmediatelyInvokedFunctionExpressionTests() ::
  yield * iterIIArrowExpressions()
  yield * iterIIFuncExpressions()

  yield * iterIIAsyncArrowExpressions()
  yield * iterIIAsyncFuncExpressions()

function * iterImmediatelyInvokedGeneratorExpressionTests() ::
  yield * iterIIGeneratorExpressions('@!*')
  yield * iterIIAsyncGeneratorExpressions('@!>*')

function * iterImmediatelyInvokedGeneratorExpressionVariationsTests() ::
  yield * iterIIGeneratorExpressions('@!=>*')

  yield * iterIIAsyncGeneratorExpressions('@!>*')
  yield * iterIIAsyncGeneratorExpressions('@!=>>*')

function * iterImmediatelyInvokedBlockExpressionTests() ::
  yield * iterIIBlockExpressions()
  yield * iterIIAsyncBlockExpressions()



function * iterIIArrowExpressions() ::
  yield @{}
    title: 'arrow expression (@!=>)'
    source: '@!=> expression_body'
    tokens: @[] '(', '(', ')', '=>', 'name', ')', '(', ')'

  yield @{}
    title: 'arrow expression - two lines (@!=>)'
    source: @[]
      '@!=>'
      '  expression_body'
    tokens: @[] '(', '(', ')', '=>', 'name', ')', '(', ')'

  yield @{}
    title: 'arrow block expression (@!=>)'
    source: @[]
      '@!=> ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] '(', '(', ')', '=>', '{', 'name', 'name', '}', ')', '(', ')'


function * iterIIAsyncArrowExpressions() ::
  yield @{}
    title: 'async arrow expression (@!=>>)'
    source: '@!=>> await expression_body'
    tokens: @[] '(', 'name', '(', ')', '=>', 'name', 'name', ')', '(', ')'

  yield @{}
    title: 'async arrow expression - two lines (@!=>>)'
    source: @[]
      '@!=>>'
      '  await expression_body'
    tokens: @[] '(', 'name', '(', ')', '=>', 'name', 'name', ')', '(', ')'

  yield @{}
    title: 'async arrow block expression (@!=>>)'
    source: @[]
      '@!=>> ::'
      '  await stmt_a'
      '  await stmt_b'
    tokens: @[] '(', 'name', '(', ')', '=>', '{', 'name', 'name', 'name', 'name', '}', ')', '(', ')'


function * iterIIFuncExpressions() ::
  yield @{}
    title: 'immediately invoked expression (@!)'
    source: '@! expression_body'
    tokens: @[] '(', '(', ')', '=>', '{', 'name', '}', ')', '(', ')'

  yield @{}
    title: 'immediately invoked expression - two lines (@!)'
    source: @[]
      '@!'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] '(', '(', ')', '=>', '{', 'name', 'name', '}', ')', '(', ')'

  yield @{}
    title: 'immediately invoked expression (@!)'
    source: @[]
      '@! ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] '(', '(', ')', '=>', '{', '{', 'name', 'name', '}', '}', ')', '(', ')'


function * iterIIAsyncFuncExpressions() ::
  yield @{}
    title: 'async immediately invoked expression (@!>)'
    source: '@!> await expression_body'
    tokens: @[] '(', 'name', '(', ')', '=>', '{', 'name', 'name', '}', ')', '(', ')'

  yield @{}
    title: 'async immediately invoked expression - two lines (@!>)'
    source: @[]
      '@!>'
      '  await stmt_a'
      '  await stmt_b'
    tokens: @[] '(', 'name', '(', ')', '=>', '{', 'name', 'name', 'name', 'name', '}', ')', '(', ')'

  yield @{}
    title: 'async immediately invoked expression (@!>)'
    source: @[]
      '@!> ::'
      '  await stmt_a'
      '  await stmt_b'
    tokens: @[] '(', 'name', '(', ')', '=>', '{', '{', 'name', 'name', 'name', 'name', '}', '}', ')', '(', ')'


function * iterIIGeneratorExpressions(variant='@!*') ::
  yield @{}
    title: `immediately invoked generator expression (${variant})`
    source: `${variant} yield expression_body`
    tokens: @[] '(', 'function', '*', '(', ')', '{', 'name', 'name', '}', ')', '.', 'name', '(', 'this', ')'

  yield @{}
    title: `immediately invoked generator expression - two lines (${variant})`
    source: @[]
      variant
      '  yield stmt_a'
      '  yield stmt_b'
    tokens: @[] '(', 'function', '*', '(', ')', '{', 'name', 'name', 'name', 'name', '}', ')', '.', 'name', '(', 'this', ')'

  yield @{}
    title: `immediately invoked generator expression (${variant})`
    source: @[]
      `${variant} ::`
      '  yield stmt_a'
      '  yield stmt_b'
    tokens: @[] '(', 'function', '*', '(', ')', '{', '{', 'name', 'name', 'name', 'name', '}', '}', ')', '.', 'name', '(', 'this', ')'



function * iterIIAsyncGeneratorExpressions(variant='@!>*') ::
  yield @{}
    title: `async immediately invoked generator expression (${variant})`
    source: `${variant} yield await expression_body`
    tokens: @[] '(', 'name', 'function', '*', '(', ')', '{', 'name', 'name', 'name', '}', ')', '.', 'name', '(', 'this', ')'

  yield @{}
    title: `async immediately invoked generator expression - two lines (${variant})`
    source: @[]
      variant
      '  yield await stmt_a'
      '  yield await stmt_b'
    tokens: @[] '(', 'name', 'function', '*', '(', ')', '{', 'name', 'name', 'name', 'name', 'name', 'name', '}', ')', '.', 'name', '(', 'this', ')'

  yield @{}
    title: `async immediately invoked generator expression (${variant})`
    source: @[]
      `${variant} ::`
      '  yield await stmt_a'
      '  yield await stmt_b'
    tokens: @[] '(', 'name', 'function', '*', '(', ')', '{', '{', 'name', 'name', 'name', 'name', 'name', 'name', '}', '}', ')', '.', 'name', '(', 'this', ')'



function * iterIIBlockExpressions() ::
  yield @{}
    title: 'immediately invoked block expression (::!)'
    source: '::! expression_body'
    tokens: @[] ';', '(', '(', ')', '=>', '{', 'name', '}', ')', '(', ')', ';'

  yield @{}
    title: 'immediately invoked block expression - two lines (::!)'
    source: @[]
      '::!'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] ';', '(', '(', ')', '=>', '{', 'name', 'name', '}', ')', '(', ')', ';'

  yield @{}
    title: 'immediately invoked block expression (::!)'
    source: @[]
      '::!'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] ';', '(', '(', ')', '=>', '{', 'name', 'name', '}', ')', '(', ')', ';'


function * iterIIAsyncBlockExpressions() ::
  yield @{}
    title: 'async immediately invoked block expression (::!>)'
    source: '::!> await expression_body'
    tokens: @[] ';', '(', 'name', '(', ')', '=>', '{', 'name', 'name', '}', ')', '(', ')', ';'

  yield @{}
    title: 'async immediately invoked block expression - two lines (::!>)'
    source: @[]
      '::!>'
      '  await stmt_a'
      '  await stmt_b'
    tokens: @[] ';', '(', 'name', '(', ')', '=>', '{', 'name', 'name', 'name', 'name', '}', ')', '(', ')', ';'

  yield @{}
    title: 'async immediately invoked block expression (::!>)'
    source: @[]
      '::!> ::'
      '  await stmt_a'
      '  await stmt_b'
    tokens: @[] ';', '(', 'name', '(', ')', '=>', '{', '{', 'name', 'name', 'name', 'name', '}', '}', ')', '(', ')', ';'


