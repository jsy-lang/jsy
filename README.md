# jsy-transpile
[![Build Status](https://travis-ci.org/jsy-lang/jsy-transpile.svg?branch=master)](https://travis-ci.org/jsy-lang/jsy-transpile)

JSY is an indented (offside) JavaScript dialect. We believe indentation is better at describing code blocks.

This is an offside (indention) JSY syntax transpiler to standard JavaScript with zero dependencies — e.g. No Babel, no Acorn!

Please see [JSY language docs](https://github.com/jsy-lang/jsy-lang-docs) for details on the JSY dialect.

## Use from the command line

This module utilizes Node's fs.promises API - ensure Node is at version 10+.

Install globally with `npm install -g jsy-transpile`

Transpile a file with `jsy-transpile test.jsy > test.js`
