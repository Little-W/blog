const path = require('path');
const webpack = require('webpack');

const projectRoot = path.resolve(__dirname, '..');
const vendorRoot = path.join(projectRoot, 'vendor/live2d-cubism-r5');

const config = {
  mode: 'production',
  context: projectRoot,
  entry: path.join(vendorRoot, 'App/src/main.ts'),
  output: {
    path: path.join(projectRoot, 'static/live2d/cubism-r5'),
    filename: 'live2d-cubism-r5.min.js',
    library: {
      name: 'YusenCubismR5',
      type: 'window'
    }
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@framework': path.join(vendorRoot, 'Framework/src')
    }
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        include: vendorRoot,
        use: {
          loader: require.resolve('babel-loader'),
          options: {
            babelrc: false,
            configFile: false,
            presets: [
              [require.resolve('@babel/preset-env'), { targets: 'defaults' }],
              require.resolve('@babel/preset-typescript')
            ]
          }
        }
      }
    ]
  },
  optimization: {
    minimize: true
  },
  performance: {
    hints: false
  },
  plugins: [
    new webpack.BannerPlugin({
      banner: [
        'Live2D Cubism Web SDK R5 integration.',
        'Cubism Components are governed by the Live2D Open Software License.',
        'Cubism Core is governed by the Live2D Proprietary Software License.',
        'License files: /vendor/live2d-cubism-r5 and /static/live2d/cubism-r5/core.'
      ].join(' ')
    })
  ],
  stats: {
    colors: process.stdout.isTTY,
    chunks: false,
    modules: false
  }
};

webpack(config, (error, stats) => {
  if (error) {
    console.error(error);
    process.exitCode = 1;
    return;
  }

  console.log(stats.toString(config.stats));
  if (stats.hasErrors()) process.exitCode = 1;
});
