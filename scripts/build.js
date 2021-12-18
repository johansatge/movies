const ejs = require('ejs')
const frontendConfig = require('../frontend/config.js')
const fsp = require('fs').promises
const minify = require('html-minifier').minify
const path = require('path')
const promisify = require('util').promisify
const webpack = require('webpack')
const { extractStats } = require('./helpers/stats.js')
const { log } = require('./helpers/log.js')
const { checksumFile, checksumString } = require('./helpers/checksum.js')

const buildState = {
  assets: {},
}
const outputDir = path.join(__dirname, '..', '.dist')
const startTime = new Date().getTime()

build()

async function build() {
  try {
    await cleanDist()
    await writeLogos()
    await writeFavicon()
    await writeFonts()
    await writeManifest()
    await readMovies()
    await writeMoviesData()
    await writeActors()
    await writeDirectors()
    await buildFrontendAssets()
    await copyPosters()
    await renderMoviesHtml()
    await renderStatsHtml()
    await buildServiceWorker()
    await outputBuildDuration()
  } catch (error) {
    log(error.message)
    log(error.stack)
    process.exit(1)
  }
}

/**
 * Clean destination directory
 */
async function cleanDist() {
  log(`Cleaning ${outputDir}`)
  try {
    await fsp.rm(outputDir, { recursive: true })
  } catch (error) {
    // nothing
  }
  await fsp.mkdir(outputDir, { recursive: true })
  await fsp.mkdir(path.join(outputDir, 'actors'))
  await fsp.mkdir(path.join(outputDir, 'directors'))
  await fsp.mkdir(path.join(outputDir, 'movies'))
  await fsp.mkdir(path.join(outputDir, 'posters'))
  await fsp.mkdir(path.join(outputDir, 'stats'))
}

/**
 * Write logo with hashes
 */
async function writeLogos() {
  log('Writing logos')
  await writeLogo('256')
  await writeLogo('512')
}

/**
 * Write a logo in the destination dir and add it to the manifest
 */
async function writeLogo(size) {
  const filename = await writeFileWithHash(path.join('frontend', `logo-${size}.png`))
  buildState.assets[`logo-${size}`] = `/${filename}`
  frontendConfig.manifest.icons.push({
    src: `/${filename}`,
    sizes: `${size}x${size}`,
    type: 'image/png',
  })
}

/**
 * Write the favicon and keep its name for later use in the HTML templates
 */
async function writeFavicon() {
  log('Writing favicon')
  const filename = await writeFileWithHash(path.join('frontend', 'favicon.png'))
  buildState.assets.favicon = `/${filename}`
}

/**
 * Write the fonts and keep their names for later use in the HTML templates
 */
async function writeFonts() {
  log('Writing fonts')
  const fontsPath = path.join(__dirname, '../frontend/fonts')
  const files = (await fsp.readdir(fontsPath)).filter((file) => file.search(/\.woff2?$/) > -1)
  for (let index = 0; index < files.length; index += 1) {
    const filename = await writeFileWithHash(path.join(fontsPath, files[index]))
    buildState.assets[path.parse(files[index]).base] = `/${filename}`
  }
}

/**
 * Write a file in the destination dir and add its checksum in its name
 */
async function writeFileWithHash(filePath) {
  const hash = await checksumFile(filePath)
  const pathParts = path.parse(filePath)
  const filename = `${pathParts.name}.${hash}${pathParts.ext}`
  await fsp.copyFile(filePath, path.join(outputDir, filename))
  return filename
}

/**
 * Write the manifest and keep its name for later use in the HTML templates
 */
async function writeManifest() {
  log('Writing manifest')
  const json = JSON.stringify(frontendConfig.manifest)
  const filename = `manifest.${checksumString(json)}.json`
  buildState.assets.manifest = `/${filename}`
  await fsp.writeFile(path.join(outputDir, filename), json, 'utf8')
}

/**
 * Read & parse movies stats from the JSON files
 */
async function readMovies() {
  log('Reading movies list')
  buildState.movies = []
  const moviesPath = path.join(__dirname, '../movies')
  let files = await fsp.readdir(moviesPath)
  files = files
    .filter((file) => file.endsWith('.json'))
    .sort()
    .reverse()
  for (let index = 0; index < files.length; index += 1) {
    const json = await fsp.readFile(path.join(moviesPath, files[index]), 'utf8')
    buildState.movies = buildState.movies.concat(JSON.parse(json).reverse())
  }
  buildState.stats = extractStats(buildState.movies)
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
    const jsonFilename = `/movies/${checksumString(json)}.json`
    buildState.moviesFiles.push(jsonFilename)
    writers.push(fsp.writeFile(path.join(outputDir, jsonFilename), json, 'utf8'))
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
    const jsonFilename = `/actors/${checksumString(json)}.json`
    buildState.actorsFiles.push(jsonFilename)
    writers.push(fsp.writeFile(path.join(outputDir, jsonFilename), json, 'utf8'))
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
    const jsonFilename = `/directors/${checksumString(json)}.json`
    buildState.directorsFiles.push(jsonFilename)
    writers.push(fsp.writeFile(path.join(outputDir, jsonFilename), json, 'utf8'))
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
    const commonStylesPath = path.join(outputDir, info.children[1].assetsByChunkName.commonStyles)
    const moviesStylesPath = path.join(outputDir, info.children[1].assetsByChunkName.moviesStyles)
    const statsStylesPath = path.join(outputDir, info.children[1].assetsByChunkName.statsStyles)
    buildState.commonStyles = require(commonStylesPath).toString()
    buildState.moviesStyles = require(moviesStylesPath).toString()
    buildState.statsStyles = require(statsStylesPath).toString()
    return Promise.all([fsp.unlink(commonStylesPath), fsp.unlink(moviesStylesPath), fsp.unlink(statsStylesPath)])
  })
}

async function copyPosters() {
  log('Copying posters')
  const sourcePath = path.join(__dirname, '../movies/posters')
  const destPath = path.join(outputDir, 'posters')
  const files = (await fsp.readdir(sourcePath)).filter((file) => file.endsWith('.jpg'))
  for (let index = 0; index < files.length; index += 1) {
    await fsp.copyFile(path.join(sourcePath, files[index]), path.join(destPath, files[index]))
  }
}

/**
 * Render EJS movies page to HTML
 */
async function renderMoviesHtml() {
  log('Rendering index.html')
  const ejsTemplate = await fsp.readFile(path.join(__dirname, '..', 'frontend', 'movies.ejs'), 'utf8')
  buildState.offlineAssets = [...getAssetsList('base'), ...getAssetsList('app'), ...getAssetsList('movies')]
  const html = ejs.render(ejsTemplate, buildState)
  const minifiedHtml = minify(replaceAssets(html), frontendConfig.htmlMinify)
  buildState.moviesHtmlHash = checksumString(minifiedHtml)
  await fsp.writeFile(path.join(outputDir, 'index.html'), minifiedHtml, 'utf8')
}

/**
 * Render EJS stats page to HTML
 */
async function renderStatsHtml() {
  log('Rendering stats/index.html')
  const ejsTemplate = await fsp.readFile(path.join(__dirname, '..', 'frontend', 'stats.ejs'), 'utf8')
  const html = ejs.render(ejsTemplate, buildState)
  const minifiedHtml = minify(replaceAssets(html), frontendConfig.htmlMinify)
  buildState.statsHtmlHash = checksumString(minifiedHtml)
  await fsp.writeFile(path.join(outputDir, 'stats', 'index.html'), minifiedHtml, 'utf8')
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
  const appHash = checksumString(JSON.stringify(appAssets))
  const moviesAssets = getAssetsList('movies')
  const moviesHash = checksumString(JSON.stringify(moviesAssets))
  const htmlHash = checksumString(buildState.moviesHtmlHash + buildState.statsHtmlHash)
  return [
    // Base assets (HTML pages basically), to be updated as soon as there is an app update
    // We can't use getAssetsList('base') here because it would match unwanted resources
    {
      name: `base-${htmlHash}-${appHash}-${moviesHash}`,
      matches: [
        { type: 'absPath', value: '/' },
        { type: 'absPath', value: '/index.html' },
        { type: 'absPath', value: '/stats/' },
        { type: 'absPath', value: '/stats/index.html' },
      ],
    },
    // App assets (JS files, fonts...)
    {
      name: `app-${appHash}`,
      matches: appAssets.map((asset) => {
        return { type: 'absPath', value: asset }
      }),
    },
    // Movies-related assets (images & JSON resources)
    {
      name: `movies-${moviesHash}`,
      matches: [
        { type: 'pathStartsWith', value: '/posters/' },
        { type: 'pathStartsWith', value: '/actors/' },
        { type: 'pathStartsWith', value: '/directors/' },
        { type: 'pathStartsWith', value: '/movies/' },
      ],
    },
  ]
}

function outputBuildDuration() {
  log(`Built in ${(new Date().getTime() - startTime) / 1000}s`)
}
