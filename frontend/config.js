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
          polyfills: path.join(__dirname, 'js', 'polyfills.js'),
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
                presets: ['env'],
              },
            },
          ],
        },
      },
      // CSS files are exported as commonJS modules and used in the build script
      {
        mode: 'production',
        entry: {
          moviesStyles: path.join(__dirname, 'sass', 'movies.scss'),
          statsStyles: path.join(__dirname, 'sass', 'stats.scss'),
        },
        output: {
          libraryTarget: 'commonjs2',
        },
        module: {
          rules: [
            {
              test: /\.scss$/,
              include: [path.join(__dirname, 'sass')],
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
              presets: ['es2015'],
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
