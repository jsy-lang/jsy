# `@jsy-lang/jsy` (formerly `jsy-transpile`)

JSY is a syntax for ECMAScript/JavaScript using offside indentation to
describe code blocks like Python, CoffeeScript, or WISP.

This library is the JSY syntax tranpiler and scanner written in JSY itself.
Zero runtime dependencies. No Babel. No Acorn.
6262 unit tests and counting.

Please see [JSY language docs](https://github.com/jsy-lang/jsy-lang-docs) for details on the JSY dialect.


## Use

- Start from a template via `npm init jsy` – see [npm-create-jsy](https://github.com/jsy-lang/npm-create-jsy)
- With [Rollup](https://rollupjs.org) via [rollup-plugin-jsy](https://github.com/jsy-lang/rollup-plugin-jsy)
- Use `--loader` feature with `node --loader @jsy-lang/nodejs some-demo.jsy`
- Transpile via `npx @jsy-lang/jsy some-demo.jsy`


## Use directly from HTML

```html
...
<script type='module' src='https://cdn.jsdelivr.net/npm/@jsy-lang/jsy@latest/jsy-script.js'></script>
...
<jsy-script src='./some-demo.jsy'></jsy-script>
...
```

## License

[BSD-2-Clause License](./LICENSE)

