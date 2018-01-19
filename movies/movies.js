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
          resolve(sortMoviesByWatchDate(moviesByYear))
        })
        .catch(reject)
    })
  })
}

function sortMoviesByWatchDate(moviesByYear) {
  let movies = []
  moviesByYear.forEach((json) => (movies = movies.concat(JSON.parse(json))))
  movies.sort((a, b) => (a.watch_date < b.watch_date ? 1 : a.watch_date > b.watch_date ? -1 : 0))
  return movies
}
