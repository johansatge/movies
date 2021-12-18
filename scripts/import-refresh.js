const fsp = require('fs').promises
const path = require('path')
const { fetchFormattedMovieData } = require('./helpers/tmdb.js')
const { log } = require('./helpers/log.js')

;(async () => {
  const postersPath = path.join(__dirname, '../movies/posters')
  const moviesPath = path.join(__dirname, '../movies')
  try {
    await fsp.rm(postersPath, { recursive: true })
  } catch (error) {
    // nothing
  }
  await fsp.mkdir(postersPath, { recursive: true })
  let files = await fsp.readdir(moviesPath)
  files = files.filter((file) => file.endsWith('.json'))
  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const rawJson = await fsp.readFile(path.join(moviesPath, files[fileIndex]), 'utf8')
    const json = JSON.parse(rawJson)
    for (let movieIndex = 0; movieIndex < json.length; movieIndex += 1) {
      log(`Updating movie ${movieIndex} over ${json.length} (${files[fileIndex]})`)
      const oldData = json[movieIndex]
      json[movieIndex] = await fetchFormattedMovieData(json[movieIndex].tmdb_id, oldData.rating, oldData.watch_date)
    }
    await fsp.writeFile(path.join(moviesPath, files[fileIndex]), JSON.stringify(json, null, 2))
  }
})()
