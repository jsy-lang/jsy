const {promisify} = require('util')
const readFile = promisify(require('fs').readFile)
const {jsy_scanner} = require('../dist')

const mdblock = kind => `\n\`\`\`${kind||''}\n`
const mdb = mdblock()
const mdb_js = mdblock('javascript')

const filename = process.argv.slice(-1)[0]
readFile(filename, 'utf-8')
  .then(src => {
    process.stdout.write(`## Input\n${mdb_js}`)
    process.stdout.write(`${src.trim()}${mdb}\n`)
    return src })

  .then(content =>
    jsy_scanner(content,
      {file: `${filename}.js`, source: filename}))

  .then(res => res.src_code())

  .then(src => {
    process.stdout.write(`## Transpiled\n${mdb_js}`)
    process.stdout.write(`${src.trim()}${mdb}\n`)
    return src })

  .then(src => new Function(src))

  .then(async fn => {
    process.stdout.write(`## Output\n${mdb}`)
    await fn()
    process.stdout.write(`${mdb}\n`)
    return fn })


