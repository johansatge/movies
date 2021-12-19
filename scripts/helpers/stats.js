const m = {}
module.exports = m

/**
 * Extract meaningful stats from a list of movies,
 * and return them to be used in the build script
 */
m.extractStats = function (movies) {
  const ratings = {}
  const months = {}
  const releaseYears = {}
  const actors = {}
  const directors = {}
  const genres = {}
  movies.forEach((movie) => {
    ratings[movie.rating] = !ratings[movie.rating] ? 1 : (ratings[movie.rating] += 1)
    const month = movie.watch_date ? movie.watch_date.substring(0, 7) : null
    if (month) {
      months[month] = !months[month] ? 1 : (months[month] += 1)
    }
    const releaseYear = movie.release_date.substring(0, 4)
    releaseYears[releaseYear] = !releaseYears[releaseYear] ? 1 : (releaseYears[releaseYear] += 1)
    movie.cast.forEach((actor) => {
      actors[actor] = !actors[actor] ? 1 : (actors[actor] += 1)
    })
    directors[movie.director] = !directors[movie.director] ? 1 : (directors[movie.director] += 1)
    movie.genres.forEach((genre) => {
      genres[genre] = !genres[genre] ? 1 : (genres[genre] += 1)
    })
  })
  const stats = {
    ratings: objectStatToArray(ratings, 'label', 'asc'),
    months: objectStatToArray(months).reverse(),
    releaseYears: objectStatToArray(releaseYears, 'label', 'asc'),
    actors: objectStatToArray(actors, 'count', 'desc'),
    directors: objectStatToArray(directors, 'count', 'desc'),
    genres: objectStatToArray(genres, 'count', 'desc'),
  }
  stats.moviesCount = movies.length
  stats.actorsCount = stats.actors.length
  stats.directorsCount = stats.directors.length
  return stats
}

function objectStatToArray(stats, sortBy = null, sortOrder = null) {
  const list = []
  Object.keys(stats).forEach((stat) =>
    list.push({
      label: stat,
      count: stats[stat],
    })
  )
  if (sortBy) {
    const sortHelpers = {
      asc: (a, b) => (a[sortBy] > b[sortBy] ? 1 : a[sortBy] < b[sortBy] ? -1 : 0),
      desc: (a, b) => (a[sortBy] < b[sortBy] ? 1 : a[sortBy] > b[sortBy] ? -1 : 0),
    }
    list.sort(sortHelpers[sortOrder])
  }
  return list
}
