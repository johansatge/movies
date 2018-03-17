/* global self, caches, fetch, Response, Headers, OFFLINE_CACHE_TYPES */

const cacheTypes = OFFLINE_CACHE_TYPES

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
  evt.waitUntil(Promise.resolve().then(() => debug('installed')))
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
  const cacheNames = cacheTypes.map((store) => store.name)
  debug(`cleaning cache (worker cacheNames: ${cacheNames.join(',')}) (local cacheNames: ${keys.join(',')})`)
  return Promise.all(
    keys.filter((key) => !cacheNames.includes(key)).map((key) => {
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

function getCacheNameForRequest(request) {
  const store = cacheTypes.find((store) => {
    return store.matches.find((match) => request.url.search(match) > -1)
  })
  return store ? store.name : 'default'
}

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

function fetchResource(request) {
  const swDomain = `${self.location.protocol}//${self.location.hostname}`
  return request.url.search(swDomain) === 0 ? fetch(request) : fetch(request, {mode: 'no-cors'})
}

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
