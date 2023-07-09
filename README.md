# `@jsy-lang/jsy`
_(formerly [`jsy-transpile`](https://www.npmjs.com/package/jsy-transpile))_

JSY is a syntax dialect for ECMAScript using offside indentation
similar to [Python][] or [CoffeeScript][]
from ES5 to ES2023.


This library is the JSY tranpiler and scanner written in JSY itself.
Zero runtime dependencies. No Babel. No Acorn.
6262 unit tests and counting.

## Docs

- [JSY website](https://jsy-lang.github.io/)
- [JSY syntax dialect](https://github.com/jsy-lang/jsy-lang-docs) for details on the JSY dialect.


## Use

- With [Rollup][] via [`rollup-plugin-jsy`](https://github.com/jsy-lang/rollup-plugin-jsy)
- Start from a template via `npm init jsy` – see [`npm-create-jsy`](https://github.com/jsy-lang/npm-create-jsy)
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

### Background and History

Inspired by an indented dialect of LISP called [Wisp][],
JSY primarily operates as a scanner-pass syntax transformation to change
indented (offside) code into the corresponding open/close matching token
JavaScript code. Thus the internal scanning parser only has to be aware of
`/* comments */` and `"string literals"` rules to successfully transform code.
Thus, as a dialect, **JSY automatically keeps pace with modern JavaScript editions!**

Our opinion is that indentation is a strong expression of the author's
intention, and should be observed by the language dialect.
As a dialect, JSY leading operators opt into the offside indentation,
and standard JavaScript continues to work without modification.
As a code author, indentation frees you from painstakingly matching open/close
sections `{} () []` so you can focus on the logic.
As a code reader, your screen is uncluttered by lines of closing punctuation --
allowing you to focus on the logic.


This project originally started as [Babel][] extension plugin. In 2018, we
transitioned the project to a scanner-based text transformation library
independent of the Babel ecosystem, designed to work with [Rollup][] and
similar transpilation tools in the JavaScript ecosystem. We've been iterating
it, growing and testing the operators, eating our own dogfood, building an
extensive test suite, and adapting it to new tools like [Parcel][],
[ESBuild][], and [Vite][].

Acknowledging that many dislike indented languages. JSY was not made for you. 
JSY was made for ourselves first -- the thing we wished existed.
And now JSY is offered for everyone who prefers indention over open/close punctuation.
We hope some of you enjoy using it; we certainly do.


## License

[BSD-2-Clause License](./LICENSE)




 [Python]: https://www.python.org
 [CoffeeScript]: https://coffeescript.org
 [Wisp]: http://www.draketo.de/english/wisp
 [Babel]: https://babeljs.io
 [Rollup]: https://rollupjs.org
 [Parcel]: https://parceljs.org
 [ESBuild]: https://esbuild.github.io
 [Vite]: https://vitejs.dev
