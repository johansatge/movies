require('dotenv').config()

const compression = require('compression')
const express = require('express')
const path = require('path')

const app = express()

app.use(compression())
app.use('/', express.static(path.join(__dirname, '..', '.dist')))

app.listen(5000, function() {
  console.log('http://localhost:5000') // eslint-disable-line no-console
})
