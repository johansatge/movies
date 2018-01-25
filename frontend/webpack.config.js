const path = require('path')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
  entry: {
    movies: path.join(__dirname, 'js', 'movies.js'),
    stats: path.join(__dirname, 'js', 'stats.js'),
    moviesStyles: path.join(__dirname, 'sass', 'movies.scss'),
    statsStyles: path.join(__dirname, 'sass', 'stats.scss'),
  },
  output: {
    filename: '[name].[chunkhash].js',
    library: ['Scripts', '[name]'],
    libraryTarget: 'umd',
  },
  plugins: [new UglifyJSPlugin()],
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        include: [path.join(__dirname, 'js')],
        loader: 'babel-loader',
        options: {
          presets: ['es2015'],
        },
      },
      {
        test: /\.scss$/,
        use: [
          {
            loader: 'css-loader',
            options: {
              minimize: true,
            },
          },
          'sass-loader',
        ],
      },
    ],
  },
}
