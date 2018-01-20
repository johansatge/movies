const build = require('./build.js')
const express = require('express')
const compression = require('compression')

const app = express()

app.use(compression())
app.use('/', express.static('.dist'))

build
  .buildApp()
  .then(() => {
    app.listen(5000, function() {
      console.log('http://localhost:5000') // eslint-disable-line no-console
    })
  })
  .catch((error) => {
    console.log(error.message) // eslint-disable-line no-console
    process.exit(1)
  })
