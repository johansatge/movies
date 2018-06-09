/* global window, document */

import {init as initOffline} from './offline.js'

const nodeBody = document.body
const nodeMovies = document.querySelectorAll('[data-js-movie]')
const nodeMoviesCount = document.querySelector('[data-js-movies-count]')
const nodeSearchInput = document.querySelector('[data-js-search]')
const nodeSearchToggle = document.querySelector('[data-js-search-toggle]')
const nodeNoResults = document.querySelector('[data-js-no-results]')

export {init}

function init({offlineAssets}) {
  initMoviesGrid()
  initSearchFilter()
  filterMovies()
  initLazyLoadImages()
  initOffline(offlineAssets)
}

function initMoviesGrid() {
  window.addEventListener('resize', setMoviesGrid)
  setMoviesGrid()
}

function setMoviesGrid() {
  const targetWidth = 160
  const windowWidth = window.innerWidth - 1
  for (let index = 0; index < nodeMovies.length; index += 1) {
    const count = windowWidth / targetWidth
    const width = windowWidth / parseInt(count)
    const height = width * 1.5
    nodeMovies[index].style.width = `${width}px`
    nodeMovies[index].style.height = `${height}px`
  }
}

function initLazyLoadImages() {
  window.addEventListener('scroll', lazyLoadImages)
  window.addEventListener('resize', lazyLoadImages)
  lazyLoadImages()
}

function initSearchFilter() {
  const initialValue = decodeURIComponent(document.location.hash.replace(/^#/, ''))
  if (initialValue.length > 0) {
    nodeSearchInput.value = initialValue
    filterMovies()
  }
  nodeSearchInput.addEventListener('input', filterMovies)
  nodeSearchToggle.addEventListener('click', toggleSearch)
}

function toggleSearch() {
  if (nodeBody.dataset.jsSearchHidden) {
    delete nodeBody.dataset.jsSearchHidden
  } else {
    nodeBody.dataset.jsSearchHidden = true
  }
}

function filterMovies() {
  let visibleMovies = 0
  const filters = extractSearchFilters()
  for (let index = 0; index < nodeMovies.length; index += 1) {
    if (movieMatchesFilters(nodeMovies[index], filters)) {
      if (nodeMovies[index].style.display !== 'block') {
        nodeMovies[index].style.display = 'block'
      }
      visibleMovies += 1
    } else {
      if (nodeMovies[index].style.display !== 'none') {
        nodeMovies[index].style.display = 'none'
      }
    }
  }
  nodeMoviesCount.innerHTML = visibleMovies
  nodeNoResults.style.display = visibleMovies > 0 ? 'none' : 'block'
  lazyLoadImages()
}

function movieMatchesFilters(nodeMovie, filters) {
  const movieRating = nodeMovie.dataset.jsMovieRating
  const movieTitle = nodeMovie.dataset.jsMovieTitle
  const movieDirector = nodeMovie.dataset.jsMovieDirector
  const movieCast = nodeMovie.dataset.jsMovieCast
  const movieRelease = nodeMovie.dataset.jsMovieRelease
  for (let index = 0; index < filters.length; index += 1) {
    const filter = filters[index]
    if (filter.type === 'rating' && movieRating !== filter.value) {
      return false
    }
    if (filter.type === 'title' && movieTitle.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'director' && movieDirector.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'actor' && movieCast.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'release' && movieRelease.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
  }
  return true
}

function extractSearchFilters() {
  const allowedTypes = ['rating', 'actor', 'director', 'title', 'release']
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

function lazyLoadImages() {
  const images = document.querySelectorAll('[data-js-lazy-load]')
  const windowHeight = window.innerHeight
  for (let index = 0; index < images.length; index += 1) {
    const image = images[index]
    const boundings = image.getBoundingClientRect()
    let needsLazyLoad = false
    if (boundings.top > 0 && boundings.top < windowHeight) {
      needsLazyLoad = true
    }
    if (boundings.top + boundings.height > 0 && boundings.top + boundings.height < windowHeight) {
      needsLazyLoad = true
    }
    if (needsLazyLoad) {
      const src = image.dataset.jsLazyLoadUrl
      image.style.backgroundImage = `url(${src})`
      delete image.dataset.jsLazyLoad
    }
  }
}
