const fetch = require('node-fetch')

require('dotenv').config()

const m = {}
module.exports = m

let cachedConfiguration = null

m.fetchMovieSearch = function (rawTerm) {
  const term = encodeURIComponent(rawTerm)
  const query = `/search/movie?language=en-US&page=1&include_adult=false&query=${term}`
  return fetchApi(query).then((results) => results.results)
}

m.fetchMovieData = function (movieId) {
  return Promise.all([getConfiguration(), fetchApi(`/movie/${movieId}`), fetchApi(`/movie/${movieId}/credits`)]).then(
    ([config, details, credits]) => {
      return { config, details, credits }
    }
  )
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
