/* global self, caches, fetch, Response, Headers, OFFLINE_CACHE_STORES */

const cacheStores = OFFLINE_CACHE_STORES

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
  const cacheNames = cacheStores.map((store) => store.name)
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
  for (let storeIndex = 0; storeIndex < cacheStores.length; storeIndex += 1) {
    const store = cacheStores[storeIndex]
    for (let matchIndex = 0; matchIndex < store.matches.length; matchIndex += 1) {
      const matcher = store.matches[matchIndex]
      if (request.url.search(matcher) > -1) {
        return store.name
      }
    }
  }
  return 'default'
}

function fetchAndCache(request) {
  return fetch(request, {mode: 'no-cors'})
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
