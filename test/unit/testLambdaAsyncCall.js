
import { genMochaSyntaxTestCases, standardTransforms } from './_xform_syntax_variations'

describe @ 'Lambda Async Call Statements',
  genMochaSyntaxTestCases @ iterLambdaAsyncCalls, standardTransforms


function * iterLambdaAsyncCalls() ::
  yield * iterLambdaAsyncSimpleCalls()
  yield * iterBlockLambdaAsyncSimpleCalls()

  yield * iterLambdaAsyncNestedCalls()
  yield * iterBlockLambdaAsyncNestedCalls()


function * iterLambdaAsyncSimpleCalls() ::
  yield @{}
    title: 'call async lambda with two arguments'
    source: @[] 'fn_target @\\> a, b => expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', 'name', ')', '=>', 'name', ')'

  yield @{}
    title: 'call async lambda with two arguments, arg-list second '
    source: @[] 'fn_target @\\> a, ...b => expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', '...', 'name', ')', '=>', 'name', ')'

  yield @{}
    title: 'call async lambda with two arguments, unpack second by position'
    source: @[] 'fn_target @\\> a, [b] => expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', '[', 'name', ']', ')', '=>', 'name', ')'

  yield @{}
    title: 'call async lambda with two arguments, unpack second by name'
    source: @[] 'fn_target @\\> a, {b} => expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', '{', 'name', '}', ')', '=>', 'name', ')'


  yield @{}
    title: 'call async lambda with two arguments (post)'
    source: @[] 'fn_target @\\ a, b =>> expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', 'name', ')', '=>', 'name', ')'

  yield @{}
    title: 'call async lambda with two arguments, arg-list second (post)'
    source: @[] 'fn_target @\\ a, ...b =>> expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', '...', 'name', ')', '=>', 'name', ')'

  yield @{}
    title: 'call async lambda with two arguments, unpack second by position (post)'
    source: @[] 'fn_target @\\ a, [b] =>> expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', '[', 'name', ']', ')', '=>', 'name', ')'

  yield @{}
    title: 'call async lambda with two arguments, unpack second by name (post)'
    source: @[] 'fn_target @\\ a, {b} =>> expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', '{', 'name', '}', ')', '=>', 'name', ')'


function * iterBlockLambdaAsyncSimpleCalls() ::
  yield @{}
    title: 'call async lambda with two arguments'
    source: @[]
      'fn_target @\\> a, b ::'
      '  block'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', 'name', ')', '=>', '{', 'name', '}', ')'

  yield @{}
    title: 'call async lambda with two arguments, arg-list second '
    source: @[]
      'fn_target @\\> a, ...b ::'
      '  block'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', '...', 'name', ')', '=>', '{', 'name', '}', ')'

  yield @{}
    title: 'call async lambda with two arguments, unpack second by position'
    source: @[]
      'fn_target @\\> a, [b] ::'
      '  block'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', '[', 'name', ']', ')', '=>', '{', 'name', '}', ')'

  yield @{}
    title: 'call async lambda with two arguments, unpack second by name'
    source: @[]
      'fn_target @\\> a, {b} ::'
      '  block'
    tokens: @[] 'name', '(', 'name', '(', 'name', ',', '{', 'name', '}', ')', '=>', '{', 'name', '}', ')'



function * iterLambdaAsyncNestedCalls() ::
  yield @{}
    title: 'call async lambda with two arguments, two lines'
    source: @[]
      'outer @ fn_target @\\> a, b =>'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', '(', 'name', ',', 'name', ')', '=>', 'name', ')', ')'

  yield @{}
    title: 'call async lambda with two arguments, arg-list second '
    source: @[]
      'outer @ fn_target @\\> a, ...b =>'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', '(', 'name', ',', '...', 'name', ')', '=>', 'name', ')', ')'

  yield @{}
    title: 'call async lambda with two arguments, unpack second by position'
    source: @[]
      'outer @ fn_target @\\> a, [b] =>'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', '(', 'name', ',', '[', 'name', ']', ')', '=>', 'name', ')', ')'

  yield @{}
    title: 'call async lambda with two arguments, unpack second by name'
    source: @[]
      'outer @ fn_target @\\> a, {b} =>'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', 'name', '(', 'name', ',', '{', 'name', '}', ')', '=>', 'name', ')', ')'

function * iterBlockLambdaAsyncNestedCalls() ::
  yield @{}
    title: 'call async lambda with two arguments, two lines'
    source: @[]
      'outer @ fn_target @\\> a, b ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'name', '(', 'name', ',', 'name', ')', '=>', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call async lambda with two arguments, arg-list second '
    source: @[]
      'outer @ fn_target @\\> a, ...b ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'name', '(', 'name', ',', '...', 'name', ')', '=>', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call async lambda with two arguments, unpack second by position'
    source: @[]
      'outer @ fn_target @\\> a, [b] ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'name', '(', 'name', ',', '[', 'name', ']', ')', '=>', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call async lambda with two arguments, unpack second by name'
    source: @[]
      'outer @ fn_target @\\> a, {b} ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'name', '(', 'name', ',', '{', 'name', '}', ')', '=>', '{', 'name', 'name', '}', ')', ')'

