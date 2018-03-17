/* global document, navigator, caches */

const nodeBody = document.body
const nodeImages = document.querySelectorAll('[data-js-lazy-load-url]')
const nodeSaveButton = document.querySelector('[data-js-save-offline]')

const nodeOverlayProgress = document.querySelector('[data-js-offline-progress-overlay]')
const nodeCancelButton = document.querySelector('[data-js-cancel-offline]')
const nodeProgressBar = document.querySelector('[data-js-progress-offline]')

const nodeOverlayMessage = document.querySelector('[data-js-offline-message-overlay]')
const nodeOverlayMessageContent = document.querySelector('[data-js-offline-message-content]')
const nodeConfirmButton = document.querySelector('[data-js-offline-message-confirm]')

let offlineAssets = null
let isSavingOffline = false

export function init(assets) {
  if (!isServiceWorkerAvailable()) {
    return
  }
  offlineAssets = assets
  for (let index = 0; index < nodeImages.length; index += 1) {
    offlineAssets.push(nodeImages[index].dataset.jsLazyLoadUrl)
  }
  nodeBody.dataset.jsWithSw = true
  nodeSaveButton.addEventListener('click', onSaveOffline)
  nodeCancelButton.addEventListener('click', onCancelOffline)
  nodeConfirmButton.addEventListener('click', onConfirmOffline)
}

function isServiceWorkerAvailable() {
  if (!navigator || !navigator.serviceWorker) {
    return false
  }
  if (document.location.protocol === 'http:' && document.location.hostname !== 'localhost') {
    return false
  }
  return true
}

function onSaveOffline() {
  nodeProgressBar.style.width = '0'
  nodeOverlayProgress.style.display = 'block'
  const assetsToSave = offlineAssets.slice(0)
  isSavingOffline = true
  recursiveFetchAndCache(assetsToSave, (error) => {
    isSavingOffline = false
    if (error) {
      nodeOverlayMessage.dataset.jsOfflineError = true
      nodeOverlayMessageContent.innerHTML = error.message
    } else {
      delete nodeOverlayMessage.dataset.jsOfflineError
      nodeOverlayMessageContent.innerHTML = 'The app is available offline'
    }
    nodeOverlayProgress.style.display = 'none'
    nodeOverlayMessage.style.display = 'block'
  })
}

function recursiveFetchAndCache(assets, callback) {
  if (!isSavingOffline) {
    return callback(new Error('Operation cancelled'))
  }
  const urls = assets.splice(0, 20)
  // @todo use the right cache name
  caches.open('offline').then((cache) => {
    cache
      .addAll(urls)
      .then(() => {
        nodeProgressBar.style.width = `${(offlineAssets.length - assets.length) * 100 / offlineAssets.length}%`
        if (assets.length > 0) {
          recursiveFetchAndCache(assets, callback)
        } else {
          callback(null)
        }
      })
      .catch((error) => {
        callback(new Error(`Could not download offline resources (${error.message})`))
      })
  })
}

function onCancelOffline() {
  isSavingOffline = false
}

function onConfirmOffline() {
  nodeOverlayMessage.style.display = 'none'
}
