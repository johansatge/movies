const fs = require('fs')

const files = [
  'movies/2011.json',
  'movies/2012.json',
  'movies/2013.json',
  'movies/2014.json',
  'movies/2015.json',
  'movies/2016.json',
  'movies/2017.json',
]

files.forEach((filePath) => {
  fs.readFile(filePath, 'utf8', (error, contents) => {
    const json = JSON.parse(contents)
    //
    // do stuff with the data
    //
    fs.writeFile(filePath, JSON.stringify(json, null, 2), 'utf8', () => {
      process.stdout.write(`Wrote ${filePath}`)
    })
  })
})
