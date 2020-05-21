const compression = require('compression')
const express = require('express')
const path = require('path')

const app = express()

app.use(compression())
app.get('/serviceworker.js', (request, response) => {
  response.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0')
  response.status(200).sendFile(path.join(__dirname, '..', '.dist', 'serviceworker.js'))
})
app.use('/', express.static(path.join(__dirname, '..', '.dist')))

app.listen(5000, function() {
  console.log('http://localhost:5000') // eslint-disable-line no-console
})
