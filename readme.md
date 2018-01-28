# Movies 🎥

A list of movies I have watched, with ratings and stats.

_This app uses the [TMDb API](https://developers.themoviedb.org/) but is not endorsed or certified by [TMDb](https://www.themoviedb.org/)._

## Features

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
* `release:1992` → search by release year

Search terms can also be combined with the `;` character: `director:George Lucas;release:1983`

## Installation

```shell
# Make sure node >= 8 is installed
node -v
# Clone the project
git clone git@github.com:johansatge/movies.git
cd movies
# Install the dependencies
npm install
# Create .env file with an TMDB API key and the deployment URL
echo "TMDB_API_KEY=xxx" > .env
echo "DEPLOY_URL=xxx" >> .env
```

## Local server

Run:

```shell
npm run server
```

Then, navigate to [`localhost:5000`](http://localhost:5000/).

## Adding a movie

Run:

```shell
npm run import
```

Answer the questions. Then, commit the updated JSON file.

## Deployment

Run:

```shell
npm run deploy
```

To build the project and rsync it on `DEPLOY_URL`.
