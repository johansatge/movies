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
    scripts: null,
    styles: null,
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
    ],
    orientation: 'any',
    theme_color: '#ffcf20',
  },
  manifestFile: null,
  logoFilename: null,
}

function buildApp() {
  return cleanDist()
    .then(readMovies)
    .then(buildAssets)
    .then(copyLogo)
    .then(writeManifest)
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
  log('Building assets')
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
      state.assets.styles = info.assetsByChunkName.styles[1] // @todo fix this ugly thing
      resolve()
    })
  })
}

function copyLogo() {
  log('Writing logo')
  return new Promise((resolve, reject) => {
    const src = path.join('frontend', 'logo.png')
    checksum.file(src, (error, hash) => {
      if (error) {
        return reject(error)
      }
      state.logoFilename = `logo.${hash}.png`
      const dest = path.join(state.distDir, state.logoFilename)
      fs
        .copy(src, dest)
        .then(resolve)
        .catch(reject)
    })
  })
}

function writeManifest() {
  log('Writing manifest')
  state.manifest.icons[0].src = `/${state.logoFilename}`
  const json = JSON.stringify(state.manifest)
  state.manifestFile = `manifest.${checksum(json)}.json`
  return fs.outputFile(path.join(state.distDir, state.manifestFile), json, 'utf8')
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
        actors: state.stats.actors,
        directors: state.stats.directors,
        assets: state.assets,
        manifest: state.manifestFile,
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