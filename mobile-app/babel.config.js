module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // 1. Resolve path aliases first so files can be found cleanly
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./src",
            "@shared": "../shared",
          },
        },
      ],
      // 2. react-native-worklets/plugin must be listed LAST.
      // Required by react-native-reanimated v4.
      "react-native-worklets/plugin",
    ],
  };
};
