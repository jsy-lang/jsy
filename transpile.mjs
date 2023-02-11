#!/usr/bin/env node
//import { jsy_transpile_srcmap } from '@jsy-lang/jsy'
import { jsy_transpile_srcmap } from 'jsy-transpile'
import { readFile } from 'node:fs/promises'

async function jsy_transpile_main(filename, opt={}) {
  try {
    let [jsy_src, source_ref] =
      filename && '-' !== filename
        ? [await readFile(filename, 'utf-8'), filename]
        : [await _read_stdin(), '<stdin>']

    if (! jsy_src)
      throw new Error('jsy-transpile expected a filename argument or stdin input')

    opt.as_rec = false
    if (process.env.JSY_NOSRCMAP)
      opt.create_sourcemap = () => null
    else opt.sourcemap ??= 'inline'

    let defines = JSON.parse(process.env.JSY_DEFINES || null)
    if (defines) opt.defines = defines

    let source = jsy_transpile_srcmap(jsy_src, source_ref, opt)
    process.stdout.write(source)
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


jsy_transpile_main(process.argv.slice(2).pop())

