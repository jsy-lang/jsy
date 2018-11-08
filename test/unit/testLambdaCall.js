
import { genMochaSyntaxTestCases, standardTransforms } from './_xform_syntax_variations'

describe @ 'Lambda Call Statements',
  genMochaSyntaxTestCases @ iterLambdaCalls, standardTransforms


function * iterLambdaCalls() ::
  yield * iterLambdaSimpleCalls()
  yield * iterBlockLambdaSimpleCalls()

  yield * iterLambdaNestedCalls()
  yield * iterBlockLambdaNestedCalls()


function * iterLambdaSimpleCalls() ::
  yield @{}
    title: 'call lambda with two arguments'
    source: @[] 'fn_target @\\ a, b => expr'
    tokens: @[] 'name', '(', '(', 'name', ',', 'name', ')', '=>', 'name', ')'

  yield @{}
    title: 'call lambda with two arguments, arg-list second '
    source: @[] 'fn_target @\\ a, ...b => expr'
    tokens: @[] 'name', '(', '(', 'name', ',', '...', 'name', ')', '=>', 'name', ')'

  yield @{}
    title: 'call lambda with two arguments, unpack second by position'
    source: @[] 'fn_target @\\ a, [b] => expr'
    tokens: @[] 'name', '(', '(', 'name', ',', '[', 'name', ']', ')', '=>', 'name', ')'

  yield @{}
    title: 'call lambda with two arguments, unpack second by name'
    source: @[] 'fn_target @\\ a, {b} => expr'
    tokens: @[] 'name', '(', '(', 'name', ',', '{', 'name', '}', ')', '=>', 'name', ')'



function * iterBlockLambdaSimpleCalls() ::
  yield @{}
    title: 'call lambda with two arguments'
    source: @[]
      'fn_target @\\ a, b ::'
      '  block'
    tokens: @[] 'name', '(', '(', 'name', ',', 'name', ')', '=>', '{', 'name', '}', ')'

  yield @{}
    title: 'call lambda with two arguments, arg-list second '
    source: @[]
      'fn_target @\\ a, ...b ::'
      '  block'
    tokens: @[] 'name', '(', '(', 'name', ',', '...', 'name', ')', '=>', '{', 'name', '}', ')'

  yield @{}
    title: 'call lambda with two arguments, unpack second by position'
    source: @[]
      'fn_target @\\ a, [b] ::'
      '  block'
    tokens: @[] 'name', '(', '(', 'name', ',', '[', 'name', ']', ')', '=>', '{', 'name', '}', ')'

  yield @{}
    title: 'call lambda with two arguments, unpack second by name'
    source: @[]
      'fn_target @\\ a, {b} ::'
      '  block'
    tokens: @[] 'name', '(', '(', 'name', ',', '{', 'name', '}', ')', '=>', '{', 'name', '}', ')'



function * iterLambdaNestedCalls() ::
  yield @{}
    title: 'call lambda with two arguments, two lines'
    source: @[]
      'outer @ fn_target @\\ a, b =>'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', ',', 'name', ')', '=>', 'name', ')', ')'

  yield @{}
    title: 'call lambda with two arguments, arg-list second '
    source: @[]
      'outer @ fn_target @\\ a, ...b =>'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', ',', '...', 'name', ')', '=>', 'name', ')', ')'

  yield @{}
    title: 'call lambda with two arguments, unpack second by position'
    source: @[]
      'outer @ fn_target @\\ a, [b] =>'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', ',', '[', 'name', ']', ')', '=>', 'name', ')', ')'

  yield @{}
    title: 'call lambda with two arguments, unpack second by name'
    source: @[]
      'outer @ fn_target @\\ a, {b} =>'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', ',', '{', 'name', '}', ')', '=>', 'name', ')', ')'

function * iterBlockLambdaNestedCalls() ::
  yield @{}
    title: 'call lambda with two arguments, two lines'
    source: @[]
      'outer @ fn_target @\\ a, b ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', ',', 'name', ')', '=>', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call lambda with two arguments, arg-list second '
    source: @[]
      'outer @ fn_target @\\ a, ...b ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', ',', '...', 'name', ')', '=>', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call lambda with two arguments, unpack second by position'
    source: @[]
      'outer @ fn_target @\\ a, [b] ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', ',', '[', 'name', ']', ')', '=>', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call lambda with two arguments, unpack second by name'
    source: @[]
      'outer @ fn_target @\\ a, {b} ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', '(', 'name', ',', '{', 'name', '}', ')', '=>', '{', 'name', 'name', '}', ')', ')'

