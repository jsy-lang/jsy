#!/usr/bin/env node
try { require('source-map-support/register') } catch (err) {}

require('./cjs/cli_transpile.cjs')
  .main(process.argv.slice(2).pop())
