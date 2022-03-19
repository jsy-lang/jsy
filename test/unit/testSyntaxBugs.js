
import { genMochaSyntaxTestCases, standardTransforms, moduleTopTransforms } from './_xform_syntax_variations'

describe @ 'Previous Syntax Bugs',
  genMochaSyntaxTestCases @ iterSyntaxVariations, standardTransforms

describe @ 'Optional Comma with Import / Export',
  genMochaSyntaxTestCases @ iterImportExportWithOptionalCommas, moduleTopTransforms



function * iterSyntaxVariations() ::
  yield * iterBugWithBlankFirstLine()
  yield * iterBugWithOptionalCommas()


function * iterImportExportWithOptionalCommas() ::
  yield @{}
    title: 'import with as names'
    source: @[]
      'import @{}'
      '  a'
      '  d as e, f as g'
      '  b as c'
      '  x, y, z'
      'from "some/module.js"'

    tokens: @[] 'import', '{', 'name', ',', 'name', 'name', 'name', ',', 'name', 'name', 'name', ',', 'name', 'name', 'name', ',', 'name', ',', 'name', ',', 'name', '}', 'name', 'string'

  yield @{}
    title: 'export with as names'
    source: @[]
      'let a,b,d,f,x,y,z'
      'export @{}'
      '  a'
      '  b as c'
      '  d as e, f as g'
      '  x, y, z'

    tokens: @[]
      // let expr
      'name' , 'name' , ',' , 'name' , ',' , 'name' , ',' , 'name' , ',' , 'name' , ',' , 'name' , ',' , 'name',
      // export expr
      'export', '{', 'name', ',', 'name', 'name', 'name', ',', 'name', 'name', 'name', ',', 'name', 'name', 'name', ',', 'name', ',', 'name', ',', 'name', '}'


function * iterBugWithOptionalCommas() ::
  yield @{}
    title: 'Msg-Fabric plugin/web problem with optional commas'
    source: @[]
      'websock.addEventListener @ "open"'
      '  () => resolve()'
      '  @{} passive: true, once: true'

    tokens: @[] 'name', '.', 'name', '(', 'string', ',', '(', ')', '=>', 'name', '(', ')', ',', '{', 'name', ':', 'true', ',', 'name', ':', 'true', '}', ')'

  yield @{}
    title: 'Msg-Fabric plugin/web problem with optional commas'
    source: @[]
      'websock.addEventListener @ "open"'
      '  (() => resolve())'
      '  @{} passive: true, once: true'

    tokens: @[] 'name', '.', 'name', '(', 'string', ',', '(', '(', ')', '=>', 'name', '(', ')', ')', ',', '{', 'name', ':', 'true', ',', 'name', ':', 'true', '}', ')'


  yield @{}
    title: 'Msg-Fabric plugin/web problem with optional commas'
    source: @[]
      'websock.addEventListener @ "open"'
      '  @=> resolve()'
      '  @{} passive: true, once: true'

    tokens: @[] 'name', '.', 'name', '(', 'string', ',', '(', '(', ')', '=>', 'name', '(', ')', ')', ',', '{', 'name', ':', 'true', ',', 'name', ':', 'true', '}', ')'

  yield @{}
    title: 'Msg-Fabric plugin/web problem with optional commas'
    source: @[]
      "  const find_ops = ({has, sans}) => all_ops.filter @ op => @"
      "       @ !has  || has .split(' ').every @ a => op.attrs.includes @ a"
      "    && @ !sans || sans.split(' ').every @ a => ! op.attrs.includes @ a"


function * iterBugWithBlankFirstLine() ::
  yield @{}
    title: 'Filled first line of block '
    source: @[]
      'const a = @{}'
      '    v1: 1'
      '  , v2: \'two\''
      ''
      '  , v3: null'
    tokens: @[] 'const', 'name', '=', '{', 'name', ':', 'num', ',', 'name', ':', 'string', ',', 'name', ':', 'null', '}'

  yield @{}
    title: 'Blank first line of block '
    source: @[]
      'const a = @{}'
      ''
      '    v1: 1'
      '  , v2: \'two\''
      ''
      '  , v3: null'
    tokens: @[] 'const', 'name', '=', '{', 'name', ':', 'num', ',', 'name', ':', 'string', ',', 'name', ':', 'null', '}'

