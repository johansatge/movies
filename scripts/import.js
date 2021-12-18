const fsp = require('fs').promises
const path = require('path')
const { fetchMovieSearch, fetchMovieData } = require('./helpers/tmdb.js')
const { fetchFormattedMovieData } = require('./helpers/movie.js')
const { log } = require('./helpers/log.js')

let movieSearchTerm = null
let matchingMovies = null
let movieSelection = null
let watchDate = null
let rating = null
let movieData = null

importMovie()

async function importMovie() {
  try {
    await askMovieSearchTerm()
    await getAndShowMatchingMovies()
    await askMovieSelection()
    await askMovieRating()
    await askMovieWatchDate()
    await getSelectedMovieDetails()
    await writeMovie()
    log('Movie saved')
    process.exit(0)
  } catch(error) {
    log(error.message)
    process.exit(1)
  }
}

async function askMovieSearchTerm() {
  movieSearchTerm = await readInput('Movie to import: ')
}

async function getAndShowMatchingMovies() {
  const results = await fetchMovieSearch(movieSearchTerm)
  if (results.length === 0) {
    throw new Error('No matching movies found')
  }
  matchingMovies = results
  results.forEach((result, index) => {
    const title = result.title
    const originalTitle = result.original_title !== result.title ? ` (${result.original_title})` : ''
    const year = result.release_date ? result.release_date.substring(0, 4) : 'unknown year'
    const url = `https://www.themoviedb.org/movie/${result.id}`
    process.stdout.write(`${index}. ${title} (${year} - ${result.vote_average})${originalTitle} - ${url}\n`)
  })
}

async function askMovieSelection() {
  movieSelection = await readInput('Select a movie: ')
}

async function askMovieRating() {
  rating = await readInput('Rating (0-10): ')
}

async function askMovieWatchDate() {
  const input = await readInput('Watch date (YYYY-MM-DD or empty if unknown): ')
  watchDate = input.length > 0 ? input : null
}

async function getSelectedMovieDetails() {
  const movieId = matchingMovies[movieSelection].id
  const tmdbData = await fetchMovieData(movieId)
  movieData = await fetchFormattedMovieData(rating, watchDate, tmdbData)
}

async function writeMovie() {
  const fileName = movieData.watch_date ? `${movieData.watch_date.substring(0, 4)}.json` : '0unsorted.json'
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
