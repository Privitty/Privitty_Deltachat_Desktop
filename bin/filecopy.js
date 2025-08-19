#!/usr/bin/env node
//@ts-check
import { copyFile, mkdir, readdir, stat } from 'fs/promises'

async function copy(source, destination, watch = false) {
  await copyFile(source, destination)
}

function main() {
  /** @type {any} TODO type? */
  let options = {
    showHelp: false,
    watch: false,
    source: false,
    destination: false,
  }

  for (let i = 2; i < process.argv.length; i++) {
    let arg = process.argv[i]
    if (arg === '--help' || arg === '-h') {
      options.showHelp = true
      break
    } else if (arg == '--watch' || arg === '-w') {
      options.watch = true
    } else if (options.source === false) {
      options.source = arg
    } else if (options.destination === false) {
      options.destination = arg
    } else {
      console.error('- Unknown arguments. Please see help.')
    }
  }

  if (options.showHelp) {
    console.log(`copy-files.js <source> <destination> [OPTIONS]
Source is the source folder from where this tool should copy all files to destination.
It will copy all files & folders INSIDE the source folder to the destination folder.
Options:
--help  | -h       Show this help
--watch | -w       Watch for file changes`)
    return
  } else if (options.source === false) {
    return console.error('- no source folder specified. See --help.')
  } else if (options.destination === false) {
    return console.error('- no destination folder specified. See --help.')
  } else {
    copy(options.source, options.destination, options.watch)
  }
}

main()
