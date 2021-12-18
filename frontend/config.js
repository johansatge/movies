const path = require('path')
const webpack = require('webpack')

module.exports = {
  manifest: {
    name: 'Movies',
    short_name: 'Movies',
    display: 'standalone',
    background_color: '#000000',
    description: 'A big movies list with stats',
    start_url: '/',
    icons: [],
    orientation: 'any',
    theme_color: '#ffcf20',
  },
  htmlMinify: {
    caseSensitive: true,
    collapseWhitespace: true,
    conservativeCollapse: true,
    html5: true,
    minifyCSS: false,
    minifyJS: false,
    removeAttributeQuotes: false,
    removeComments: true,
    removeEmptyAttributes: true,
    removeScriptTypeAttributes: true,
    useShortDoctype: true,
  },
  webpackFrontend: () => {
    return [
      // JS files are processed with Babel and bundled in a "var"
      {
        mode: 'production',
        entry: {
          movies: path.join(__dirname, 'js', 'movies.js'),
          stats: path.join(__dirname, 'js', 'stats.js'),
        },
        output: {
          filename: (entry) => `${entry.chunk.name}.${entry.chunk.hash}.js`,
          library: ['Scripts', '[name]'],
          libraryTarget: 'var',
        },
        module: {
          rules: [
            {
              test: /\.jsx?$/,
              include: [path.join(__dirname, 'js')],
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env'],
              },
            },
          ],
        },
      },
      // CSS files are exported as commonJS modules and used in the build script
      {
        mode: 'production',
        entry: {
          commonStyles: path.join(__dirname, 'css', 'common.css'),
          moviesStyles: path.join(__dirname, 'css', 'movies.css'),
          statsStyles: path.join(__dirname, 'css', 'stats.css'),
        },
        output: {
          libraryTarget: 'commonjs2',
        },
        module: {
          rules: [
            {
              test: /\.css$/,
              include: [path.join(__dirname, 'css')],
              use: [
                'css-loader',
              ],
            },
          ],
        },
      },
    ]
  },
  webpackServiceWorker: (cacheTypes) => {
    return {
      mode: 'production',
      entry: {
        serviceworker: path.join(__dirname, 'js', 'serviceworker.js'),
      },
      output: {
        filename: 'serviceworker.js',
        libraryTarget: 'var',
      },
      module: {
        rules: [
          {
            test: /\.jsx?$/,
            include: [path.join(__dirname, 'js')],
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        ],
      },
      plugins: [
        new webpack.DefinePlugin({
          OFFLINE_CACHE_TYPES: JSON.stringify(cacheTypes),
        }),
      ],
    }
  },
}
