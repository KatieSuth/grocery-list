// Needed for Jest on SDK 57: jest-expo doesn't apply Expo's Babel preset automatically.
module.exports = function (api) {
  api.cache(true);
  return { presets: ['babel-preset-expo'] };
};
