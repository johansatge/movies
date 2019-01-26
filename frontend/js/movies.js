/* global window, document */

import axios from 'axios'
import {init as initOffline} from './offline.js'

const nodeBody = document.body
const nodeMoviesCount = document.querySelector('[data-js-movies-count]')
const nodeSearchInput = document.querySelector('[data-js-search]')
const nodeSearchToggle = document.querySelector('[data-js-search-toggle]')
const nodeNoResults = document.querySelector('[data-js-no-results]')

const movies = []
let filteredMoviesOnce = false

export {init}

function init({moviesFiles, offlineAssets}) {
  bindMoviesGrid()
  bindLazyLoadImages()
  bindSearchFilter()
  initOffline(offlineAssets)
  initMovies(moviesFiles)
}

function initMovies(moviesFiles) {
  if (moviesFiles.length === 0) {
    return true
  }
  return axios({
    url: moviesFiles[0],
    method: 'get',
    json: true,
  }).then((response) => {
    if (response.data) {
      // @todo use a less ugly way to populate the movies
      // -> migrate to Preact / insert HTML nodes / etc
      let html = ''
      response.data.forEach((movie) => {
        movies.push(movie)
        html += `<a class="movie" target="_blank" rel="noopener" href="${movie.url}" data-js-movie>
          <div class="movie-bg" data-js-lazy-load data-js-lazy-load-url="${movie.poster}"></div>
          <div class="movie-rating">★ ${movie.rating}</div>
          <div class="movie-title">${movie.title}</div>
        </a>`
      })
      document.querySelector('[data-js-movies]').innerHTML += html
      setMoviesGrid()
      filterMovies()
      moviesFiles.shift()
      return initMovies(moviesFiles)
    }
    throw new Error('Empty movies file')
  })
}

function bindMoviesGrid() {
  window.addEventListener('resize', setMoviesGrid)
}

function setMoviesGrid() {
  const targetWidth = 160
  const windowWidth = window.innerWidth - 1
  const nodeMovies = document.querySelectorAll('[data-js-movie]')
  for (let index = 0; index < nodeMovies.length; index += 1) {
    const count = windowWidth / targetWidth
    const width = windowWidth / parseInt(count)
    const height = width * 1.5
    nodeMovies[index].style.width = `${width}px`
    nodeMovies[index].style.height = `${height}px`
  }
}

function bindLazyLoadImages() {
  window.addEventListener('scroll', lazyLoadImages)
  window.addEventListener('resize', lazyLoadImages)
}

function bindSearchFilter() {
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
  if (!filteredMoviesOnce) {
    const initialValue = decodeURIComponent(document.location.hash.replace(/^#/, ''))
    if (initialValue.length > 0) {
      nodeSearchInput.value = initialValue
    }
    filteredMoviesOnce = true
  }
  let visibleMovies = 0
  const filters = extractSearchFilters()
  const nodeMovies = document.querySelectorAll('[data-js-movie]')
  for (let index = 0; index < nodeMovies.length; index += 1) {
    if (movieMatchesFilters(index, filters)) {
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

function movieMatchesFilters(movieIndex, filters) {
  for (let index = 0; index < filters.length; index += 1) {
    const filter = filters[index]
    if (filter.type === 'rating' && movies[movieIndex].rating !== filter.value) {
      return false
    }
    if (filter.type === 'title' && movies[movieIndex].fullTitle.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'director' && movies[movieIndex].director.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'actor' && movies[movieIndex].cast.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'released' && movies[movieIndex].released.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'watched' && movies[movieIndex].watched.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
    if (filter.type === 'genre' && movies[movieIndex].genres.search(new RegExp(filter.value, 'i')) === -1) {
      return false
    }
  }
  return true
}

function extractSearchFilters() {
  const allowedTypes = ['rating', 'actor', 'director', 'title', 'released', 'watched', 'genre']
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
