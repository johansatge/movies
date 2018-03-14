const path = require('path')

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
  webpack: [
    // JS files are processed with Babel and bundled in a "var"
    {
      mode: 'production',
      entry: {
        movies: path.join(__dirname, 'js', 'movies.js'),
        stats: path.join(__dirname, 'js', 'stats.js'),
        polyfills: path.join(__dirname, 'js', 'polyfills.js'),
        serviceworker: path.join(__dirname, 'js', 'serviceworker.js'),
      },
      output: {
        filename: function(entry) {
          if (entry.chunk.name === 'serviceworker') {
            return 'serviceworker.js'
          }
          return `${entry.chunk.name}.${entry.chunk.hash}.js`
        },
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
              presets: ['es2015'],
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
  ],
}
