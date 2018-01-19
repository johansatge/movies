const ExtractTextPlugin = require('extract-text-webpack-plugin')
const path = require('path')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

const extractPlugin = new ExtractTextPlugin({
  filename: 'styles.[chunkhash].css',
})

module.exports = {
  entry: {
    movies: path.join(__dirname, 'js', 'movies.js'),
    stats: path.join(__dirname, 'js', 'stats.js'),
    styles: path.join(__dirname, 'sass', 'styles.scss'),
  },
  output: {
    filename: '[name].[chunkhash].js',
    library: ['Scripts', '[name]'],
    libraryTarget: 'var',
  },
  plugins: [extractPlugin, new UglifyJSPlugin()],
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
        use: extractPlugin.extract({
          use: [
            {
              loader: 'css-loader',
              options: {
                minimize: true,
              },
            },
            'sass-loader',
          ],
        }),
      },
    ],
  },
}
