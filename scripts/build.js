const ejs = require('ejs')
const frontendConfig = require('../frontend/config.js')
const fsp = require('fs').promises
const minify = require('html-minifier').minify
const path = require('path')
const promisify = require('util').promisify
const webpack = require('webpack')
const { extractStats } = require('./helpers/stats.js')
const { log } = require('./helpers/log.js')
const { checksumString, copyFileWithHash } = require('./helpers/checksum.js')

const buildState = {
  // App assets (URLs to be injected in the HTML and SW)
  appAssets: {},
  // Movies assets (movies, actors & directors files; URLs to be injected in the HTML and SW)
  moviesAssets: {
    movies: [],
    actors: [],
    directors: [],
  },
  // CSS styles to be inlined in the HTML
  styles: {},
  // App logos to be inlined in the HTML and the manifest
  logos: [],
  movies: [],
  stats: null,
  offlineAssets: null,
  moviesHtmlHash: null,
  statsHtmlHash: null,
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
    await readWatchedMovies()
    await writeMovies()
    await writeActorsAndDirectors('actors')
    await writeActorsAndDirectors('directors')
    await buildCss()
    await buildJs()
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

async function writeLogos() {
  log('Writing logos')
  await writeLogo('256')
  await writeLogo('512')
}

async function writeLogo(size) {
  const filename = await copyFileWithHash(path.join(__dirname, `../frontend/logo-${size}.png`), outputDir)
  buildState.appAssets[`logo-${size}`] = `/${filename}`
  // https://developer.mozilla.org/en-US/docs/Web/Manifest/icons
  buildState.logos.push({
    src: `/${filename}`,
    sizes: `${size}x${size}`,
    type: 'image/png',
  })
}

async function writeFavicon() {
  log('Writing favicon')
  const filename = await copyFileWithHash(path.join(__dirname, '../frontend/favicon.png'), outputDir)
  buildState.appAssets.favicon = `/${filename}`
}

async function writeFonts() {
  log('Writing fonts')
  const fontsPath = path.join(__dirname, '../frontend/fonts')
  const files = (await fsp.readdir(fontsPath)).filter((file) => file.search(/\.woff2?$/) > -1)
  for (let index = 0; index < files.length; index += 1) {
    const filename = await copyFileWithHash(path.join(fontsPath, files[index]), outputDir)
    buildState.appAssets[path.parse(files[index]).base] = `/${filename}`
  }
}

async function writeManifest() {
  log('Writing manifest')
  const rawJson = JSON.parse(await fsp.readFile(path.join(__dirname, '../frontend/manifest.json')))
  rawJson.icons = buildState.logos
  const json = JSON.stringify(rawJson)
  const filename = `manifest.${checksumString(json)}.json`
  buildState.appAssets.manifest = `/${filename}`
  await fsp.writeFile(path.join(outputDir, filename), json, 'utf8')
}

async function readWatchedMovies() {
  log('Reading movies list')
  const moviesPath = path.join(__dirname, '../movies')
  const files = (await fsp.readdir(moviesPath))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .reverse()
  for (let index = 0; index < files.length; index += 1) {
    const json = await fsp.readFile(path.join(moviesPath, files[index]), 'utf8')
    buildState.movies = buildState.movies.concat(JSON.parse(json).reverse())
  }
  buildState.stats = extractStats(buildState.movies)
}

function writeMovies() {
  log('Writing movies data')
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
    buildState.moviesAssets.movies.push(jsonFilename)
    writers.push(fsp.writeFile(path.join(outputDir, jsonFilename), json, 'utf8'))
  }
  return Promise.all(writers)
}

function writeActorsAndDirectors(type) {
  log(`Writing ${type}`)
  const writers = []
  while (buildState.stats[type].length > 0) {
    const items = buildState.stats[type].splice(0, 1000)
    const json = JSON.stringify(items)
    const jsonFilename = `/${type}/${checksumString(json)}.json`
    buildState.moviesAssets[type].push(jsonFilename)
    writers.push(fsp.writeFile(path.join(outputDir, jsonFilename), json, 'utf8'))
  }
  return Promise.all(writers)
}

async function buildCss() {
  log('Building CSS assets')
  const cssPath = path.join(__dirname, '../frontend/css')
  const files = (await fsp.readdir(cssPath)).filter((file) => file.endsWith('.css'))
  for (let index = 0; index < files.length; index += 1) {
    let css = await fsp.readFile(path.join(cssPath, files[index]), 'utf8')
    Object.keys(buildState.appAssets).forEach((id) => {
      css = css.replace(`/__${id}__`, buildState.appAssets[id])
    })
    css = css.replace(/\n/g, ' ')
    css = css.replace(/ {2,}/g, '')
    css = css.replace(/\/\*[^*]*\*\//g, '')
    buildState.styles[path.parse(files[index]).name] = css
  }
}

async function buildJs() {
  log('Building JS assets')
  const webpackConfig = frontendConfig.webpackFrontend()
  webpackConfig.forEach((config) => {
    config.output.path = outputDir
  })
  const stats = await promisify(webpack)(webpackConfig)
  const info = stats.toJson()
  if (stats.hasErrors()) {
    throw new Error(info.errors[0])
  }
  buildState.appAssets.moviesScript = `/${info.children[0].assetsByChunkName.movies}`
  buildState.appAssets.statsScript = `/${info.children[0].assetsByChunkName.stats}`
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

async function renderMoviesHtml() {
  log('Rendering index.html')
  const ejsTemplate = await fsp.readFile(path.join(__dirname, '..', 'frontend', 'movies.ejs'), 'utf8')
  buildState.offlineAssets = [...getAssetsList('base'), ...getAssetsList('app'), ...getAssetsList('movies')]
  const html = ejs.render(ejsTemplate, buildState)
  const minifiedHtml = minify(html, frontendConfig.htmlMinify)
  buildState.moviesHtmlHash = checksumString(minifiedHtml)
  await fsp.writeFile(path.join(outputDir, 'index.html'), minifiedHtml, 'utf8')
}

async function renderStatsHtml() {
  log('Rendering stats/index.html')
  const ejsTemplate = await fsp.readFile(path.join(__dirname, '..', 'frontend', 'stats.ejs'), 'utf8')
  const html = ejs.render(ejsTemplate, buildState)
  const minifiedHtml = minify(html, frontendConfig.htmlMinify)
  buildState.statsHtmlHash = checksumString(minifiedHtml)
  await fsp.writeFile(path.join(outputDir, 'stats/index.html'), minifiedHtml, 'utf8')
}

async function buildServiceWorker() {
  log('Building service worker')
  const webpackConfig = frontendConfig.webpackServiceWorker(getServiceWorkerCacheTypes())
  webpackConfig.output.path = outputDir
  const stats = await promisify(webpack)(webpackConfig)
  const info = stats.toJson()
  if (stats.hasErrors()) {
    throw new Error(info.errors[0])
  }
}

/**
 * Get assets list by "type", to be used:
 * - in the frontend, when downloading the app to offline
 * - in the service worker, to associate a cache type to a request
 */
function getAssetsList(type) {
  const assets = {
    base: ['/', '/index.html', '/stats/', '/stats/index.html'],
    app: Object.keys(buildState.appAssets)
      .map((name) => buildState.appAssets[name])
      .sort(),
    movies: [
      ...buildState.moviesAssets.movies,
      ...buildState.moviesAssets.actors,
      ...buildState.moviesAssets.directors,
    ],
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
