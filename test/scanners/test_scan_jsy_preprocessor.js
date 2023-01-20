const { assert } = require('chai')
import { jsy_transpile, scan_jsy } from 'jsy-transpile/esm/all.js'
import { scan_jsy_lines, jsy_scan_throws, test_ast_tokens_content } from './_ast_test_utils'
const { SourceMapGenerator } = require('source-map')

describe @ 'JSY Scanner (preprocessor)', @=> ::
  describe @ 'scenarios', @=> ::
    let ast_src
    beforeEach @=> ::
      ast_src = scan_jsy_lines @#
        '#!/usr/bin/env jsy-node'
        ''
        '# TESTME'
        '  if test() ::'
        '    console.log @'
        '      "hello JSY world with compile time processing!"'
        'if after() ::'
        '  console.log @'
        '    "hello JSY world!"'

    it @ 'default', @=> ::
      const js_src = jsy_transpile @ ast_src

      assert.deepEqual @ js_src.split('\n'), @[]
        '#!/usr/bin/env jsy-node'
        ''
        '# TESTME'
        '  if (test()) {'
        '    console.log('
        '      "hello JSY world with compile time processing!") }'
        'if (after()) {',
        '  console.log(',
        '    "hello JSY world!") }'

    it @ 'include', @=> ::
      const js_src = jsy_transpile @ ast_src, @{}
        preprocess: p => true

      assert.deepEqual @ js_src.split('\n'), @[]
        '#!/usr/bin/env jsy-node'
        ''
        ''
        'if (test()) {'
        '  console.log('
        '    "hello JSY world with compile time processing!") }'
        'if (after()) {',
        '  console.log(',
        '    "hello JSY world!") }'

    it @ 'replace', @=> ::
      const js_src = jsy_transpile @ ast_src, @{}
        preprocess: p => '//'+p.content

      assert.deepEqual @ js_src.split('\n'), @[]
        '#!/usr/bin/env jsy-node'
        ''
        '//# TESTME'
        '  if (test()) {'
        '    console.log('
        '      "hello JSY world with compile time processing!") }'
        'if (after()) {',
        '  console.log(',
        '    "hello JSY world!") }'

    it @ 'exclude', @=> ::
      const js_src = jsy_transpile @ ast_src, @{}
        preprocess: p => false

      assert.deepEqual @ js_src.split('\n'), @[]
        '#!/usr/bin/env jsy-node'
        ''
        ''
        ''
        ''
        ''
        'if (after()) {',
        '  console.log(',
        '    "hello JSY world!") }'

    it @ 'advanced', @=>> ::
      const log = []
      const js_src = jsy_transpile @ ast_src, @{}
        preprocess: (p, add_xform) =>
          add_xform @:
            process(src_parts, ln) ::
              log.push @# 'process', ln.loc.start.line, src_parts.join('')
            done(ln) ::
              log.push @# 'done', ln.loc.start.line, ln.source

      assert.deepEqual @ js_src.split('\n'), @[]
        '#!/usr/bin/env jsy-node'
        ''
        ''
        ''
        ''
        ''
        'if (after()) {',
        '  console.log(',
        '    "hello JSY world!") }'

      assert.deepEqual @ log, @[]
        @[] "process", 4, "  if (test()) {"
        @[] "process", 5, "    console.log("
        @[] "process", 6, "      \"hello JSY world with compile time processing!\") }"
        @[] "done",    7, "if after() ::"


  describe @ 'IF / ELIF', @=> ::

    describe @ 'one-level', @=> ::

      let ast_src
      beforeEach @=> ::
        ast_src = scan_jsy_lines @#
          '# IF PLAT_WEB'
          '  body_web'
          ''
          '# ELIF PLAT_NODEJS'
          '  body_nodejs'
          ''
          '# ELSE'
          '  body_else'

      it @ 'PLAT_WEB', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} PLAT_WEB: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          'body_web'

      it @ 'PLAT_NODEJS', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} PLAT_NODEJS: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          'body_nodejs'

      it @ 'ELSE', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: {}

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          'body_else'


    describe @ 'two-level', @=> ::

      let ast_src
      beforeEach @=> ::
        ast_src = scan_jsy_lines @#
          '# IF PLAT_WEB'
          '  # IF OPT_A'
          '    body_web_opt_a'
          ''
          '  # ELIF OPT_B'
          '    body_web_opt_b'
          ''
          '  # ELSE'
          '    body_web_else'
          ''
          '# ELIF PLAT_NODEJS'
          '  # IF OPT_A'
          '    body_nodejs_opt_a'
          ''
          '  # ELIF OPT_B'
          '    body_nodejs_opt_b'
          ''
          '  # ELSE'
          '    body_nodejs_else'
          ''

      it @ 'PLAT_WEB OPT_A', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} PLAT_WEB: true, OPT_A: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          '  body_web_opt_a'

      it @ 'PLAT_WEB OPT_B', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} PLAT_WEB: true, OPT_B: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          '  body_web_opt_b'

      it @ 'PLAT_WEB ELSE', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} PLAT_WEB: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          '  body_web_else'

      it @ 'PLAT_NODEJS OPT_A', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} PLAT_NODEJS: true, OPT_A: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          '  body_nodejs_opt_a'

      it @ 'PLAT_NODEJS OPT_B', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} PLAT_NODEJS: true, OPT_B: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          '  body_nodejs_opt_b'

      it @ 'PLAT_NODEJS ELSE', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} PLAT_NODEJS: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          '  body_nodejs_else'

      it @ 'ELSE', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} OPT_A: true, OPT_B: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]

    describe @ 'eval shunting yard', @=> ::

      let ast_src
      beforeEach @=> ::
        ast_src = scan_jsy_lines @#
          '# IF OPT_A && OPT_B && OPT_C'
          '    body_abc'
          '# ELIF OPT_A && OPT_C || OPT_B && OPT_C'
          '    body_ac_or_bc'
          '# ELIF OPT_A || OPT_B && OPT_C'
          '    body_a_or_bc'
          '# ELIF OPT_A && OPT_B || OPT_C'
          '    body_ab_or_c'
          '# ELSE'
          '    body_last'

      it @ 'A && B && C', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} OPT_A: true, OPT_B: true, OPT_C: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          'body_abc'

      it @ 'A', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} OPT_A: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          'body_a_or_bc'

      it @ 'B', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} OPT_B: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          'body_last'

      it @ 'C', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} OPT_C: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          'body_ab_or_c'

      it @ 'BC', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} OPT_B: true, OPT_C: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          'body_ac_or_bc'

      it @ 'AB', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} OPT_A: true, OPT_B: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          'body_a_or_bc'

      it @ 'AC', @=> ::
        const js_src = jsy_transpile @ ast_src, @{}
          defines: @{} OPT_A: true, OPT_C: true

        assert.deepEqual @ js_src.split('\n').filter(Boolean), @[]
          'body_ac_or_bc'

