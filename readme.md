![movies](movies.png)

# Movies 🎥

A list of movies I have watched, with ratings, stats, and offline support.

_This app uses the [TMDb API](https://developers.themoviedb.org/) but is not endorsed or certified by [TMDb](https://www.themoviedb.org/)._

* [Features](#features)
  * [Advanced search](#advanced-search)
* [Local installation](#local-installation)
* [Adding a movie](#adding-a-movie)
* [Build and deployment](#build-and-deployment)

## Features

* Full offline support
* Movies list with ratings
* Most used ratings
* Movies by release year
* Movies by month
* Most seen actors
* Most seen directors

### Advanced search

The search field on the movies page accepts the following syntaxes:

* `Matrix` or `title:Matrix` → search by title
* `rating:8` → search by rating
* `actor:Charles Bronson` → search by actor
* `director:George Lucas` → search by director
* `released:1992` → search by release year
* `runtime:01h30` → search by runtime
* `watched:2018` → search by watch year
* `genre:Action` → search by genre

Search terms can also be combined with the `;` character: `director:George Lucas;release:1983`

## Local installation

```shell
# Make sure node 16 is installed
node -v
# Clone the project
git clone git@github.com:johansatge/movies.git
cd movies
# Install the dependencies
npm install
# Create env file with a TMDB API key:
echo "module.exports = { TMDB_API_KEY: 'xxx' }" > .env.js
# Run the local server (will rebuild app on changes)
npm run watch
# Navigate to http://localhost:5000/
```

## Adding a movie

Run:

```shell
npm run import
```

Answer the questions. Then, commit the updated JSON file, and poster file.

## Build and deployment

To test the build locally, run:

```shell
npm run build
```

Assets are built in `.dist`.

Deployment is handled by [Netlify](https://www.netlify.com/), when pushing updates on `master`.
