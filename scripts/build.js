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

const buildState = {}
const outputDir = path.join(__dirname, '..', '.dist')
const startTime = new Date().getTime()

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
    .catch((error) => {
      log(error.message)
      process.exit(1)
    })
}

function log(message) {
  console.log(message) // eslint-disable-line no-console
}

function cleanDist() {
  log(`Cleaning ${outputDir}`)
  return fs.emptyDir(outputDir)
}

function buildAssets() {
  log('Building CSS & JS assets')
  frontendConfig.webpack.forEach((config) => {
    config.output.path = outputDir
  })
  return promisify(webpack)(frontendConfig.webpack).then((stats) => {
    const info = stats.toJson()
    if (stats.hasErrors()) {
      throw new Error(info.errors[0])
    }
    buildState.assets = {}
    buildState.assets.moviesScript = info.children[0].assetsByChunkName.movies
    buildState.assets.statsScript = info.children[0].assetsByChunkName.stats
    buildState.assets.polyfillsScript = info.children[0].assetsByChunkName.polyfills
    buildState.serviceWorkerScript = info.children[0].assetsByChunkName.serviceworker
    const moviesStylesPath = path.join(outputDir, info.children[1].assetsByChunkName.moviesStyles)
    const statsStylesPath = path.join(outputDir, info.children[1].assetsByChunkName.statsStyles)
    buildState.moviesStyles = require(moviesStylesPath).toString()
    buildState.statsStyles = require(statsStylesPath).toString()
    return Promise.all([fs.remove(moviesStylesPath), fs.remove(statsStylesPath)])
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
    buildState.assets.favicon = filename
  })
}

function writeFonts() {
  log('Writing fonts')
  return promisify(glob)(path.join('frontend', 'fonts', '*.{woff,woff2}')).then((files) => {
    buildState.fonts = {}
    return Promise.all(
      files.map((file) =>
        writeFileWithHash(file).then((filename) => {
          buildState.fonts[path.parse(file).base] = filename
        })
      )
    )
  })
}

function writeFileWithHash(filePath) {
  return promisify(checksum.file)(filePath).then((hash) => {
    const pathParts = path.parse(filePath)
    const filename = `${pathParts.name}.${hash}${pathParts.ext}`
    return fs.copy(filePath, path.join(outputDir, filename)).then(() => {
      return filename
    })
  })
}

function writeManifest() {
  log('Writing manifest')
  const json = JSON.stringify(frontendConfig.manifest)
  buildState.assets.manifest = `manifest.${checksum(json)}.json`
  return fs.outputFile(path.join(outputDir, buildState.assets.manifest), json, 'utf8')
}

function readMovies() {
  log('Reading movies list')
  return movies.getByWatchDate().then((list) => {
    buildState.movies = list
    buildState.stats = stats.extract(list)
  })
}

function writeActors() {
  log('Writing actors')
  const writers = []
  buildState.actorsFiles = []
  while (buildState.stats.actors.length > 0) {
    const actors = buildState.stats.actors.splice(0, 1000)
    const json = JSON.stringify(actors)
    const jsonFilename = `/actors/${checksum(json)}.json`
    buildState.actorsFiles.push(jsonFilename)
    writers.push(fs.outputFile(path.join(outputDir, jsonFilename), json, 'utf8'))
  }
  return Promise.all(writers)
}

function writeDirectors() {
  log('Writing directors')
  const writers = []
  buildState.directorsFiles = []
  while (buildState.stats.directors.length > 0) {
    const directors = buildState.stats.directors.splice(0, 500)
    const json = JSON.stringify(directors)
    const jsonFilename = `/directors/${checksum(json)}.json`
    buildState.directorsFiles.push(jsonFilename)
    writers.push(fs.outputFile(path.join(outputDir, jsonFilename), json, 'utf8'))
  }
  return Promise.all(writers)
}

function renderMoviesHtml() {
  log('Rendering index.html')
  return fs.readFile(path.join(__dirname, '..', 'frontend', 'movies.ejs'), 'utf8').then((ejsTemplate) => {
    buildState.offlineAssets = getOfflineAssetsList()
    const html = ejs.render(ejsTemplate, buildState)
    const minifiedHtml = minify(replaceFonts(html), frontendConfig.htmlMinify)
    return fs.outputFile(path.join(outputDir, 'index.html'), minifiedHtml, 'utf8')
  })
}

function renderStatsHtml() {
  log('Rendering stats/index.html')
  return fs.readFile(path.join(__dirname, '..', 'frontend', 'stats.ejs'), 'utf8').then((ejsTemplate) => {
    const html = ejs.render(ejsTemplate, buildState)
    const minifiedHtml = minify(replaceFonts(html), frontendConfig.htmlMinify)
    return fs.outputFile(path.join(outputDir, 'stats', 'index.html'), minifiedHtml, 'utf8')
  })
}

function replaceFonts(html) {
  Object.keys(buildState.fonts).forEach((id) => {
    html = html.replace(`/__${id}__`, `/${buildState.fonts[id]}`)
  })
  return html
}

function getOfflineAssetsList() {
  const baseAssets = ['/', '/index.html', '/stats/', '/stats', '/stats/index.html']
  const frontAssets = Object.keys(buildState.assets).map((name) => buildState.assets[name])
  const fontAssets = Object.keys(buildState.fonts).map((name) => buildState.fonts[name])
  return [...baseAssets, ...frontAssets, ...fontAssets, ...buildState.actorsFiles, ...buildState.directorsFiles]
}

function outputBuildDuration() {
  log(`Built in ${(new Date().getTime() - startTime) / 1000}s`)
}
