
const checksum = require('checksum')
const ejs = require('ejs')
const frontendConfig = require('../frontend/config.js')
const fs = require('fs-extra')
const glob = require('glob')
const minify = require('html-minifier').minify
const { getMoviesByWatchDate } = require('./helpers/movie.js')
const path = require('path')
const promisify = require('util').promisify
const webpack = require('webpack')
const { extractStats } = require('./helpers/stats.js')
const { log } = require('./helpers/log.js')

const buildState = {
  assets: {},
}
const outputDir = path.join(__dirname, '..', '.dist')
const startTime = new Date().getTime()

cleanDist()
  .then(writeLogos)
  .then(writeFavicon)
  .then(writeFonts)
  .then(writeManifest)
  .then(readMovies)
  .then(writeMoviesData)
  .then(writeActors)
  .then(writeDirectors)
  .then(buildFrontendAssets)
  .then(copyPosters)
  .then(renderMoviesHtml)
  .then(renderStatsHtml)
  .then(buildServiceWorker)
  .then(outputBuildDuration)
  .catch((error) => {
    log(error.message)
    process.exit(1)
  })

/**
 * Clean destination directory
 */
function cleanDist() {
  log(`Cleaning ${outputDir}`)
  return fs.emptyDir(outputDir)
}

/**
 * Write logo with hashes
 */
function writeLogos() {
  log('Writing logos')
  return writeLogo('256').then(() => writeLogo('512'))
}

/**
 * Write a logo in the destination dir and add it to the manifest
 */
function writeLogo(size) {
  return writeFileWithHash(path.join('frontend', `logo-${size}.png`)).then((filename) => {
    buildState.assets[`logo-${size}`] = `/${filename}`
    frontendConfig.manifest.icons.push({
      src: `/${filename}`,
      sizes: `${size}x${size}`,
      type: 'image/png',
    })
  })
}

/**
 * Write the favicon and keep its name for later use in the HTML templates
 */
function writeFavicon() {
  log('Writing favicon')
  return writeFileWithHash(path.join('frontend', 'favicon.png')).then((filename) => {
    buildState.assets.favicon = `/${filename}`
  })
}

/**
 * Write the fonts and keep their names for later use in the HTML templates
 */
function writeFonts() {
  log('Writing fonts')
  return promisify(glob)(path.join('frontend', 'fonts', '*.{woff,woff2}')).then((files) => {
    return Promise.all(
      files.map((file) =>
        writeFileWithHash(file).then((filename) => {
          buildState.assets[path.parse(file).base] = `/${filename}`
        })
      )
    )
  })
}

/**
 * Write a file in the destination dir and add its checksum in its name
 */
function writeFileWithHash(filePath) {
  return promisify(checksum.file)(filePath).then((hash) => {
    const pathParts = path.parse(filePath)
    const filename = `${pathParts.name}.${hash}${pathParts.ext}`
    return fs.copy(filePath, path.join(outputDir, filename)).then(() => {
      return filename
    })
  })
}

/**
 * Write the manifest and keep its name for later use in the HTML templates
 */
function writeManifest() {
  log('Writing manifest')
  const json = JSON.stringify(frontendConfig.manifest)
  const filename = `manifest.${checksum(json)}.json`
  buildState.assets.manifest = `/${filename}`
  return fs.outputFile(path.join(outputDir, filename), json, 'utf8')
}

/**
 * Read & parse movies stats from the JSON files
 */
function readMovies() {
  log('Reading movies list')
  return getMoviesByWatchDate().then((list) => {
    buildState.movies = list
    buildState.stats = extractStats(list)
  })
}

/**
 * Write movies data for frontend JSON calls
 */
function writeMoviesData() {
  log('Writing movies data')
  buildState.moviesFiles = []
  const allMovies = buildState.movies.map((movie) => {
    return {
      rating: movie.rating + '',
      title: movie.title,
      fullTitle: `${movie.title} ${movie.original_title}`,
      director: movie.director,
      cast: movie.cast.join(','),
      released: movie.release_date.substring(0, 4),
      watched: movie.watch_date ? movie.watch_date.substring(0, 4) : '',
      genres: movie.genres.join(','),
      poster: movie.poster,
      url: `https://www.themoviedb.org/movie/${movie.tmdb_id}`,
    }
  })
  const writers = []
  let firstPage = true
  while (allMovies.length > 0) {
    const movies = allMovies.splice(0, firstPage ? 50 : 200)
    firstPage = false
    const json = JSON.stringify(movies)
    const jsonFilename = `/movies/${checksum(json)}.json`
    buildState.moviesFiles.push(jsonFilename)
    writers.push(fs.outputFile(path.join(outputDir, jsonFilename), json, 'utf8'))
  }
  return Promise.all(writers)
}

/**
 * Write actors files for frontend JSON calls
 */
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

/**
 * Write directors files for frontend JSON calls
 */
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

/**
 * Build frontend with webpack (JS & CSS)
 * The CSS is extracted to be inlined in the HTML
 */
function buildFrontendAssets() {
  log('Building CSS & JS assets')
  const webpackConfig = frontendConfig.webpackFrontend()
  webpackConfig.forEach((config) => {
    config.output.path = outputDir
  })
  return promisify(webpack)(webpackConfig).then((stats) => {
    const info = stats.toJson()
    if (stats.hasErrors()) {
      throw new Error(info.errors[0])
    }
    buildState.assets.moviesScript = `/${info.children[0].assetsByChunkName.movies}`
    buildState.assets.statsScript = `/${info.children[0].assetsByChunkName.stats}`
    buildState.assets.polyfillsScript = `/${info.children[0].assetsByChunkName.polyfills}`
    const moviesStylesPath = path.join(outputDir, info.children[1].assetsByChunkName.moviesStyles)
    const statsStylesPath = path.join(outputDir, info.children[1].assetsByChunkName.statsStyles)
    buildState.moviesStyles = require(moviesStylesPath).toString()
    buildState.statsStyles = require(statsStylesPath).toString()
    return Promise.all([fs.remove(moviesStylesPath), fs.remove(statsStylesPath)])
  })
}

function copyPosters() {
  log('Copying posters')
  const source = path.join(__dirname, '../movies/posters')
  const dest = path.join(outputDir, 'posters')
  return fs.copy(source, dest)
}

/**
 * Render EJS movies page to HTML
 */
function renderMoviesHtml() {
  log('Rendering index.html')
  return fs.readFile(path.join(__dirname, '..', 'frontend', 'movies.ejs'), 'utf8').then((ejsTemplate) => {
    buildState.offlineAssets = [...getAssetsList('base'), ...getAssetsList('app'), ...getAssetsList('movies')]
    const html = ejs.render(ejsTemplate, buildState)
    const minifiedHtml = minify(replaceAssets(html), frontendConfig.htmlMinify)
    buildState.moviesHtmlHash = checksum(minifiedHtml)
    return fs.outputFile(path.join(outputDir, 'index.html'), minifiedHtml, 'utf8')
  })
}

/**
 * Render EJS stats page to HTML
 */
function renderStatsHtml() {
  log('Rendering stats/index.html')
  return fs.readFile(path.join(__dirname, '..', 'frontend', 'stats.ejs'), 'utf8').then((ejsTemplate) => {
    const html = ejs.render(ejsTemplate, buildState)
    const minifiedHtml = minify(replaceAssets(html), frontendConfig.htmlMinify)
    buildState.statsHtmlHash = checksum(minifiedHtml)
    return fs.outputFile(path.join(outputDir, 'stats', 'index.html'), minifiedHtml, 'utf8')
  })
}

/**
 * Replace assets URLs (fonts, actually) in the inlined CSS
 */
function replaceAssets(html) {
  Object.keys(buildState.assets).forEach((id) => {
    html = html.replace(`/__${id}__`, buildState.assets[id])
  })
  return html
}

/**
 * Build service worker with webpack
 * It needs a list of caches
 */
function buildServiceWorker() {
  log('Building service worker')
  const webpackConfig = frontendConfig.webpackServiceWorker(getServiceWorkerCacheTypes())
  webpackConfig.output.path = outputDir
  return promisify(webpack)(webpackConfig).then((stats) => {
    const info = stats.toJson()
    if (stats.hasErrors()) {
      throw new Error(info.errors[0])
    }
  })
}

/**
 * Get assets list by "type", to be used:
 * - in the frontend, when downloading the app to offline
 * - in the service worker, to associate a cache type to a request
 */
function getAssetsList(type) {
  const assets = {
    base: ['/', '/index.html', '/stats/', '/stats/index.html'],
    app: Object.keys(buildState.assets)
      .map((name) => buildState.assets[name])
      .sort(),
    movies: [...buildState.moviesFiles, ...buildState.actorsFiles, ...buildState.directorsFiles],
  }
  return assets[type]
}

/**
 * Cache types to be used in the service worker
 * Each type has a name with the hash of the current associated files,
 * and a list of matchers (filenames or regexs)
 *
 * If a file is modified (for instance, a JS) the associated caches will be renamed (base and app),
 * and the obsolete ones will be cleaned by the up-to-date service worker
 */
function getServiceWorkerCacheTypes() {
  const appAssets = getAssetsList('app')
  const appHash = checksum(JSON.stringify(appAssets))
  const moviesAssets = getAssetsList('movies')
  const moviesHash = checksum(JSON.stringify(moviesAssets))
  const htmlHash = checksum(buildState.moviesHtmlHash + buildState.statsHtmlHash)
  return [
    // Base assets (HTML pages basically), to be updated as soon as there is an app update
    // We can't use getAssetsList('base') here because it would match unwanted resources
    {
      name: `base-${htmlHash}-${appHash}-${moviesHash}`,
      matches: [
        {type: 'path', value: '/'},
        {type: 'path', value: '/index.html'},
        {type: 'path', value: '/stats/'},
        {type: 'path', value: '/stats/index.html'},
      ],
    },
    // App assets (JS files, fonts...)
    {
      name: `app-${appHash}`,
      matches: appAssets.map((asset) => {
        return {type: 'path', value: asset}
      }),
    },
    // Movies-related assets (images & JSON resources for the stats page)
    {
      name: `movies-${moviesHash}`,
      matches: [
        ...moviesAssets.map((asset) => {
          return {type: 'path', value: asset}
        }),
        {type: 'domain', value: 'image.tmdb.org'},
      ],
    },
  ]
}

function outputBuildDuration() {
  log(`Built in ${(new Date().getTime() - startTime) / 1000}s`)
}
