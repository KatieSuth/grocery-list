// Jest resolver: React Native's (set by jest-expo), plus what Reanimated 4.7+ needs in Jest.
//
// Reanimated's mock loads its native-only initializers and fails unless a few of its files, and all
// of Worklets, resolve to their web builds. Reanimated ships `react-native-reanimated/jest/resolver`
// for that, but it decides by `basedir.includes('react-native-worklets')`. pnpm folder names list
// peer dependencies (`.pnpm/expo-modules-core@…_react-native-worklets@…/`), so that check also
// matches expo-modules-core and breaks every Expo native-module mock. This applies the same rules
// by the package that actually owns the importing file.
const path = require('path');

const reactNativeResolver = require(require('jest-expo/jest-preset').resolver);

// Mirrors WEB_ONLY_IN_JEST in react-native-reanimated/jest/resolver.js; recheck on Reanimated upgrades.
const REANIMATED_WEB_ONLY = new Set([
  'initializers',
  'mutables',
  'mappers',
  'ConfigHelper',
  'UpdateLayoutAnimations',
  'useAnimatedRef',
  'useAnimatedStyle',
  'WorkletEventHandler',
  'JSPropsUpdater',
  'updateProps',
  'util',
  'css/component/AnimatedComponent',
]);

/** The npm package a path belongs to: whatever follows its last `node_modules/`. */
function owningPackage(dir) {
  const parts = dir.split(path.sep);
  const i = parts.lastIndexOf('node_modules');
  if (i === -1) return null;
  return parts[i + 1]?.startsWith('@') ? `${parts[i + 1]}/${parts[i + 2]}` : parts[i + 1];
}

function requestedPackage(request) {
  if (request.startsWith('.') || path.isAbsolute(request)) return null;
  const parts = request.split('/');
  return request.startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
}

function isReanimatedWebOnly(request) {
  const basename = request.split('/').pop();
  return [...REANIMATED_WEB_ONLY].some((entry) =>
    entry.includes('/') ? request.endsWith(entry) : basename === entry
  );
}

/** @type {import('jest-resolve').SyncResolver} */
module.exports = (request, options) => {
  const owner = owningPackage(options.basedir);
  const useWebBuild =
    owner === 'react-native-worklets' ||
    requestedPackage(request) === 'react-native-worklets' ||
    (owner === 'react-native-reanimated' && request.startsWith('.') && isReanimatedWebOnly(request));
  if (!useWebBuild) return reactNativeResolver(request, options);
  return reactNativeResolver(request, {
    ...options,
    extensions: options.extensions?.filter((ext) => !ext.includes('native')),
  });
};
