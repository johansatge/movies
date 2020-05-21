const fs = require('fs-extra')
const path = require('path')
const { fetchMovieSearch, fetchMovieData } = require('./helpers/tmdb.js')

let movieSearchTerm = null
let matchingMovies = null
let movieSelection = null
let movieData = {
  title: null,
  original_title: null,
  watch_date: null,
  rating: null,
  release_date: null,
  director: null,
  tmdb_id: null,
  posters: {},
  cast: null,
}

askMovieSearchTerm()
  .then(getAndShowMatchingMovies)
  .then(askMovieSelection)
  .then(askMovieRating)
  .then(askMovieWatchDate)
  .then(getSelectedMovieDetails)
  .then(writeMovie)
  .then(() => {
    console.log('Movie saved') // eslint-disable-line no-console
    process.exit(0)
  })
  .catch((error) => {
    console.error(error.message) // eslint-disable-line no-console
    process.exit(1)
  })

function askMovieSearchTerm() {
  return readInput('Movie to import: ').then((input) => {
    movieSearchTerm = input
  })
}

function getAndShowMatchingMovies() {
  return fetchMovieSearch(movieSearchTerm)
    .then((results) => {
      if (results.length === 0) {
        return Promise.reject(new Error('No matching movies found'))
      }
      matchingMovies = results
      results.forEach((result, index) => {
        const title = result.title
        const originalTitle = result.original_title !== result.title ? ` (${result.original_title})` : ''
        const year = result.release_date.substring(0, 4)
        const url = `https://www.themoviedb.org/movie/${result.id}`
        process.stdout.write(`${index}. ${title} (${year})${originalTitle} - ${url}\n`)
      })
    })
}

function askMovieSelection() {
  return readInput('Select a movie: ').then((input) => {
    movieSelection = parseInt(input)
  })
}

function askMovieRating() {
  return readInput('Rating (0-10): ').then((input) => {
    movieData.rating = parseInt(input)
  })
}

function askMovieWatchDate() {
  return readInput('Watch date (YYYY-MM-DD or empty if unknown): ').then((input) => {
    movieData.watch_date = input.length > 0 ? input : null
  })
}

function getSelectedMovieDetails() {
  const movieId = matchingMovies[movieSelection].id
  return fetchMovieData(movieId).then((data) => {
    Object.keys(data).forEach((key) => {
      movieData[key] = data[key]
    })
  })
}

function writeMovie() {
  return new Promise((resolve, reject) => {
    const fileName = movieData.watch_date ? `${movieData.watch_date.substring(0, 4)}.json` : '_unsorted.json'
    const filePath = path.join(__dirname, '..', 'movies', fileName)
    fs.readFile(filePath, 'utf8', (error, contents) => {
      if (error) {
        return reject(new Error(`Could not read ${filePath} (${error.message})`))
      }
      const json = JSON.parse(contents)
      json.push(movieData)
      json.sort((a, b) => {
        if (a.watch_date !== b.watch_date) {
          return a.watch_date > b.watch_date ? 1 : a.watch_date < b.watch_date ? -1 : 0
        }
        return a.title > b.title ? 1 : a.title < b.title ? -1 : 0
      })
      fs.writeFile(filePath, JSON.stringify(json, null, 2), 'utf8', (error) => {
        error ? reject(new Error(`Could not write ${filePath} (${error.message})`)) : resolve()
      })
    })
  })
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
