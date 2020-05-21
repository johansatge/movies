const request = require('request')

require('dotenv').config()

const m = {}
module.exports = m

let cachedConfiguration = null

m.fetchMovieSearch = function(rawTerm) {
  const term = encodeURIComponent(rawTerm)
  const query = `/search/movie?language=en-US&page=1&include_adult=false&query=${term}`
  return fetchApi(query).then((results) => results.results)
}

m.fetchMovieData = function(movieId) {
  return Promise.all([getConfiguration(), fetchApi(`/movie/${movieId}`), fetchApi(`/movie/${movieId}/credits`)]).then(
    ([configuration, movieDetails, movieCredits]) => {
      const data = {}
      data.tmdb_id = movieId
      data.title = movieDetails.title
      data.original_title = movieDetails.original_title
      data.release_date = movieDetails.release_date
      data.cast = movieCredits.cast.map((member) => member.name)
      data.posters = {}
      configuration.images.poster_sizes.forEach((size) => {
        data.posters[size.replace(/^w/, '')] = `${configuration.images.secure_base_url}${size}${
          movieDetails.poster_path
        }`
      })
      movieCredits.crew.forEach((member) => {
        if (member.job === 'Director') {
          data.director = member.name
        }
      })
      data.genres = movieDetails.genres.map((genre) => genre.name).sort()
      return data
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
