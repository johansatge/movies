/* global self, caches, fetch, Response, Headers */

// @todo generate this automatically
// @todo have a key for each asset type (webpack asset, external images...)
const cacheVersion = 'v4::'

self.addEventListener('install', onInstall)
self.addEventListener('activate', onActivate)
self.addEventListener('fetch', onFetch)

function debug(message) {
  if (self.location.hostname === 'localhost') {
    console.log(`SW: ${message}`) // eslint-disable-line no-console
  }
}

function onInstall(evt) {
  debug('installing')
  evt.waitUntil(
    caches
      .open(`${cacheVersion}base`)
      .then((cache) => cache.addAll(['/', 'index.html']))
      .then(() => debug('installed'))
      .catch((error) => debug(`could not install (${error.message})`))
  )
}

function onActivate(evt) {
  debug('activating')
  evt.waitUntil(
    caches
      .keys()
      .then(cleanCacheKeys)
      .then(() => debug('activated'))
      .catch((error) => debug(`could not active (${error.message})`))
  )
}

function cleanCacheKeys(keys) {
  debug(`cleaning cache (version: ${cacheVersion}) (keys: ${keys.join(',')})`)
  return Promise.all(
    keys.filter((key) => !key.startsWith(cacheVersion)).map((key) => {
      debug(`deleting cache (${key})`)
      caches.delete(key)
    })
  )
}

function onFetch(evt) {
  debug(`requesting ${evt.request.url}`)
  if (evt.request.method !== 'GET') {
    debug(`ignored ${evt.request.url} (${evt.request.method})`)
    return
  }
  evt.respondWith(
    caches.match(evt.request).then((cachedResource) => {
      const fetchResource = fetchAndCache(evt.request)
      if (cachedResource) {
        debug(`serving ${evt.request.url} from cache`)
        return cachedResource
      }
      debug(`serving ${evt.request.url} from network`)
      return fetchResource
    })
  )
}

function fetchAndCache(request) {
  return fetch(request)
    .then((response) => {
      debug(`fetched ${request.url} from network`)
      const cachedResponse = response.clone()
      caches
        .open(cacheVersion + 'pages')
        .then((cache) => cache.put(request, cachedResponse))
        .then(() => debug(`stored ${request.url} in cache`))
        .catch((error) => debug(`could not store ${request.url} in cache (${error.message})`))
      return response
    })
    .catch((error) => {
      debug(`could not fetch ${request.url} (${error.message})`)
      return unavailableResponse()
    })
}

function unavailableResponse() {
  return new Response('<h1>Service unavailable</h1>', {
    status: 503,
    statusText: 'Service unavailable',
    headers: new Headers({
      'Content-Type': 'text/html; charset=utf-8',
    }),
  })
}
