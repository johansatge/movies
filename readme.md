# Movies 🎥

A list of movies I have watched, with ratings and stats.

_This app uses the [TMDb API](https://developers.themoviedb.org/) but is not endorsed or certified by [TMDb](https://www.themoviedb.org/)._

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

To build the project and rsync it.
