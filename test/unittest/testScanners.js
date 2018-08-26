
import { genMochaSyntaxTestCases, standardTransforms } from './_xform_syntax_variations'

describe @ 'JavaScript Scanners',
  genMochaSyntaxTestCases @ iterSyntaxVariations, standardTransforms

function * iterSyntaxVariations() ::
  yield @{} expectValid: true
      title: 'Multi-line template string (``)'
      source: @[]
        'offside_ast = scan_javascript @ `'
        '  export function hash_fnv32(sz) ::'
        '    // FNV32, from https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function#FNV-1a_hash'
        '    let h = 0x811C9DC5 // fnv-1a 32 bit initial value'
        '    for let i=0; i < sz.length; i++ ::'
        '      h ^= sz.charCodeAt(i)'
        '      h += (h << 24) + (h << 8) + (h << 7) + (h << 4) + (h << 1)'
        '    return h'
        '  `'
      tokens: @[] 'name', '=', 'name', '(', '`', 'template', '`', ')'

  yield @{} expectValid: true
      title: 'Multi-line comment string (/* */)'
      source: @[]
        'offside_ast = scan_javascript /*'
        '  export function hash_fnv32(sz) ::'
        '    // FNV32, from https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function#FNV-1a_hash'
        '    let h = 0x811C9DC5 // fnv-1a 32 bit initial value'
        '    for let i=0; i < sz.length; i++ ::'
        '      h ^= sz.charCodeAt(i)'
        '      h += (h << 24) + (h << 8) + (h << 7) + (h << 4) + (h << 1)'
        '    return h'
        '  */'
      tokens: @[] 'name', '=', 'name'
