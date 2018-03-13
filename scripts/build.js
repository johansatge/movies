const checksum = require('checksum')
const ejs = require('ejs')
const frontendConfig = require('../frontend/config.js')
const fs = require('fs-extra')
const glob = require('glob')
const minify = require('html-minifier').minify
const movies = require('../movies/movies.js')
const path = require('path')
const promisify = require('util').promisify
const webpack = require('webpack')
const stats = require('./stats.js')

module.exports = {
  buildApp,
}

const startTime = new Date().getTime()

const state = {
  outputDir: path.join(__dirname, '..', '.dist'),
  compiledAssets: {
    moviesScript: null,
    statsScript: null,
    polyfillsScript: null,
    serviceWorkerScript: null,
    moviesStyles: null,
    statsStyles: null,
    manifest: null,
    favicon: null,
    fonts: {},
  },
  movies: null,
  actorsFiles: null,
  directorsFiles: null,
  stats: null,
}

function buildApp() {
  return cleanDist()
    .then(buildAssets)
    .then(writeLogos)
    .then(writeFavicon)
    .then(writeFonts)
    .then(writeManifest)
    .then(readMovies)
    .then(writeActors)
    .then(writeDirectors)
    .then(renderMoviesHtml)
    .then(renderStatsHtml)
    .then(outputBuildDuration)
}

function log(message) {
  console.log(message) // eslint-disable-line no-console
}

function cleanDist() {
  log(`Cleaning ${state.outputDir}`)
  return fs.emptyDir(state.outputDir)
}

function buildAssets() {
  log('Building CSS & JS assets')
  frontendConfig.webpack.forEach((config) => {
    config.output.path = state.outputDir
  })
  return promisify(webpack)(frontendConfig.webpack)
    .then((stats) => {
      const info = stats.toJson()
      if (stats.hasErrors()) {
        throw new Error(info.errors[0])
      }
      state.compiledAssets.moviesScript = info.children[0].assetsByChunkName.movies
      state.compiledAssets.statsScript = info.children[0].assetsByChunkName.stats
      state.compiledAssets.polyfillsScript = info.children[0].assetsByChunkName.polyfills
      state.compiledAssets.serviceWorkerScript = info.children[0].assetsByChunkName.serviceworker
      const moviesStylesPath = path.join(state.outputDir, info.children[1].assetsByChunkName.moviesStyles)
      const statsStylesPath = path.join(state.outputDir, info.children[1].assetsByChunkName.statsStyles)
      state.compiledAssets.moviesStyles = require(moviesStylesPath).toString()
      state.compiledAssets.statsStyles = require(statsStylesPath).toString()
      return Promise.all([fs.remove(moviesStylesPath), fs.remove(statsStylesPath)])
    })
    .catch((error) => {
      log(error.message)
      process.exit(1)
    })
}

function writeLogos() {
  log('Writing logos')
  return Promise.all([writeLogo('256'), writeLogo('512')])
}

function writeLogo(size) {
  return writeFileWithHash(path.join('frontend', `logo-${size}.png`)).then((filename) => {
    frontendConfig.manifest.icons.push({
      src: `/${filename}`,
      sizes: `${size}x${size}`,
      type: 'image/png',
    })
  })
}

function writeFavicon() {
  log('Writing favicon')
  return writeFileWithHash(path.join('frontend', 'favicon.png')).then((filename) => {
    state.compiledAssets.favicon = filename
  })
}

function writeFonts() {
  log('Writing fonts')
  return promisify(glob)(path.join('frontend', 'fonts', '*.{woff,woff2}')).then((files) => {
    return Promise.all(
      files.map((file) =>
        writeFileWithHash(file).then((filename) => {
          state.compiledAssets.fonts[path.parse(file).base] = filename
        })
      )
    )
  })
}

function writeManifest() {
  log('Writing manifest')
  return writeFileWithHash(path.join('frontend', 'manifest.json')).then((filename) => {
    state.compiledAssets.manifest = filename
  })
}

function writeFileWithHash(filePath) {
  return promisify(checksum.file)(filePath).then((hash) => {
    const pathParts = path.parse(filePath)
    const filename = `${pathParts.name}.${hash}${pathParts.ext}`
    return fs.copy(filePath, path.join(state.outputDir, filename)).then(() => {
      return filename
    })
  })
}

function readMovies() {
  log('Reading movies list')
  return movies.getByWatchDate().then((list) => {
    state.movies = list
    state.stats = stats.extract(list)
  })
}

function writeActors() {
  log('Writing actors')
  const writers = []
  state.actorsFiles = []
  while (state.stats.actors.length > 0) {
    const actors = state.stats.actors.splice(0, 1000)
    const json = JSON.stringify(actors)
    const jsonFilename = `/actors/${checksum(json)}.json`
    state.actorsFiles.push(jsonFilename)
    writers.push(fs.outputFile(path.join(state.outputDir, jsonFilename), json, 'utf8'))
  }
  return Promise.all(writers)
}

function writeDirectors() {
  log('Writing directors')
  const writers = []
  state.directorsFiles = []
  while (state.stats.directors.length > 0) {
    const directors = state.stats.directors.splice(0, 500)
    const json = JSON.stringify(directors)
    const jsonFilename = `/directors/${checksum(json)}.json`
    state.directorsFiles.push(jsonFilename)
    writers.push(fs.outputFile(path.join(state.outputDir, jsonFilename), json, 'utf8'))
  }
  return Promise.all(writers)
}

function renderMoviesHtml() {
  log('Rendering index.html')
  return fs.readFile(path.join(__dirname, '..', 'frontend', 'movies.ejs'), 'utf8').then((ejsTemplate) => {
    const html = ejs.render(ejsTemplate, {
      movies: state.movies,
      ratings: state.stats.ratings,
      assets: state.compiledAssets,
    })
    const minifiedHtml = minify(replaceFonts(html), frontendConfig.htmlMinify)
    return fs.outputFile(path.join(state.outputDir, 'index.html'), minifiedHtml, 'utf8')
  })
}

function renderStatsHtml() {
  log('Rendering stats/index.html')
  return fs.readFile(path.join(__dirname, '..', 'frontend', 'stats.ejs'), 'utf8').then((ejsTemplate) => {
    const html = ejs.render(ejsTemplate, {
      moviesCount: state.movies.length,
      ratings: state.stats.ratings,
      months: state.stats.months,
      releaseYears: state.stats.releaseYears,
      actorsFiles: state.actorsFiles,
      actorsCount: state.stats.actorsCount,
      directorsFiles: state.directorsFiles,
      directorsCount: state.stats.directorsCount,
      assets: state.compiledAssets,
    })
    const minifiedHtml = minify(replaceFonts(html), frontendConfig.htmlMinify)
    return fs.outputFile(path.join(state.outputDir, 'stats', 'index.html'), minifiedHtml, 'utf8')
  })
}

function replaceFonts(html) {
  Object.keys(state.compiledAssets.fonts).forEach((id) => {
    html = html.replace(`/__${id}__`, `/${state.compiledAssets.fonts[id]}`)
  })
  return html
}

function outputBuildDuration() {
  log(`Built in ${(new Date().getTime() - startTime) / 1000}s`)
}
