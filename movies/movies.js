const fs = require('fs-extra')
const glob = require('glob')
const path = require('path')
const promisify = require('util').promisify

module.exports = {
  getByWatchDate,
}

function getByWatchDate() {
  return new Promise((resolve, reject) => {
    glob('*.json', {cwd: __dirname}, (error, files) => {
      const fileReaders = files.map((file) => promisify(fs.readFile)(path.join(__dirname, file), 'utf8'))
      Promise.all(fileReaders)
        .then((moviesByYear) => {
          let movies = []
          moviesByYear.forEach((json) => (movies = movies.concat(JSON.parse(json))))
          resolve(movies.reverse())
        })
        .catch(reject)
    })
  })
}
