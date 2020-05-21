const fs = require('fs').promises
const glob = require('glob')
const path = require('path')
const request = require('request')

const m = {}
module.exports = m

m.fetchFormattedMovieData = function(rating, watchDate, tmdbData) {
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
    genres: tmdbData.details.genres.map((genre) => genre.name).sort()
  }
  const posterSize = 'w342'
  const posterUrl = `${tmdbData.config.images.secure_base_url}${posterSize}${tmdbData.details.poster_path}`
  const posterPath = path.join(__dirname, '../../movies', movie.poster)
  return fetchAndStorePoster(posterUrl, posterPath).then(() => movie)
}

m.getMoviesByWatchDate = function() {
  return new Promise((resolve, reject) => {
    glob(path.join(__dirname, '../../movies/*.json'), (error, files) => {
      const fileReaders = files.map((file) => fs.readFile(file), 'utf8')
      Promise.all(fileReaders)
        .then((moviesByYear) => {
          let movies = []
          moviesByYear.forEach((json) => (movies = movies.concat(JSON.parse(json))))
          resolve(movies.reverse())
        })
        .catch(reject)
    })
  })
}

function fetchAndStorePoster(url, destPath) {
  const options = {
    method: 'get',
    url,
    encoding: null,
  }
  return new Promise((resolve, reject) => {
    request(options, (error, response, buffer) => {
      if (error) {
        return reject(error)
      }
      return fs.writeFile(destPath, buffer).then(resolve).catch(reject)
    })
  })
}
