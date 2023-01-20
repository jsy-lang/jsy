
import { genMochaSyntaxTestCases, standardTransforms } from './_xform_syntax_variations'

const v_bind_this = @[] '.', 'name', '(', 'this', ')'

describe @ 'Lambda Async Generator Call Statements',
  genMochaSyntaxTestCases @ iterLambdaAsyncGeneratorCalls, standardTransforms


function * iterLambdaAsyncGeneratorCalls() ::
  yield * iterLambdaAsyncGeneratorSimpleCalls()
  yield * iterBlockLambdaAsyncGeneratorSimpleCalls()

  yield * iterLambdaAsyncGeneratorNestedCalls()
  yield * iterBlockLambdaAsyncGeneratorNestedCalls()


function * iterLambdaAsyncGeneratorSimpleCalls() ::
  yield @{}
    title: 'call lambda async generator with no arguments (post)'
    source: @[] 'fn_target @=>>* expr'
    tokens: @[] 'name', '(', '(', 'name', 'function', '*', '(', ')', '{', 'name', '}', ')', ... v_bind_this, ')'

  yield @{}
    title: 'call lambda async generator with two arguments (post)'
    source: @[] 'fn_target @\\ a, b =>>* expr'
    tokens: @[] 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', 'name', ')', '{', 'name', '}', ')', ... v_bind_this, ')'

  yield @{}
    title: 'call lambda async generator with two arguments, arg-list second (post)'
    source: @[] 'fn_target @\\ a, ...b =>>* expr'
    tokens: @[] 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '...', 'name', ')', '{', 'name', '}', ')', ... v_bind_this, ')'

  yield @{}
    title: 'call lambda async generator with two arguments, unpack second by position (post)'
    source: @[] 'fn_target @\\ a, [b] =>>* expr'
    tokens: @[] 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', '}', ')', ... v_bind_this, ')'

  yield @{}
    title: 'call lambda async generator with two arguments, unpack second by name (post)'
    source: @[] 'fn_target @\\ a, {b} =>>* expr'
    tokens: @[] 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', '}', ')', ... v_bind_this, ')'





function * iterBlockLambdaAsyncGeneratorSimpleCalls() ::
  yield @{}
    title: 'call lambda async generator with no arguments'
    source: @[]
      'fn_target @::>*'
      '  block'
    tokens: @[] 'name', '(', '(', 'name', 'function', '*', '(', ')', '{', 'name', '}', ')', ...v_bind_this, ')'

  yield @{}
    title: 'call lambda async generator with two arguments'
    source: @[]
      'fn_target @\\ a, b ::>*'
      '  block'
    tokens: @[] 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', 'name', ')', '{', 'name', '}', ')', ...v_bind_this, ')'

  yield @{}
    title: 'call lambda async generator with two arguments, arg-list second '
    source: @[]
      'fn_target @\\ a, ...b ::>*'
      '  block'
    tokens: @[] 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '...', 'name', ')', '{', 'name', '}', ')', ...v_bind_this, ')'

  yield @{}
    title: 'call lambda async generator with two arguments, unpack second by position'
    source: @[]
      'fn_target @\\ a, [b] ::>*'
      '  block'
    tokens: @[] 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', '}', ')', ...v_bind_this, ')'

  yield @{}
    title: 'call lambda async generator with two arguments, unpack second by name'
    source: @[]
      'fn_target @\\ a, {b} ::>*'
      '  block'
    tokens: @[] 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', '}', ')', ...v_bind_this, ')'



function * iterLambdaAsyncGeneratorNestedCalls() ::
  yield @{}
    title: 'call lambda async generator with no arguments, two lines'
    source: @[]
      'outer @ fn_target @=>>*'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', 'function', '*', '(', ')', '{', 'name', '}', ')', ...v_bind_this, ')', ')'

  yield @{}
    title: 'call lambda async generator with two arguments, two lines'
    source: @[]
      'outer @ fn_target @\\ a, b =>>*'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', 'name', ')', '{', 'name', '}', ')', ...v_bind_this, ')', ')'

  yield @{}
    title: 'call lambda async generator with two arguments, arg-list second '
    source: @[]
      'outer @ fn_target @\\ a, ...b =>>*'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '...', 'name', ')', '{', 'name', '}', ')', ...v_bind_this, ')', ')'

  yield @{}
    title: 'call lambda async generator with two arguments, unpack second by position'
    source: @[]
      'outer @ fn_target @\\ a, [b] =>>*'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', '}', ')', ...v_bind_this, ')', ')'

  yield @{}
    title: 'call lambda async generator with two arguments, unpack second by name'
    source: @[]
      'outer @ fn_target @\\ a, {b} =>>*'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', '}', ')', ...v_bind_this, ')', ')'

function * iterBlockLambdaAsyncGeneratorNestedCalls() ::
  yield @{}
    title: 'call lambda async generator with no arguments, two lines'
    source: @[]
      'outer @ fn_target @::>*'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', 'function', '*', '(', ')', '{', 'name', 'name', '}', ')', ...v_bind_this, ')', ')'

  yield @{}
    title: 'call lambda async generator with two arguments, two lines'
    source: @[]
      'outer @ fn_target @\\ a, b ::>*'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', 'name', ')', '{', 'name', 'name', '}', ')', ...v_bind_this, ')', ')'

  yield @{}
    title: 'call lambda async generator with two arguments, arg-list second '
    source: @[]
      'outer @ fn_target @\\ a, ...b ::>*'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '...', 'name', ')', '{', 'name', 'name', '}', ')', ...v_bind_this, ')', ')'

  yield @{}
    title: 'call lambda async generator with two arguments, unpack second by position'
    source: @[]
      'outer @ fn_target @\\ a, [b] ::>*'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', 'name', '}', ')', ...v_bind_this, ')', ')'

  yield @{}
    title: 'call lambda async generator with two arguments, unpack second by name'
    source: @[]
      'outer @ fn_target @\\ a, {b} ::>*'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', 'function', '*', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', 'name', '}', ')', ...v_bind_this, ')', ')'

