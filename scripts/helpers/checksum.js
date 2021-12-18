const crypto = require('crypto')
const fsp = require('fs').promises

const m = {}
module.exports = m

m.checksumFile = async (filePath) => {
  const contents = await fsp.readFile(filePath, 'base64')
  return m.checksumString(contents)
}

m.checksumString = (string) => {
  return crypto.createHash('sha1').update(string).digest('hex')
}
