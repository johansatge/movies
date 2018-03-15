/* global document, navigator */

const nodeBody = document.body
const nodeOverlay = document.querySelector('[data-js-overlay-offline]')
const nodeSaveButton = document.querySelector('[data-js-save-offline]')
const nodeCancelButton = document.querySelector('[data-js-cancel-offline]')
const nodeProgressBar = document.querySelector('[data-js-progress-offline]')

export function init() {
  if (!isServiceWorkerAvailable()) {
    return
  }
  nodeBody.dataset.jsWithSw = true
  nodeSaveButton.addEventListener('click', onSaveOffline)
  nodeCancelButton.addEventListener('click', onCancelOffline)
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
  nodeOverlay.style.display = 'block'

  console.log('@todo save offline', nodeProgressBar)
}

function onCancelOffline() {
  nodeOverlay.style.display = 'none'

  console.log('@todo cancel offline')
}
