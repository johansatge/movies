const crypto = require('crypto')
const fsp = require('fs').promises
const path = require('path')

const m = {}
module.exports = m

m.checksumString = (string) => {
  return crypto.createHash('sha1').update(string).digest('hex')
}

m.copyFileWithHash = async (sourcePath, destDir) => {
  const contents = await fsp.readFile(sourcePath, 'base64')
  const hash = m.checksumString(contents)
  const pathParts = path.parse(sourcePath)
  const filename = `${pathParts.name}.${hash}${pathParts.ext}`
  await fsp.copyFile(sourcePath, path.join(destDir, filename))
  return filename
}
