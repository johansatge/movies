const express = require('express')
const compression = require('compression')

const app = express()

app.use(compression())
app.use('/', express.static('.dist'))

app.listen(5000, function() {
  console.log('http://localhost:5000') // eslint-disable-line no-console
})
