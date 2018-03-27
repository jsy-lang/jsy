#!/usr/bin/env node
const {promisify} = require('util')
const readFile = promisify(require('fs').readFile)
const {jsy_scanner} = require('../dist')

const filename = process.argv.slice(-1)[0]
readFile(filename, 'utf-8')
  .then(content =>
    jsy_scanner(content,
      {file: `${filename}.js`, source: filename}))

  .then(res => res.src_code())
  .then(src => new Function(src))

