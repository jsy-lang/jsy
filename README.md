# jsy-transpile
[![Build Status](https://travis-ci.org/jsy-lang/jsy-transpile.svg?branch=master)](https://travis-ci.org/jsy-lang/jsy-transpile)

JSY is an indented (offside) JavaScript dialect. We believe indentation is better at describing code blocks.

This is an offside (indention) JSY syntax transpiler to standard JavaScript with zero dependencies — e.g. No Babel, no Acorn!

Please see [JSY language docs](https://github.com/jsy-lang/jsy-lang-docs) for details on the JSY dialect.

## Use from the command line

Ensure you are using Node 10.x or later.

Install globally with `npm install -g jsy-transpile`

Transpile a JSY file with `npx jsy-transpile test.jsy > test.js`

Run a JSY file with `npx jsy-node test.jsy` – see [jsy-node](https://github.com/jsy-lang/jsy-node)

## Use from Bundlers

- via `npm init jsy` – see [npm-create-jsy](https://github.com/jsy-lang/npm-create-jsy)
- via Rollup with [rollup-plugin-jsy-lite](https://github.com/jsy-lang/rollup-plugin-jsy-lite)
- via Babel with [babel-plugin-jsy-lite](https://github.com/jsy-lang/babel-plugin-jsy-lite)

