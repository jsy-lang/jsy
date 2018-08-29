const tiny_load = src =>
  new Promise((onload, onerror) =>
    document.head.appendChild(
      Object.assign(
        document.createElement('script'),
        {src, onload, onerror},
        src.startsWith('http')
          ? {crossorigin: true}
          : null ) ))

const deps = [
  'https://unpkg.com/mocha@5.2.0/mocha.js',
  'https://unpkg.com/chai@4.1.2/chai.js',
  'https://unpkg.com/acorn@5.7.2/dist/acorn.js',
  'https://unpkg.com/source-map@0.7.3/dist/source-map.js',
  './umd/jsy-transpile.js',
]

Promise
.all(deps.map(tiny_load))
.then(async () => {
  window.mocha.setup({ ui: 'bdd' })
  window['source-map'] = window.sourceMap
  window.require = module => window[module]

  await tiny_load('./test/__unittest.iife.js')

  mocha.run()
})
