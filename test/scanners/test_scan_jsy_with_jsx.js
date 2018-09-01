const { assert } = require('chai')
import { transpile_jsy } from 'jsy-transpile/esm/all'
import { scan_jsy_lines, test_ast_tokens_content, ast_tokens_content } from './_ast_test_utils'

describe @ 'JSY Scanner (with JSX expressions)', @=> ::
