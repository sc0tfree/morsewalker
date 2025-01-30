const TerserPlugin = require('terser-webpack-plugin');
const {merge} = require('webpack-merge');
const common = require('./webpack.common.js');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = merge(common, {
  mode: 'production',
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html',
      hash: true,
    }),
    new CopyPlugin({
      patterns: [
        {from: 'src/img', to: 'img'},
        {from: 'src/favicon.ico', to: 'favicon.ico'},
        {from: 'src/robots.txt', to: 'robots.txt'},
        {from: 'src/404.html', to: '404.html'},
        {from: 'src/js/vendor', to: 'js/vendor'},
        {from: 'src/site.webmanifest', to: 'site.webmanifest'},
      ],
    }),
  ],
});
