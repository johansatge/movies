module.exports = {
  extract,
}

function extract(movies) {
  const ratings = {}
  const months = {}
  const releaseYears = {}
  const actors = {}
  const directors = {}
  movies.forEach((movie) => {
    ratings[movie.rating] = typeof ratings[movie.rating] === 'undefined' ? 1 : (ratings[movie.rating] += 1)
    const month = movie.watch_date.substring(0, 7)
    if (month !== '2011-10') {
      // @todo move movies with unknown date somewhere else
      months[month] = typeof months[month] === 'undefined' ? 1 : (months[month] += 1)
    }
    const releaseYear = movie.release_date.substring(0, 4)
    releaseYears[releaseYear] = typeof releaseYears[releaseYear] === 'undefined' ? 1 : (releaseYears[releaseYear] += 1)
    movie.cast.forEach((actor) => {
      actors[actor] = typeof actors[actor] === 'undefined' ? 1 : (actors[actor] += 1)
    })
    directors[movie.director] = typeof directors[movie.director] === 'undefined' ? 1 : (directors[movie.director] += 1)
  })
  return {
    ratings: objectStatToArray(ratings, 'label', 'asc'),
    months: objectStatToArray(months).reverse(),
    releaseYears: objectStatToArray(releaseYears, 'label', 'asc'),
    actors: objectStatToArray(actors, 'count', 'desc'),
    directors: objectStatToArray(directors, 'count', 'desc'),
  }
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
