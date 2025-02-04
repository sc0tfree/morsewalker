const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = {
  entry: {
    app: './src/js/app.js',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    filename: './js/app.js',
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader, // Extract CSS in production
          'css-loader',
        ],
      },
      {
        test: /\.(mp3|wav|ogg)$/, // Match audio file types
        type: 'asset/resource', // Use Webpack's asset/resource loader for static assets
        generator: {
          filename: 'audio/[name][ext]', // Output to 'dist/audio' directory
        },
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: 'css/[name].css', // Output CSS files
    }),
    new CopyPlugin({
      patterns: [
        { from: 'src/audio', to: 'audio' }, // Ensure all files in 'audio' are copied to 'dist/audio'
        { from: 'src/img', to: 'img' },
        { from: 'src/favicon.ico', to: 'favicon.ico' },
        { from: 'src/robots.txt', to: 'robots.txt' },
        { from: 'src/site.webmanifest', to: 'site.webmanifest' },
        { from: 'src/js/morse-input/sounder.js', to: 'js/morse-input/sounder.js' },
        { from: 'src/js/morse-input/decoder.js', to: 'js/morse-input/decoder.js' },
        { from: 'src/js/morse-input/keyer.js', to: 'js/morse-input/keyer.js' }
      ]
    }),
  ],
};
