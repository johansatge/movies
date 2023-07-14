const esbuild = require('esbuild')
const ejs = require('ejs')
const fs = require('fs')
const fsp = require('fs').promises
const minify = require('html-minifier').minify
const path = require('path')
const { extractStats, getReadableRuntime } = require('./helpers/stats.js')
const { log } = require('./helpers/log.js')
const { checksumString, copyFileWithHash } = require('./helpers/checksum.js')
const httpdir = require('/usr/local/lib/node_modules/httpdir')
const languages = require('./helpers/languages.json')

// State is populated in each build state, and forwarded to EJS
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
  // Stats computed when writing movies (years, actors, directors...)
  stats: null,
  languages,
  // List of assets (by URL), inlined in the HTML, to be fetched when clicking the "Download" button
  offlineAssets: null,
  // Hash of index.html & stats/index.html used in the SW to invalidate cache
  htmlHash: {
    movies: null,
    stats: null,
  },
}

const srcDir = path.join(__dirname, '../frontend')
const outputDir = path.join(__dirname, '../.dist')
const htmlMinifyOptions = {
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
}

build()
if (process.argv.includes('--watch')) {
  const server = httpdir.createServer({ basePath: '.dist', httpPort: 5001 })
  server.onStart(({ urls }) => {
    console.log(urls.join('\n'))
  })
  server.start()
  buildOnChange()
}

async function build() {
  try {
    const startTime = Date.now()
    await cleanDist()
    await writeLogos()
    await writeFavicon()
    await writeFonts()
    await writeManifest()
    await writeMovies()
    await writeActorsAndDirectors('actors')
    await writeActorsAndDirectors('directors')
    await buildCss()
    await buildJs()
    await copyPosters()
    await renderMoviesHtml()
    await renderStatsHtml()
    await buildServiceWorker()
    log(`Built in ${(Date.now() - startTime) / 1000}s`)
  } catch (error) {
    log(error.message)
    log(error.stack)
    process.exit(1)
  }
}

async function buildOnChange() {
  log(`Watching ${srcDir}`)
  fs.watch(srcDir, { recursive: true }, (evtType, file) => {
    log(`Event ${evtType} on ${file}, building...`)
    build()
  })
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
  for (const file of files) {
    const filename = await copyFileWithHash(path.join(fontsPath, file), outputDir)
    buildState.appAssets[path.parse(file).base] = `/${filename}`
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

async function writeMovies() {
  log('Reading movies list & writing data')
  const moviesPath = path.join(__dirname, '../movies')
  const files = (await fsp.readdir(moviesPath))
    .filter((file) => file.endsWith('.json'))
    .sort()
    .reverse()
  const fullMovies = []
  const frontendMovies = []
  for (const file of files) {
    const json = await fsp.readFile(path.join(moviesPath, file), 'utf8')
    const movies = JSON.parse(json).reverse()
    movies.forEach((movie) => {
      fullMovies.push(movie)
      frontendMovies.push({
        rating: movie.rating + '',
        title: movie.title,
        fullTitle: `${movie.title} ${movie.original_title}`,
        director: movie.director,
        cast: movie.cast.join(','),
        released: movie.release_date.substring(0, 4),
        watched: movie.watch_date ? movie.watch_date.substring(0, 4) : '',
        genres: movie.genres.join(','),
        lang: movie.original_language,
        runtime: getReadableRuntime(movie.runtime),
        poster: movie.poster,
        url: `https://www.themoviedb.org/movie/${movie.tmdb_id}`,
      })
    })
  }
  buildState.stats = extractStats(fullMovies)
  let firstPage = true
  while (frontendMovies.length > 0) {
    firstPage = false
    const json = JSON.stringify(frontendMovies.splice(0, firstPage ? 50 : 200))
    const jsonFilename = `/movies/${checksumString(json)}.json`
    buildState.moviesAssets.movies.push(jsonFilename)
    await fsp.writeFile(path.join(outputDir, jsonFilename), json, 'utf8')
  }
}

async function writeActorsAndDirectors(type) {
  log(`Writing ${type}`)
  while (buildState.stats[type].length > 0) {
    const items = buildState.stats[type].splice(0, 1000)
    const json = JSON.stringify(items)
    const jsonFilename = `/${type}/${checksumString(json)}.json`
    buildState.moviesAssets[type].push(jsonFilename)
    await fsp.writeFile(path.join(outputDir, jsonFilename), json, 'utf8')
  }
}

async function buildCss() {
  log('Building CSS assets')
  const cssPath = path.join(__dirname, '../frontend/css')
  const files = (await fsp.readdir(cssPath)).filter((file) => file.endsWith('.css'))
  for (const file of files) {
    let css = await fsp.readFile(path.join(cssPath, file), 'utf8')
    Object.keys(buildState.appAssets).forEach((id) => {
      css = css.replace(`/__${id}__`, buildState.appAssets[id])
    })
    css = css.replace(/\n/g, ' ')
    css = css.replace(/ {2,}/g, '')
    css = css.replace(/\/\*[^*]*\*\//g, '')
    buildState.styles[path.parse(file).name] = css
  }
}

async function buildJs() {
  log('Building JS assets')
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, '../frontend/js/movies.js'), path.join(__dirname, '../frontend/js/stats.js')],
    bundle: true,
    minify: true,
    entryNames: '[name].[hash]',
    outdir: outputDir,
    metafile: true,
  })
  if (result.errors.length > 0) {
    throw new Error(result.errors[0])
  }
  const assets = Object.keys(result.metafile.outputs)
  buildState.appAssets.moviesScript = `/${path.parse(assets[0]).base}`
  buildState.appAssets.statsScript = `/${path.parse(assets[1]).base}`
}

async function copyPosters() {
  log('Copying posters')
  const sourcePath = path.join(__dirname, '../movies/posters')
  const destPath = path.join(outputDir, 'posters')
  const files = (await fsp.readdir(sourcePath)).filter((file) => file.endsWith('.jpg'))
  for (const file of files) {
    await fsp.copyFile(path.join(sourcePath, file), path.join(destPath, file))
  }
}

async function renderMoviesHtml() {
  log('Rendering index.html')
  const ejsTemplate = await fsp.readFile(path.join(__dirname, '..', 'frontend', 'movies.ejs'), 'utf8')
  buildState.offlineAssets = [...getAssetsList('base'), ...getAssetsList('app'), ...getAssetsList('movies')]
  const html = ejs.render(ejsTemplate, buildState)
  const minifiedHtml = minify(html, htmlMinifyOptions)
  buildState.htmlHash.movies = checksumString(minifiedHtml)
  await fsp.writeFile(path.join(outputDir, 'index.html'), minifiedHtml, 'utf8')
}

async function renderStatsHtml() {
  log('Rendering stats/index.html')
  const ejsTemplate = await fsp.readFile(path.join(__dirname, '..', 'frontend', 'stats.ejs'), 'utf8')
  const html = ejs.render(ejsTemplate, buildState)
  const minifiedHtml = minify(html, htmlMinifyOptions)
  buildState.htmlHash.stats = checksumString(minifiedHtml)
  await fsp.writeFile(path.join(outputDir, 'stats/index.html'), minifiedHtml, 'utf8')
}

async function buildServiceWorker() {
  log('Building service worker')
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, '../frontend/js/serviceworker.js')],
    bundle: true,
    minify: true,
    outdir: outputDir,
    metafile: true,
    define: {
      OFFLINE_CACHE_TYPES: JSON.stringify(getServiceWorkerCacheTypes()),
    },
  })
  if (result.errors.length > 0) {
    throw new Error(result.errors[0])
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
  const htmlHash = checksumString(buildState.htmlHash.movies + buildState.htmlHash.stats)
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
