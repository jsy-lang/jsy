
import { genMochaSyntaxTestCases, standardTransforms } from './_xform_syntax_variations'

describe @ 'Tilde Generator Call Statements',
  genMochaSyntaxTestCases @ iterTildeGeneratorCalls, standardTransforms


function * iterTildeGeneratorCalls() ::
  yield * iterBlockTildeGeneratorSimpleCalls()
  yield * iterBlockTildeGeneratorNestedCalls()


function * iterBlockTildeGeneratorSimpleCalls() ::
  yield @{}
    title: 'call tidle generator with no arguments'
    source: @[]
      'fn_target @~::*'
      '  block'
    tokens: @[] 'name', '(', 'function', '*', '(', ')', '{', 'name', '}', ')'

  yield @{}
    title: 'call tidle generator with two arguments'
    source: @[]
      'fn_target @~ a, b ::*'
      '  block'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', 'name', ')', '{', 'name', '}', ')'

  yield @{}
    title: 'call tidle generator with two arguments, arg-list second '
    source: @[]
      'fn_target @~ a, ...b ::*'
      '  block'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '...', 'name', ')', '{', 'name', '}', ')'

  yield @{}
    title: 'call tidle generator with two arguments, unpack second by position'
    source: @[]
      'fn_target @~ a, [b] ::*'
      '  block'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', '}', ')'

  yield @{}
    title: 'call tidle generator with two arguments, unpack second by name'
    source: @[]
      'fn_target @~ a, {b} ::*'
      '  block'
    tokens: @[] 'name', '(', 'function', '*', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', '}', ')'



function * iterBlockTildeGeneratorNestedCalls() ::
  yield @{}
    title: 'call tidle generator with no arguments, two lines'
    source: @[]
      'outer @ fn_target @~::*'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', ')', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call tidle generator with two arguments, two lines'
    source: @[]
      'outer @ fn_target @~ a, b ::*'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', 'name', ')', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call tidle generator with two arguments, arg-list second '
    source: @[]
      'outer @ fn_target @~ a, ...b ::*'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', '...', 'name', ')', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call tidle generator with two arguments, unpack second by position'
    source: @[]
      'outer @ fn_target @~ a, [b] ::*'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', '[', 'name', ']', ')', '{', 'name', 'name', '}', ')', ')'

  yield @{}
    title: 'call tidle generator with two arguments, unpack second by name'
    source: @[]
      'outer @ fn_target @~ a, {b} ::*'
      '  stmt_a'
      '  stmt_b'
    tokens: @[] 'name', '(', 'name', '(', 'function', '*', '(', 'name', ',', '{', 'name', '}', ')', '{', 'name', 'name', '}', ')', ')'

