const glob = require('glob')
const fs = require('fs').promises
const path = require('path')
const { fetchMovieData } = require('./helpers/tmdb.js')
const { fetchFormattedMovieData } = require('./helpers/movie.js')
const { log } = require('./helpers/log.js')
const { emptyDir } = require('fs-extra')

;(async () => {
  await emptyDir(path.join(__dirname, '../movies/posters'))
  const files = await getMovieFiles()
  for(let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const rawJson = await fs.readFile(files[fileIndex], 'utf8')
    const json = JSON.parse(rawJson)
    for(let movieIndex = 0; movieIndex < json.length; movieIndex += 1) {
      log(`Updating movie ${movieIndex} over ${json.length} (${files[fileIndex]}`)
      const oldData = json[movieIndex]
      const tmdbData = await fetchMovieData(oldData.tmdb_id)
      json[movieIndex] = await fetchFormattedMovieData(oldData.rating, oldData.watch_date, tmdbData)
    }
    await fs.writeFile(files[fileIndex], JSON.stringify(json, null, 2))
  }
})()

function getMovieFiles() {
  return new Promise((resolve, reject) => {
    glob(path.join(__dirname, '../movies/*.json'), (error, files) => {
      error ? reject(error) : resolve(files)
    })
  })
}
