#!/usr/bin/env node
const fs = require('fs').promises
const {transpile_jsy} = require('../dist/transpile_jsy')
const {SourceMapGenerator} = require('source-map')

async function main(filename) {
  if (!filename) throw new Error('Expected filename')

  const jsy_src = await fs.readFile(filename, 'utf-8')

  const sourcemap = new SourceMapGenerator()
  //sourcemap.setSourceContent(filename, jsy_src)

  const src = transpile_jsy(jsy_src, {
    addSourceMapping(arg) {
      arg.source = filename
      sourcemap.addMapping(arg)
    },
    inlineSourceMap() {
      return sourcemap.toString()
    }
  })

  process.stdout.write(src)
}

main(process.argv.slice(2).pop())
