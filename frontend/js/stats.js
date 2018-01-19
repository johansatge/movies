/* global document */

import Chart from 'chart.js'

export {init}

const state = {
  actors: null,
  directors: null,
}

const nodeActorsList = document.querySelector('[data-js-stats-actors-list]')
const nodeDirectorsList = document.querySelector('[data-js-stats-directors-list]')
const nodeMoreActorsButton = document.querySelector('[data-js-stats-more-actors]')
const nodeMoreDirectorsButton = document.querySelector('[data-js-stats-more-directors]')

function init(stats, actors, directors) {
  state.actors = actors
  state.directors = directors
  nodeMoreActorsButton.addEventListener('click', addActors)
  nodeMoreDirectorsButton.addEventListener('click', addDirectors)
  addActors()
  addDirectors()
  initChart(
    document.querySelector('[data-js-stats-movies-by-rating]').getContext('2d'),
    'bar',
    stats.moviesByRating.map((rating) => `Rated ${rating.label}`),
    stats.moviesByRating.map((rating) => rating.count),
    onRatingClick
  )
  initChart(
    document.querySelector('[data-js-stats-movies-by-release-years]').getContext('2d'),
    'bar',
    stats.moviesByReleaseYears.map((year) => year.label),
    stats.moviesByReleaseYears.map((year) => year.count),
    onReleaseYearClick
  )
  initChart(
    document.querySelector('[data-js-stats-movies-by-month]').getContext('2d'),
    'line',
    stats.moviesByMonth.map((month) => month.label),
    stats.moviesByMonth.map((month) => month.count)
  )
}

function addActors() {
  const actors = state.actors.splice(0, 20)
  const html = actors.map((actor, index) => {
    return `
    <tr class="${index % 2 === 0 ? 'stat-table-row--alt' : ''}">
      <td><a href="../#actor:${actor.label}">${actor.label}</a></td>
      <td>${actor.count}</td>
    </tr>
    `
  })
  nodeActorsList.innerHTML += html.join('')
  if (state.actors.length > 0) {
    nodeMoreActorsButton.innerHTML = `${state.actors.length} more...`
  } else {
    nodeMoreActorsButton.style.display = 'none'
  }
}

function addDirectors() {
  const directors = state.directors.splice(0, 20)
  const html = directors.map((director, index) => {
    return `
    <tr class="${index % 2 === 0 ? 'stat-table-row--alt' : ''}">
      <td><a href="../#director:${director.label}">${director.label}</a></td>
      <td>${director.count}</td>
    </tr>
    `
  })
  nodeDirectorsList.innerHTML += html.join('')
  if (state.directors.length > 0) {
    nodeMoreDirectorsButton.innerHTML = `${state.directors.length} more...`
  } else {
    nodeMoreDirectorsButton.style.display = 'none'
  }
}

function onRatingClick(evt, items) {
  if (items.length === 1) {
    document.location.href = `../#rating:${items[0]._index + 1}`
  }
}

function onReleaseYearClick(evt, items) {
  if (items.length === 1) {
    document.location.href = `../#release:${items[0]._model.label}`
  }
}

function initChart(node, type, labels, data, onClick) {
  const options = {
    type: type,
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: 'rgba(255, 255, 255, 0.2)',
          borderColor: 'rgba(255, 255, 255, 1)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      legend: {
        display: false,
      },
      maintainAspectRatio: false,
      responsive: true,
      scales: {
        yAxes: [
          {
            ticks: {
              beginAtZero: true,
            },
          },
        ],
      },
    },
  }
  if (onClick) {
    options.options.onClick = onClick
  }
  new Chart(node, options)
}
