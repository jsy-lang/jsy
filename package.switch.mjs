import { parseArgs } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'


let {values:opt} =
  parseArgs({options:{
    legacy: { type: 'boolean', default: false }
  }})

let pkg_lib = readFile('./package.lib.json', 'utf-8').then(JSON.parse)
let pkg_about = readFile('./package.about.json', 'utf-8').then(JSON.parse)
let pkg_overlay = opt.legacy
  ? readFile('./package.legacy.json', 'utf-8').then(JSON.parse)
  : null

let pkg = {
    ... await pkg_about
  , ... await pkg_lib
  , ... await pkg_overlay
}

await writeFile('package.json',
  JSON.stringify(pkg, null, 2)+'\n')
