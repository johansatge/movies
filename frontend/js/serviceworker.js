/* global self, caches, fetch, Response, Headers, OFFLINE_CACHE_TYPES */

/**
 * Populated on build (see webpack config)
 * Each cache type as a list of matchers (string or regex) and a name
 * (The name contains a hash for the current set of files to be stored in that cache)
 */
const cacheTypes = OFFLINE_CACHE_TYPES

self.addEventListener('install', onInstall)
self.addEventListener('activate', onActivate)
self.addEventListener('fetch', onFetch)

function debug(message) {
  if (self.location.hostname === 'localhost') {
    console.log(`SW: ${message}`) // eslint-disable-line no-console
  }
}

/**
 * Don't do anything on installation for now
 */
function onInstall(evt) {
  debug('installing')
  evt.waitUntil(Promise.resolve().then(() => debug('installed')))
}

/**
 * Clean obsolete caches on activation
 */
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

/**
 * Check the given keys against the list of possible cache names and delete the non-relevant ones
 */
function cleanCacheKeys(keys) {
  const cacheNames = cacheTypes.map((store) => store.name)
  debug(`cleaning cache (worker cacheNames: ${cacheNames.join(',')}) (local cacheNames: ${keys.join(',')})`)
  return Promise.all(
    keys.filter((key) => !cacheNames.includes(key)).map((key) => {
      debug(`deleting cache (${key})`)
      caches.delete(key)
    })
  )
}

/**
 * On fetch, try to serve the resource from cache
 * In parallel, fetch the resource and cache it
 * This may be called when loading pages or when downloading the app offline
 */
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

/**
 * Fetch the given request and cache it in the right location
 */
function fetchAndCache(request) {
  return fetchResource(request)
    .then((response) => {
      debug(`fetched ${request.url} from network`)
      const cachedResponse = response.clone()
      const cacheName = getCacheNameForRequest(request)
      caches
        .open(cacheName)
        .then((cache) => cache.put(request, cachedResponse))
        .then(() => debug(`stored ${request.url} in cache (${cacheName})`))
        .catch((error) => debug(`could not store ${request.url} in cache (${error.message})`))
      return response
    })
    .catch((error) => {
      debug(`could not fetch ${request.url} (${error.message})`)
      return unavailableResponse(error.message)
    })
}

/**
 * Tiny fetch() wrapper
 * We want a no-cors policy when fetching foreign stuff but Chrome doesn't support that when fetching pages (HTML)
 * So let's support both cases
 */
function fetchResource(request) {
  const swDomain = `${self.location.protocol}//${self.location.hostname}`
  return request.url.search(swDomain) === 0 ? fetch(request) : fetch(request, {mode: 'no-cors'})
}

/**
 * Find the right cache depending on the request URL
 */
function getCacheNameForRequest(request) {
  const store = cacheTypes.find((store) => {
    return store.matches.find((match) => request.url.search(match) > -1)
  })
  return store ? store.name : 'default'
}

/**
 * 503 response when the network is not available
 */
function unavailableResponse(message) {
  const body = ['<h1>Service unavailable</h1>', `<h2>${message}</h2>`]
  return new Response(body.join('\n'), {
    status: 503,
    statusText: 'Service unavailable',
    headers: new Headers({
      'Content-Type': 'text/html; charset=utf-8',
    }),
  })
}
