const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = {
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'index.js',
    library: 'surflog',
    libraryTarget: 'umd',
  },
  target: 'node',
  externals: [nodeExternals()],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: path.resolve(__dirname, 'node_modules'),
        use: [
          'babel-loader',
          'ts-loader',
        ],
      }
    ]
  },
  resolve: {
    extensions: ['.js','.ts'],
  },
  optimization: {
    minimize: false,
  }
};
