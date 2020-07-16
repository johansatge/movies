/* global document */

import Chart from 'chart.js'

export { init }

const state = {
  actors: {
    items: [],
    files: null,
    count: 0,
    nodeList: document.querySelector('[data-js-stats-actors-list]'),
    nodeButton: document.querySelector('[data-js-stats-more-actors]'),
  },
  directors: {
    items: [],
    files: null,
    count: 0,
    nodeList: document.querySelector('[data-js-stats-directors-list]'),
    nodeButton: document.querySelector('[data-js-stats-more-directors]'),
  },
}

function init(stats) {
  state.actors.files = stats.actorsFiles
  state.actors.count = stats.actorsCount
  state.directors.files = stats.directorsFiles
  state.directors.count = stats.directorsCount
  state.actors.nodeButton.addEventListener('click', addActorsDirectors.bind(null, 'actors'))
  state.directors.nodeButton.addEventListener('click', addActorsDirectors.bind(null, 'directors'))
  addActorsDirectors('actors')
  addActorsDirectors('directors')
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

function addActorsDirectors(type) {
  state[type].nodeButton.disabled = true
  getActorsDirectors(type).then(() => {
    const items = state[type].items.splice(0, 20)
    state[type].count -= items.length
    const html = items.map((item, index) => {
      return `
        <tr class="${index % 2 === 0 ? 'stat-table-row--alt' : ''}">
          <td><a href="../#${type.replace(/s$/, '')}:${item.label}">${item.label}</a></td>
          <td>${item.count}</td>
        </tr>
        `
    })
    state[type].nodeList.innerHTML += html.join('')
    if (state[type].items.length === 0 && state[type].files.length === 0) {
      state[type].nodeButton.style.display = 'none'
    } else {
      state[type].nodeButton.innerHTML = `${state[type].count} more...`
      state[type].nodeButton.disabled = false
    }
  })
}

function getActorsDirectors(type) {
    if (state[type].items.length > 0) {
      return Promise.resolve()
    }
    return window.fetch(state[type].files.splice(0, 1))
      .then((response) => response.json())
      .then((response) => {
        state[type].items = state[type].items.concat(response)
      })
}

function onRatingClick(evt, items) {
  if (items.length === 1) {
    document.location.href = `../#rating:${items[0]._index + 1}`
  }
}

function onReleaseYearClick(evt, items) {
  if (items.length === 1) {
    document.location.href = `../#released:${items[0]._model.label}`
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
          borderColor: 'rgba(255, 255, 255, 0.8)',
          borderWidth: 1,
        },
      ],
    },
    options: {
      animation: false,
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
              fontColor: '#ffffff',
              fontFamily: 'Open Sans',
              fontSize: 12,
            },
            gridLines: {
              color: 'rgba(0, 0, 0, 0.2)',
            },
          },
        ],
        xAxes: [
          {
            ticks: {
              beginAtZero: true,
              fontColor: '#ffffff',
              fontFamily: 'Open Sans',
              fontSize: 11,
            },
            gridLines: {
              color: 'rgba(0, 0, 0, 0.2)',
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
