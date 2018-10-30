#!/usr/bin/env node
const fs = require('fs')
const { promisify } = require('util')
const { jsy_transpile } = require('jsy-transpile')

try { require('source-map-support').install() } catch (err) {}

let SourceMapGenerator
try { SourceMapGenerator = require('source-map').SourceMapGenerator } catch (err) {}

async function main(filename) {
  const jsy_src = filename && '-' !== filename
    ? await promisify(fs.readFile)(filename, 'utf-8')
    : await read_stdin()

  if (! jsy_src) throw new Error('jsy-transpile expected a filename argument or stdin input')

  const sourcemap = filename && SourceMapGenerator && new SourceMapGenerator()
  //sourcemap.setSourceContent(filename, jsy_src)

  const src = jsy_transpile(jsy_src, {
    addSourceMapping(arg) {
      if (!sourcemap) return
      arg.source = filename
      sourcemap.addMapping(arg)
    },
    inlineSourceMap() {
      if (!sourcemap) return
      return sourcemap.toString()
    }
  })

  process.stdout.write(src)
}

function read_stdin(stdin) {
  // from MIT © Sindre Sorhus, https://github.com/sindresorhus/get-stdin/blob/83c5c9f9059f0a66a6c9acef03c19546e2cb175b/index.js
  if (null == stdin)
    stdin = process.stdin
  return new Promise(resolve => {
    if (stdin.isTTY)
      return resolve(null)

    stdin.setEncoding('utf8')

    let ret = ''
    stdin.on('end', () => resolve(ret))
    stdin.on('readable', () => {
      let chunk
      while (chunk = stdin.read())
        ret += chunk
    }) }) }

main(process.argv.slice(2).pop())
