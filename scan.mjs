#!/usr/bin/env node
//import { scan_jsy } from '@jsy-lang/jsy'
import { scan_jsy, iter_ast_ndjson } from 'jsy-transpile/esm/jsy/scan.js'
import { readFile } from 'node:fs/promises'

async function jsy_scan_main(filename, feedback={}) {
  try {
    let [jsy_src, source_ref] =
      filename && '-' !== filename
        ? [await readFile(filename, 'utf-8'), filename]
        : [await _read_stdin(), '<stdin>']

    if (! jsy_src)
      throw new Error('jsy-scan expected a filename argument or stdin input')

    let jsy_ast = scan_jsy(jsy_src, feedback)
    for (let ln of iter_ast_ndjson(jsy_ast))
      process.stdout.write( JSON.stringify(ln)+'\n' )
  } catch (err) {
    console.error(err)
    process.exit(1)
    return
  }
}


async function _read_stdin(stdin=process.stdin) {
  stdin.setEncoding('utf8')
  let contents = ''
  for await (let chunk of stdin)
    contents += chunk
  return contents
}


jsy_scan_main(process.argv.slice(2).pop())

