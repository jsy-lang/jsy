const tiny_load = src =>
  new Promise((onload, onerror) =>
    document.head.appendChild(
      Object.assign(
        document.createElement('script'),
        {src, onload, onerror},
        'string'===typeof src && src.startsWith('http')
          ? {crossorigin: true}
          : null ) ))

const unittest_root = window.unittest_root || window.location
const deps = [
  'https://unpkg.com/mocha@5.2.0/mocha.js',
  'https://unpkg.com/chai@4.1.2/chai.js',
  'https://unpkg.com/acorn@5.7.2/dist/acorn.js',
  'https://unpkg.com/source-map@0.7.3/dist/source-map.js',
  new URL('./umd/jsy-transpile.js', unittest_root),
]

Promise
.all(deps.map(tiny_load))
.then(async () => {
  window.mocha.setup({ ui: 'bdd' })
  window['source-map'] = window.sourceMap
  window.require = module => window[module]

  await tiny_load(new URL('./test/__unittest.iife.js', unittest_root))

  mocha.run()
})
