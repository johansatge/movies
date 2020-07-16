/* global document, navigator, fetch */

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

/**
 * Init offline feature if a service worker is available and activated
 * The assets list regroups static assets exposed by the build, and images found in the DOM
 */
export function init(assets) {
  if (!navigator || !navigator.serviceWorker || !navigator.serviceWorker.controller) {
    return
  }
  offlineAssets = [...assets, ...getImagesFromDom()]
  nodeBody.dataset.jsHasServiceWorker = true
  nodeSaveButton.addEventListener('click', onSaveOffline)
  nodeCancelButton.addEventListener('click', onCancelOffline)
  nodeConfirmButton.addEventListener('click', onConfirmOffline)
}

/**
 * Parse the DOM and get images to be downloaded offline (will be appended to the static assets list)
 */
function getImagesFromDom() {
  const images = []
  for (let index = 0; index < Math.min(nodeImages.length, 100); index += 1) {
    images.push(nodeImages[index].dataset.jsLazyLoadUrl)
  }
  return images
}

/**
 * Start saving offline when clicking on the topbar button
 */
function onSaveOffline() {
  nodeProgressBar.style.width = '0'
  nodeOverlayProgress.style.display = 'block'
  const assetsToSave = offlineAssets.slice(0)
  isSavingOffline = true
  recursiveFetch(assetsToSave, onSavedOffline)
}

/**
 * Recursively fetch all the assets (and let the service worker cache them automatically)
 * Items are fetch by packets of 20, and progressbar is updated accordingly
 */
function recursiveFetch(assets, callback) {
  if (!isSavingOffline) {
    return callback(new Error('Operation cancelled'))
  }
  const urls = assets.splice(0, 20)
  Promise.all(urls.map((url) => fetch(`${url}#nocache`, { mode: 'no-cors' })))
    .then((responses) => {
      const error = responses.find((response) => response.type !== 'opaque' && !response.ok)
      if (error) {
        throw new Error(error.statusText)
      }
      nodeProgressBar.style.width = `${((offlineAssets.length - assets.length) * 100) / offlineAssets.length}%`
      if (assets.length > 0) {
        recursiveFetch(assets, callback)
      } else {
        callback(null)
      }
    })
    .catch(callback)
}

/**
 * Display confirmation screen when offline operation is done (success or error)
 */
function onSavedOffline(error) {
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
}

/**
 * Stop fetching when clicking on the "cancel" button
 */
function onCancelOffline() {
  isSavingOffline = false
}

/**
 * Close the offline confirmation screen on "OK" click
 */
function onConfirmOffline() {
  nodeOverlayMessage.style.display = 'none'
}
