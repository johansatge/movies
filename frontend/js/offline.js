/* global document, navigator */

const nodeBody = document.body
const nodeButton = document.querySelector('[data-js-save-offline]')

export function init() {
  if (!navigator || !navigator.serviceWorker) {
    return
  }
  nodeBody.dataset.jsWithSw = true
  nodeButton.addEventListener('click', onSaveOffline)
}

function onSaveOffline() {
  console.log('@todo save offline')
}
