const request = require('request')

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

function getConfiguration() {
  if (cachedConfiguration === null) {
    return fetchApi('/configuration').then((config) => {
      cachedConfiguration = config
      return config
    })
  }
  return cachedConfiguration
}

function fetchApi(endpoint) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.TMDB_API_KEY
    const url = `https://api.themoviedb.org/3${endpoint}${endpoint.search(/\?/) > -1 ? '&' : '?'}&api_key=${apiKey}`
    request(
      {
        method: 'get',
        url,
      },
      (error, response, body) => {
        const code = response.statusCode
        error ? reject(error) : code === 200 ? resolve(JSON.parse(body)) : reject(new Error(`${code} error`))
      }
    )
  })
}
