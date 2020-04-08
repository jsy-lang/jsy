#!/usr/bin/env node
require('./cjs/cli_transpile.cjs')
  .main(process.argv.slice(2).pop())
