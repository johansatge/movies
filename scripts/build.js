const checksum = require('checksum')
const ejs = require('ejs')
const fs = require('fs-extra')
const minify = require('html-minifier').minify
const movies = require('../movies/movies.js')
const path = require('path')
const webpack = require('webpack')
const webpackConfig = require('../frontend/webpack.config.js')
const stats = require('./stats.js')

module.exports = {
  buildApp,
}

const state = {
  distDir: path.join(__dirname, '..', '.dist'),
  movies: null,
  moviesHtml: null,
  statsHtml: null,
  assets: {
    moviesScripts: null,
    statsScripts: null,
    moviesStyles: null,
    statsStyles: null,
  },
  htmlMinifyConfig: {
    caseSensitive: true,
    collapseWhitespace: true,
    conservativeCollapse: true,
    html5: true,
    minifyCSS: false,
    minifyJS: false,
    removeAttributeQuotes: false,
    removeComments: true,
    removeEmptyAttributes: true,
    removeScriptTypeAttributes: true,
    useShortDoctype: true,
  },
  manifest: {
    name: 'Movies',
    short_name: 'Movies',
    display: 'standalone',
    background_color: '#000000',
    description: 'A big movies list with stats',
    start_url: '/',
    icons: [
      {
        src: null,
        sizes: '256x256',
        type: 'image/png',
      },
      {
        src: null,
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    orientation: 'any',
    theme_color: '#ffcf20',
  },
  manifestFile: null,
  faviconFile: null,
  logos: {
    x256: null,
    x512: null,
  },
  actorsFiles: null,
  actorsCount: null,
  directorsFiles: null,
  directorsCount: null,
}

function buildApp() {
  return cleanDist()
    .then(readMovies)
    .then(buildAssets)
    .then(copyLogos)
    .then(copyFavicon)
    .then(writeManifest)
    .then(writeActors)
    .then(writeDirectors)
    .then(renderMoviesHtml)
    .then(renderStatsHtml)
    .then(writeMoviesHtml)
    .then(writeStatsHtml)
}

function log(message) {
  console.log(message) // eslint-disable-line no-console
}

function cleanDist() {
  log(`Cleaning ${state.distDir}`)
  return fs.emptyDir(state.distDir)
}

function readMovies() {
  log('Reading movies list')
  return movies.getByWatchDate().then((list) => {
    state.movies = list
    state.stats = stats.extract(list)
  })
}

function buildAssets() {
  log('Building CSS & JS assets')
  return new Promise((resolve, reject) => {
    webpackConfig.output.path = state.distDir
    webpack(webpackConfig, (error, stats) => {
      const info = stats.toJson()
      if (error) {
        return reject(error)
      }
      if (stats.hasErrors()) {
        return reject(new Error(info.errors[0]))
      }
      state.assets.moviesScripts = info.assetsByChunkName.movies
      state.assets.statsScripts = info.assetsByChunkName.stats
      const moviesStylesPath = path.join(state.distDir, info.assetsByChunkName.moviesStyles)
      const statsStylesPath = path.join(state.distDir, info.assetsByChunkName.statsStyles)
      state.assets.moviesStyles = require(moviesStylesPath)
      state.assets.statsStyles = require(statsStylesPath)
      Promise.all([fs.remove(moviesStylesPath), fs.remove(statsStylesPath)])
        .then(resolve)
        .catch(reject)
    })
  })
}

function copyLogos() {
  log('Writing logos')
  return Promise.all([copyLogo('x256'), copyLogo('x512')])
}

function copyLogo(size) {
  return new Promise((resolve, reject) => {
    const src = path.join('frontend', `logo-${size}.png`)
    checksum.file(src, (error, hash) => {
      if (error) {
        return reject(error)
      }
      state.logos[size] = `logo.${size}.${hash}.png`
      const dest = path.join(state.distDir, state.logos[size])
      fs
        .copy(src, dest)
        .then(resolve)
        .catch(reject)
    })
  })
}

function copyFavicon() {
  log('Writing favicon')
  return new Promise((resolve, reject) => {
    const src = path.join('frontend', 'favicon.png')
    checksum.file(src, (error, hash) => {
      if (error) {
        return reject(error)
      }
      state.faviconFile = `favicon.${hash}.png`
      const dest = path.join(state.distDir, state.faviconFile)
      fs
        .copy(src, dest)
        .then(resolve)
        .catch(reject)
    })
  })
}

function writeManifest() {
  log('Writing manifest')
  state.manifest.icons[0].src = `/${state.logos.x256}`
  state.manifest.icons[1].src = `/${state.logos.x512}`
  const json = JSON.stringify(state.manifest)
  state.manifestFile = `manifest.${checksum(json)}.json`
  return fs.outputFile(path.join(state.distDir, state.manifestFile), json, 'utf8')
}

function writeActors() {
  log('Writing actors')
  const writers = []
  state.actorsFiles = []
  state.actorsCount = state.stats.actors.length
  while (state.stats.actors.length > 0) {
    const actors = state.stats.actors.splice(0, 1000)
    const json = JSON.stringify(actors)
    const jsonFilename = `/actors/${checksum(json)}.json`
    state.actorsFiles.push(jsonFilename)
    writers.push(fs.outputFile(path.join(state.distDir, jsonFilename), json, 'utf8'))
  }
  return Promise.resolve()
}

function writeDirectors() {
  log('Writing directors')
  const writers = []
  state.directorsFiles = []
  state.directorsCount = state.stats.directors.length
  while (state.stats.directors.length > 0) {
    const directors = state.stats.directors.splice(0, 500)
    const json = JSON.stringify(directors)
    const jsonFilename = `/directors/${checksum(json)}.json`
    state.directorsFiles.push(jsonFilename)
    writers.push(fs.outputFile(path.join(state.distDir, jsonFilename), json, 'utf8'))
  }
  return Promise.resolve()
}

function renderMoviesHtml() {
  log('Rendering index.html')
  return new Promise((resolve) => {
    fs.readFile(path.join(__dirname, '..', 'frontend', 'movies.ejs'), 'utf8', (error, ejsTemplate) => {
      state.moviesHtml = ejs.render(ejsTemplate, {
        movies: state.movies,
        ratings: state.stats.ratings,
        assets: state.assets,
        manifest: state.manifestFile,
        favicon: state.faviconFile,
      })
      resolve()
    })
  })
}

function renderStatsHtml() {
  log('Rendering stats/index.html')
  return new Promise((resolve) => {
    fs.readFile(path.join(__dirname, '..', 'frontend', 'stats.ejs'), 'utf8', (error, ejsTemplate) => {
      state.statsHtml = ejs.render(ejsTemplate, {
        moviesCount: state.movies.length,
        ratings: state.stats.ratings,
        months: state.stats.months,
        releaseYears: state.stats.releaseYears,
        actorsFiles: state.actorsFiles,
        actorsCount: state.actorsCount,
        directorsFiles: state.directorsFiles,
        directorsCount: state.directorsCount,
        assets: state.assets,
        manifest: state.manifestFile,
        favicon: state.faviconFile,
      })
      resolve()
    })
  })
}

function writeMoviesHtml() {
  log('Writing index.html')
  const html = minify(state.moviesHtml, state.htmlMinifyConfig)
  return fs.outputFile(path.join(state.distDir, 'index.html'), html, 'utf8')
}

function writeStatsHtml() {
  log('Writing stats/index.html')
  const html = minify(state.statsHtml, state.htmlMinifyConfig)
  return fs.outputFile(path.join(state.distDir, 'stats', 'index.html'), html, 'utf8')
}
