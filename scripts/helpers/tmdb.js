const fetch = require('node-fetch')
const path = require('path')
const fsp = require('fs').promises

require('dotenv').config()

const m = {}
module.exports = m

let cachedConfiguration = null

m.fetchMovieSearch = async function (rawTerm) {
  const term = encodeURIComponent(rawTerm)
  const query = `/search/movie?language=en-US&page=1&include_adult=false&query=${term}`
  const results = await fetchApi(query)
  return results.results
}

m.fetchFormattedMovieData = async function (movieId, rating, watchDate) {
  const config = await getConfiguration()
  const details = await fetchApi(`/movie/${movieId}`)
  const credits = await fetchApi(`/movie/${movieId}/credits`)
  const movie = {
    title: details.title,
    original_title: details.original_title,
    watch_date: watchDate.length > 0 ? watchDate : null,
    rating,
    release_date: details.release_date,
    director: credits.crew.find((member) => member.job === 'Director').name,
    tmdb_id: details.id,
    poster: `posters/${details.id}.jpg`,
    cast: credits.cast.map((member) => member.name),
    genres: details.genres.map((genre) => genre.name).sort(),
  }
  const posterSize = 'w342'
  const posterUrl = `${config.images.secure_base_url}${posterSize}${details.poster_path}`
  await fetchAndStorePoster(posterUrl, path.join(__dirname, '../../movies', movie.poster))
  return movie
}

async function fetchAndStorePoster(url, destPath) {
  const response = await fetch(url)
  const buffer = await response.buffer()
  await fsp.writeFile(destPath, buffer)
}

async function getConfiguration() {
  if (cachedConfiguration === null) {
    cachedConfiguration = await fetchApi('/configuration')
  }
  return cachedConfiguration
}

async function fetchApi(endpoint) {
  const apiKey = process.env.TMDB_API_KEY
  const url = `https://api.themoviedb.org/3${endpoint}${endpoint.search(/\?/) > -1 ? '&' : '?'}&api_key=${apiKey}`
  const response = await fetch(url)
  const json = await response.json()
  return json
}
