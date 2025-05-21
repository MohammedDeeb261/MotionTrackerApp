// Import URL polyfill first
import "react-native-url-polyfill/auto";

// Explicitly require and polyfill what we need
const process = require("process");
const Buffer = require("buffer").Buffer;

// Make these available globally
global.process = process;
global.Buffer = Buffer;

// Import and set up other required polyfills
global.crypto = global.crypto || require("crypto-browserify");
global.stream = require("stream-browserify");
global.util = require("util/");
global.path = require("path-browserify");
global.assert = require("assert");
global.events = require("events");

// Mock problematic Node.js modules
// These empty shims prevent errors when modules try to use Node.js native modules
global.http = require("../types/http-shim.js");
global.https = require("../types/http-shim.js");
global.net = {};
global.tls = {};
global.fs = {
  promises: {},
  readFileSync: () => "",
  existsSync: () => false
};

// Also mock WebSocket related functionality
global.WebSocket = global.WebSocket || require("../types/ws-shim.js");

// Set navigator.product for React Native detection
if (typeof global.navigator === "object") {
  global.navigator.product = "ReactNative";
} else {
  global.navigator = { product: "ReactNative" };
}

// TextEncoder/TextDecoder from text-encoding package
const TextEncodingPolyfill = require("text-encoding");
if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncodingPolyfill.TextEncoder;
  global.TextDecoder = TextEncodingPolyfill.TextDecoder;
}
