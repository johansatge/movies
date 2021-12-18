const fsp = require('fs').promises
const path = require('path')
const { fetchMovieSearch, fetchFormattedMovieData } = require('./helpers/tmdb.js')
const { log } = require('./helpers/log.js')

let movieData = null

importMovie()

async function importMovie() {
  try {
    const searchTerm = await readInput('Movie to import: ')
    const matchingMovies = await getAndShowMatchingMovies(searchTerm)
    const selectedMovie = parseInt(await readInput('Select a movie: '))
    if (selectedMovie < 0 || selectedMovie > matchingMovies.length - 1) {
      throw new Error('Invalid selected movie')
    }
    const rating = parseInt(await readInput('Rating (0-10): '))
    if (rating < 0 || rating > 10) {
      throw new Error('Invalid rating')
    }
    const watchDate = await readInput('Watch date (YYYY-MM-DD or empty if unknown): ')
    if (watchDate.length > 0 && !watchDate.match(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)) {
      throw new Error('Invalid watch date')
    }
    const movieData = await fetchFormattedMovieData(matchingMovies[selectedMovie].id, rating, watchDate)
    await writeMovie(movieData)
    log('Movie saved')
    process.exit(0)
  } catch(error) {
    log(error.message)
    log(error.stack)
    process.exit(1)
  }
}

async function getAndShowMatchingMovies(searchTerm) {
  const results = await fetchMovieSearch(searchTerm)
  if (results.length === 0) {
    throw new Error('No matching movies found')
  }
  results.forEach((result, index) => {
    const title = result.title
    const originalTitle = result.original_title !== result.title ? ` (${result.original_title})` : ''
    const year = result.release_date ? result.release_date.substring(0, 4) : 'unknown year'
    const url = `https://www.themoviedb.org/movie/${result.id}`
    process.stdout.write(`${index}. ${title} (${year} - ${result.vote_average})${originalTitle} - ${url}\n`)
  })
  return results
}

async function writeMovie(movieData) {
  const fileName = movieData.watch_date ? `${movieData.watch_date.substring(0, 4)}.json` : '0_unsorted.json'
  const filePath = path.join(__dirname, '../movies', fileName)
  const contents = await fsp.readFile(filePath, 'utf8')
  const json = JSON.parse(contents)
  json.push(movieData)
  json.sort((a, b) => {
    if (a.watch_date !== b.watch_date) {
      return a.watch_date > b.watch_date ? 1 : a.watch_date < b.watch_date ? -1 : 0
    }
    return a.title > b.title ? 1 : a.title < b.title ? -1 : 0
  })
  await fsp.writeFile(filePath, JSON.stringify(json, null, 2), 'utf8')
}

function readInput(message) {
  return new Promise((resolve) => {
    process.stdout.write(message)
    const stdin = process.openStdin()
    stdin.addListener('data', (buffer) => {
      resolve(buffer.toString().trim())
    })
  })
}
