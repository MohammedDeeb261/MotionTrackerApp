// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const defaultConfig = getDefaultConfig(__dirname);

// Simplify and make more robust resolver configuration
const nodeModules = {
  stream: require.resolve('stream-browserify'),
  crypto: require.resolve('crypto-browserify'),
  process: require.resolve('process'),
  buffer: require.resolve('buffer'),
  util: require.resolve('util/'),
  url: require.resolve('react-native-url-polyfill'),
  assert: require.resolve('assert'),
  events: require.resolve('events'),
  path: require.resolve('path-browserify'),
  // Add custom shims for Node.js modules that aren't needed in React Native
  http: require.resolve('./types/http-shim.js'), // Custom shim
  https: require.resolve('./types/http-shim.js'), // Using same shim
  net: require.resolve('react-native/Libraries/Blob/FileReader'), // Empty shim
  tls: require.resolve('react-native/Libraries/Blob/FileReader'), // Empty shim
  zlib: require.resolve('react-native/Libraries/Blob/FileReader'), // Empty shim
  fs: require.resolve('react-native/Libraries/Blob/FileReader'), // Empty shim
  dgram: require.resolve('react-native/Libraries/Blob/FileReader'), // Empty shim
  ws: require.resolve('./types/ws-shim.js'), // WebSocket shim
};

// Create the config with the resolver
const config = {
  ...defaultConfig,
  resolver: {
    ...defaultConfig.resolver,
    extraNodeModules: nodeModules,
  },
};

module.exports = config;
