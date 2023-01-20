
import { genMochaSyntaxTestCases, standardTransforms } from './_xform_syntax_variations'

describe @ 'Tilde Call Statements',
  genMochaSyntaxTestCases @ iterTildeCalls, standardTransforms


function * iterTildeCalls() ::
  yield * iterBlockTildeSimpleCalls()
  yield * iterBlockTildeNestedCalls()


function * iterBlockTildeSimpleCalls() ::
  yield @{}
    title: 'call tidle with no arguments'
    source: @[]
      'fn_target @~::'
      '  block'
    tokens: @[] 'name', '(', 'function', '(', ')', '{', 'name', '}', ')'

  yield @{}
    title: 'call tidle with two arguments'
    source: @[]
      'fn_target @~ a, b ::'
      '  block'
    tokens: @[] 'name', '(', 'function', '(', 'name', ',', 'name', ')', '{', 'name', '}', ')'

  yield @{}
    title: 'call tidle with two arguments'
    source: @[]
      'fn_target @~ a, b ::'
      '  block'
    tokens: @[] 'name', '(', 'function', '(', 'name', ',', 'name', ')', '{', 'name', '}', ')'

  yield @{}
    title: 'call tidle with two arguments, arg-list second '
    source: @[]
      'fn_target @~ a, ...b ::'
      '  block'
    tokens: @[] 'name', '(', 'function', '(', 'name', ',', '...', 'name', ')', '{', 'name', '}', ')'

  yield @{}
    title: 'call tidle with two arguments, unpack second by position'
    source: @[]
      'fn_target @~ a, [b] ::'
      '  block'
    tokens: @[] 'name', '(', 'function', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', '}', ')'

  yield @{}
    title: 'call tidle with two arguments, unpack second by name'
    source: @[]
      'fn_target @~ a, {b} ::'
      '  block'
    tokens: @[] 'name', '(', 'function', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', '}', ')'



function * iterBlockTildeNestedCalls() ::
  yield @{}
    title: 'call tidle with no arguments, two lines'
    source: @[]
      'outer @ fn_target @~::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '(', ')', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call tidle with two arguments, two lines'
    source: @[]
      'outer @ fn_target @~ a, b ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '(', 'name', ',', 'name', ')', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call tidle with two arguments, arg-list second '
    source: @[]
      'outer @ fn_target @~ a, ...b ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '(', 'name', ',', '...', 'name', ')', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call tidle with two arguments, unpack second by position'
    source: @[]
      'outer @ fn_target @~ a, [b] ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call tidle with two arguments, unpack second by name'
    source: @[]
      'outer @ fn_target @~ a, {b} ::'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', 'name', '}', ')', ')'

