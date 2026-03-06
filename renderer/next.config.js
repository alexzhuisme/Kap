const path = require('path');

module.exports = (nextConfig) => {
  return Object.assign({}, nextConfig, {
    webpack(config, options) {
      config.module.rules.push({
        test: /\.+(js|jsx|mjs|ts|tsx)$/,
        loader: options.defaultLoaders.babel,
        include: [
          path.join(__dirname, '..', 'main', 'common')
        ]
      });

      config.devtool = 'cheap-module-source-map';

      // Stub Node built-ins in client bundle (deps like atomically require 'fs')
      if (!options.isServer) {
        config.node = {
          ...config.node,
          fs: 'empty',
          path: 'empty',
          net: 'empty',
          tls: 'empty'
        };
      }

      if (typeof nextConfig.webpack === 'function') {
        return nextConfig.webpack(config, options);
      }

      return config;
    }
  })
}
