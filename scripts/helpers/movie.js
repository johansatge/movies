const fsp = require('fs').promises
const path = require('path')
const fetch = require('node-fetch')

const m = {}
module.exports = m

m.fetchFormattedMovieData = async function (rating, watchDate, tmdbData) {
  const movie = {
    title: tmdbData.details.title,
    original_title: tmdbData.details.original_title,
    watch_date: watchDate,
    rating,
    release_date: tmdbData.details.release_date,
    director: tmdbData.credits.crew.find((member) => member.job === 'Director').name,
    tmdb_id: tmdbData.details.id,
    poster: `posters/${tmdbData.details.id}.jpg`,
    cast: tmdbData.credits.cast.map((member) => member.name),
    genres: tmdbData.details.genres.map((genre) => genre.name).sort(),
  }
  const posterSize = 'w342'
  const posterUrl = `${tmdbData.config.images.secure_base_url}${posterSize}${tmdbData.details.poster_path}`
  const posterPath = path.join(__dirname, '../../movies', movie.poster)
  await fetchAndStorePoster(posterUrl, posterPath)
  return movie
}

m.getMoviesByWatchDate = async function () {
  const moviesPath = path.join(__dirname, '../../movies')
  let files = await fsp.readdir(moviesPath)
  files = files.filter((file) => file.endsWith('.json')).sort().reverse()
  let movies = []
  for(let index = 0; index < files.length; index += 1) {
    const json = await fsp.readFile(path.join(moviesPath, files[index]), 'utf8')
    movies = movies.concat(JSON.parse(json).reverse())
  }
  return movies
}

async function fetchAndStorePoster(url, destPath) {
  const response = await fetch(url)
  const buffer = await response.buffer()
  await fsp.writeFile(destPath, buffer)
}
