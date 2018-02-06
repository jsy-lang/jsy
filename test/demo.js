const {promisify} = require('util')
const readFile = promisify(require('fs').readFile)
const {jsy_scanner} = require('../dist')

const filename = process.argv.slice(-1).pop()
readFile(filename, 'utf-8')
  .then(content =>
    jsy_scanner(content,
      {file: `${filename}.js`, source: filename}))

  .then(res =>
    process.stdout.write(res.src_code()))

