module.exports = function(api) {
  api.cache(true);
  
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Handle Node.js module shims
      [
        'module-resolver',
        {
          alias: {
            'http': './types/http-shim.js',
            'https': './types/http-shim.js',
            'ws': './types/ws-shim.js',
          },
        },
      ],
    ],
  };
};
