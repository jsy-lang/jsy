
import { genMochaSyntaxTestCases, standardTransforms } from './_xform_syntax_variations'

const v_bind_this = @[] '.', 'name', '(', 'this', ')'

describe @ 'Lambda Generator Call Statements',
  genMochaSyntaxTestCases @ iterLambdaGeneratorCalls, standardTransforms


function * iterLambdaGeneratorCalls() ::
  yield * iterLambdaGeneratorSimpleCalls()
  yield * iterBlockLambdaGeneratorSimpleCalls()

  yield * iterLambdaGeneratorNestedCalls()
  yield * iterBlockLambdaGeneratorNestedCalls()


function * iterLambdaGeneratorSimpleCalls() ::

  yield @{}
    title: 'call lambda generator with two arguments'
    source: @[] 'fn_target @\\* a, b => expr'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', 'name', ')', '{', 'name', '}', ')', ... v_bind_this

  yield @{}
    title: 'call lambda generator with two arguments, arg-list second '
    source: @[] 'fn_target @\\* a, ...b => expr'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '...', 'name', ')', '{', 'name', '}', ')', ... v_bind_this

  yield @{}
    title: 'call lambda generator with two arguments, unpack second by position'
    source: @[] 'fn_target @\\* a, [b] => expr'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', '}', ')', ... v_bind_this

  yield @{}
    title: 'call lambda generator with two arguments, unpack second by name'
    source: @[] 'fn_target @\\* a, {b} => expr'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', '}', ')', ... v_bind_this


  yield @{}
    title: 'call lambda generator with two arguments (post)'
    source: @[] 'fn_target @\\ a, b =>* expr'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', 'name', ')', '{', 'name', '}', ')', ... v_bind_this

  yield @{}
    title: 'call lambda generator with two arguments, arg-list second (post)'
    source: @[] 'fn_target @\\ a, ...b =>* expr'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '...', 'name', ')', '{', 'name', '}', ')', ... v_bind_this

  yield @{}
    title: 'call lambda generator with two arguments, unpack second by position (post)'
    source: @[] 'fn_target @\\ a, [b] =>* expr'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', '}', ')', ... v_bind_this

  yield @{}
    title: 'call lambda generator with two arguments, unpack second by name (post)'
    source: @[] 'fn_target @\\ a, {b} =>* expr'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', '}', ')', ... v_bind_this





function * iterBlockLambdaGeneratorSimpleCalls() ::
  yield @{}
    title: 'call lambda generator with two arguments'
    source: @[]
      'fn_target @\\* a, b ::'
      '  block'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', 'name', ')', '{', 'name', '}', ')', ...v_bind_this

  yield @{}
    title: 'call lambda generator with two arguments, arg-list second '
    source: @[]
      'fn_target @\\* a, ...b ::'
      '  block'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '...', 'name', ')', '{', 'name', '}', ')', ...v_bind_this

  yield @{}
    title: 'call lambda generator with two arguments, unpack second by position'
    source: @[]
      'fn_target @\\* a, [b] ::'
      '  block'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', '}', ')', ...v_bind_this

  yield @{}
    title: 'call lambda generator with two arguments, unpack second by name'
    source: @[]
      'fn_target @\\* a, {b} ::'
      '  block'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', '}', ')', ...v_bind_this



function * iterLambdaGeneratorNestedCalls() ::
  yield @{}
    title: 'call lambda generator with two arguments, two lines'
    source: @[]
      'outer @ fn_target @\\* a, b =>'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', 'name', ')', '{', 'name', '}', ')', ...v_bind_this, ')'

  yield @{}
    title: 'call lambda generator with two arguments, arg-list second '
    source: @[]
      'outer @ fn_target @\\ a, ...b =>*'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', '...', 'name', ')', '{', 'name', '}', ')', ...v_bind_this, ')'

  yield @{}
    title: 'call lambda generator with two arguments, unpack second by position'
    source: @[]
      'outer @ fn_target @\\* a, [b] =>'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', '}', ')', ...v_bind_this, ')'

  yield @{}
    title: 'call lambda generator with two arguments, unpack second by name'
    source: @[]
      'outer @ fn_target @\\ a, {b} =>*'
      '  expr'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', '}', ')', ...v_bind_this, ')'

function * iterBlockLambdaGeneratorNestedCalls() ::
  yield @{}
    title: 'call lambda generator with two arguments, two lines'
    source: @[]
      'outer @ fn_target @\\* a, b ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', 'name', ')', '{', 'name', 'name', '}', ')', ...v_bind_this, ')'

  yield @{}
    title: 'call lambda generator with two arguments, arg-list second '
    source: @[]
      'outer @ fn_target @\\* a, ...b ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', '...', 'name', ')', '{', 'name', 'name', '}', ')', ...v_bind_this, ')'

  yield @{}
    title: 'call lambda generator with two arguments, unpack second by position'
    source: @[]
      'outer @ fn_target @\\* a, [b] ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', 'name', '}', ')', ...v_bind_this, ')'

  yield @{}
    title: 'call lambda generator with two arguments, unpack second by name'
    source: @[]
      'outer @ fn_target @\\* a, {b} ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', 'name', '}', ')', ...v_bind_this, ')'

