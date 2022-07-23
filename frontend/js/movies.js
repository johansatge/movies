/* global window, document */

import { init as initOffline } from './offline.js'

const nodeBody = document.body
const nodeTopBar = document.querySelector('[data-js-topbar]')
const nodeMovies = document.querySelector('[data-js-movies]')
const nodeMoviesCount = document.querySelector('[data-js-movies-count]')
const nodeSearchInput = document.querySelector('[data-js-search]')
const nodeSearchToggle = document.querySelector('[data-js-search-toggle]')
const nodeNoResults = document.querySelector('[data-js-no-results]')
const movieTemplate = document.querySelector('[data-js-movie-template]').innerHTML

const movies = []
let currentFilters = null
let currentMovieSize = null
let currentLinesOfMovies = {}

window.Scripts = window.Scripts || {}
window.Scripts.movies = {
  init,
}

function init({ moviesFiles, offlineAssets }) {
  initOffline(offlineAssets)
  initSearchInput()
  currentMovieSize = getCurrentMovieSize()
  window.addEventListener('resize', onResizeWindow)
  downloadMovies(moviesFiles)
}

function initSearchInput() {
  const valueFromUrl = decodeURIComponent(document.location.hash.replace(/^#/, ''))
  if (valueFromUrl.length > 0) {
    nodeSearchInput.value = valueFromUrl
  }
  nodeSearchInput.addEventListener('input', onSearchInputUpdate)
  nodeSearchToggle.addEventListener('click', onToggleSearchInput)
  currentFilters = extractFiltersFromSearchInput()
}

function onSearchInputUpdate() {
  currentFilters = extractFiltersFromSearchInput()
  setMoviesGrid()
}

function onToggleSearchInput() {
  if (nodeBody.dataset.jsSearchHidden) {
    delete nodeBody.dataset.jsSearchHidden
  } else {
    nodeBody.dataset.jsSearchHidden = true
  }
  setMoviesGrid()
}

function onResizeWindow() {
  currentMovieSize = getCurrentMovieSize()
  setMoviesGrid()
}

function onScrollWindow() {
  showMoviesInViewport()
}

function getCurrentMovieSize() {
  const targetWidth = 160
  const windowWidth = window.innerWidth - 1
  const perLine = parseInt(windowWidth / targetWidth)
  const thumbWidth = windowWidth / perLine
  const thumbHeight = thumbWidth * 1.5
  return { perLine, thumbWidth, thumbHeight }
}

function downloadMovies(moviesFiles) {
  if (moviesFiles.length === 0) {
    return true
  }
  return window
    .fetch(moviesFiles[0])
    .then((response) => response.json())
    .then((response) => {
      response.forEach((movie) => {
        movies.push(movie)
      })
      moviesFiles.shift()
      setMoviesGrid()
      return downloadMovies(moviesFiles)
    })
}

function setMoviesGrid() {
  const currentFilteredMovies = []
  currentLinesOfMovies = {}
  movies.forEach((movie) => {
    if (movieMatchesCurrentFilters(movie)) {
      currentFilteredMovies.push(movie)
    }
  })
  const linesCount = Math.ceil(currentFilteredMovies.length / currentMovieSize.perLine)
  window.removeEventListener('scroll', onScrollWindow)
  window.scrollTo(0, 0)
  nodeMovies.style.height = `${linesCount * currentMovieSize.thumbHeight + nodeTopBar.clientHeight}px`
  window.addEventListener('scroll', onScrollWindow)
  let x = 0
  let y = nodeTopBar.clientHeight
  currentFilteredMovies.forEach((movie) => {
    if (!movie.node) {
      movie.node = document.createElement('a')
      movie.node.classList.add('movie')
      movie.node.target = '_blank'
      movie.node.rel = 'noopener'
      movie.node.href = movie.url
      movie.node.innerHTML = movieTemplate
        .replace('__title__', movie.title)
        .replace('__poster__', movie.poster)
        .replace('__rating__', movie.rating)
    }
    movie.node.style.width = `${currentMovieSize.thumbWidth}px`
    movie.node.style.height = `${currentMovieSize.thumbHeight}px`
    movie.node.style.left = `${x}px`
    movie.node.style.top = `${y}px`
    if (!currentLinesOfMovies[String(y)]) {
      currentLinesOfMovies[String(y)] = []
    }
    currentLinesOfMovies[String(y)].push(movie)
    const isLineFull = currentLinesOfMovies[String(y)].length === currentMovieSize.perLine
    x = isLineFull ? 0 : x + currentMovieSize.thumbWidth
    y = isLineFull ? y + currentMovieSize.thumbHeight : y
  })
  nodeMoviesCount.innerHTML = currentFilteredMovies.length
  nodeNoResults.style.display = currentFilteredMovies.length > 0 ? 'none' : 'block'
  showMoviesInViewport()
}

function showMoviesInViewport() {
  const minY = (document.documentElement.scrollTop || document.body.scrollTop) + nodeTopBar.clientHeight
  const maxY = minY + window.innerHeight - nodeTopBar.clientHeight
  nodeMovies.innerHTML = '' // @todo remove only the irrelevant children
  Object.keys(currentLinesOfMovies).forEach((lineY) => {
    lineY = parseFloat(lineY)
    if (lineY + currentMovieSize.thumbHeight >= minY && lineY < maxY) {
      currentLinesOfMovies[lineY].forEach((movie) => {
        nodeMovies.appendChild(movie.node)
      })
    }
  })
}

function movieMatchesCurrentFilters(movie) {
  for (let index = 0; index < currentFilters.length; index += 1) {
    const filter = currentFilters[index]
    if (filter.type === 'rating' && movie.rating !== filter.value) {
      return false
    }
    if (filter.type === 'title' && movie.fullTitle.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'director' && movie.director.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'actor' && movie.cast.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'released' && movie.released.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'watched' && movie.watched.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'genre' && movie.genres.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'runtime' && movie.runtime.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'language' && movie.lang !== filter.value) {
      return false
    }
  }
  return true
}

function extractFiltersFromSearchInput() {
  const allowedTypes = ['rating', 'actor', 'director', 'title', 'released', 'watched', 'genre', 'runtime', 'language']
  const defaultType = 'title'
  const searchTerms = nodeSearchInput.value.split(';').map((term) => term.trim())
  const filters = []
  searchTerms.forEach((term) => {
    if (term.length === 0) {
      return
    }
    const termParts = term.toLowerCase().split(':')
    if (allowedTypes.includes(termParts[0]) && termParts[1] && termParts[1].length > 0) {
      filters.push({
        type: termParts[0],
        value: termParts[1],
      })
    } else {
      filters.push({
        type: defaultType,
        value: term,
      })
    }
  })
  return filters
}
