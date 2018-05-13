/* global self, caches, fetch, URL, Headers, Response, OFFLINE_CACHE_TYPES */

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
  const cacheNames = cacheTypes.map((type) => type.name)
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
 * (When dowloading offline, a #nocache string is prepended to each URL, so the network is always called)
 * (This is to avoid having a working progressbar when offline but hitting an existing cache)
 */
function onFetch(evt) {
  debug(`requesting ${evt.request.url}`)
  if (evt.request.method !== 'GET') {
    debug(`ignored ${evt.request.url} (${evt.request.method})`)
    return
  }
  evt.respondWith(
    caches.match(evt.request).then((cachedResource) => {
      const canUseCache = evt.request.url.search(/#nocache$/) === -1
      const fetchAndCacheResource = fetchAndCache(evt.request, !canUseCache)
      if (cachedResource && canUseCache) {
        debug(`serving ${evt.request.url} from cache`)
        return cachedResource
      }
      debug(`serving ${evt.request.url} from network`)
      return fetchAndCacheResource
    })
  )
}

/**
 * Fetch the given request and cache it in the right location
 * When browsing the app, caching is not mandatory so we return the response and cache it in parallel
 * When dowloading offline we need caching, so potential caching errors will be sent back instead of the response
 * The return value is always a Response object so that
 * - the frontend can display a meaningful error (when dowloading for offline)
 * - the browser doesn't complain (Chrome for instance: "an object that was not a Response was passed to respondWith()")
 */
function fetchAndCache(request, cacheIsMandatory) {
  return fetchResource(request)
    .then((response) => {
      debug(`fetched ${request.url} from network`)
      const cachedResponse = response.clone()
      const cacheName = getCacheNameForRequest(request)
      const cacheProcess = caches
        .open(cacheName)
        .then((cache) => cache.put(request, cachedResponse))
        .then(() => {
          debug(`stored ${request.url} in cache (${cacheName})`)
          return response
        })
        .catch((error) => {
          debug(`could not store ${request.url} in cache (${error.message})`)
          return unavailableResponse('Could not store resource')
        })
      return cacheIsMandatory ? cacheProcess : response
    })
    .catch((error) => {
      debug(`could not fetch ${request.url} (${error.message})`)
      return unavailableResponse('Could not fetch resource')
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
 * 503 response to send when a fetch request fails
 */
function unavailableResponse(message) {
  const body = ['<h1>Service unavailable</h1>', `<h2>${message}</h2>`]
  return new Response(body.join('\n'), {
    status: 503,
    statusText: `Service unavailable (${message})`,
    headers: new Headers({
      'Content-Type': 'text/html; charset=utf-8',
    }),
  })
}

/**
 * Find the right cache depending on the request URL
 */
function getCacheNameForRequest(request) {
  const url = new URL(request.url)
  const type = cacheTypes.find((type) => {
    return type.matches.find((match) => {
      if (match.type === 'domain' && url.hostname === match.value) {
        return true
      }
      if (match.type === 'path' && url.pathname === match.value) {
        return true
      }
      return false
    })
  })
  return type ? type.name : 'default'
}
