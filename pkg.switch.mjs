import { parseArgs } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'


let readJson = async (filename) => 
  JSON.parse(await readFile(filename, 'utf-8'))

let {values:opt} =
  parseArgs({options:{
    legacy: { type: 'boolean', default: false }
  }})

let pkg = Object.assign(
  await readJson('./package.json'),
  await (opt.legacy
    ? readJson('./pkg.legacy.json')
    : readJson('./pkg.jsy-lang.json') ))

await writeFile('package.json',
  JSON.stringify(pkg, null, 2)+'\n')
