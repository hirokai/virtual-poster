const webpack = require("webpack")

const BundleAnalyzerPlugin = require("webpack-bundle-analyzer")
  .BundleAnalyzerPlugin
const path = require("path")

module.exports = {
  pages: {
    login: {
      entry: "client/login.ts",
      template: "public/login.html",
      filename: "login.html",
      title: "Login Page",
      chunks: ["chunk-vendors", "chunk-common", "login"],
    },
    register: {
      entry: "client/register/register.ts",
      template: "public/register.html",
      filename: "register.html",
      title: "ユーザー登録",
      chunks: ["chunk-vendors", "chunk-common", "register"],
    },
    index: {
      entry: "client/index.ts",
      template: "public/index.html",
      filename: "index.html",
      title: "ホーム - バーチャルポスター",
      chunks: ["chunk-vendors", "chunk-common", "index"],
    },
    room: {
      entry: "client/room/room.ts",
      template: "public/room.html",
      filename: "room.html",
      title: "Main Room Page",
      chunks: ["chunk-vendors", "chunk-common", "room"],
    },
    create_room: {
      entry: "client/create_room.ts",
      template: "public/create_room.html",
      filename: "create_room.html",
      title: "Create room",
      chunks: ["chunk-vendors", "chunk-common", "create_room"],
    },
    poster_list: {
      entry: "client/poster_list.ts",
      template: "public/poster_list.html",
      filename: "poster_list.html",
      title: "Poster List Page",
      chunks: ["chunk-vendors", "chunk-common", "poster_list"],
    },
    admin: {
      entry: "client/admin/admin.ts",
      template: "public/admin.html",
      filename: "admin.html",
      title: "Admin Page",
      chunks: ["chunk-vendors", "chunk-common", "admin"],
    },
    mypage: {
      entry: "client/mypage/mypage.ts",
      template: "public/mypage.html",
      filename: "mypage.html",
      title: "マイページ",
      chunks: ["chunk-vendors", "chunk-common", "mypage"],
    },
  },
  configureWebpack: {
    plugins: [
      new webpack.IgnorePlugin(/^\.\/wordlists\/(?!english)/, /bip39\/src$/),
    ].concat(
      process.env.ANALYZE_BUNDLE
        ? new BundleAnalyzerPlugin({
            analyzerMode: "static",
            reportFilename: path.join(__dirname, "./stats_app.html"),
            defaultSizes: "gzip",
            openAnalyzer: false,
            generateStatsFile: true,
            statsFilename: path.join(__dirname, "./stats_app.json"),
            statsOptions: null,
            logLevel: "info",
          })
        : []
    ),
    resolve: {
      alias: {
        // "@/*": "./*",
        "@": path.resolve(__dirname),
      },
    },
    externals: ["dtrace-provider"],
  },
  devServer: {
    proxy: {
      "^/api": {
        target: "http://localhost:3000",
        ws: true,
        secure: false,
      },
      // "^/ws": {
      //   target: "http://localhost:5000",
      //   ws: true,
      //   secure: false,
      // },
      "^/socket.io": {
        target: "http://localhost:5000",
        ws: true,
        secure: false,
      },
      "^/img": {
        target: "http://localhost:3000",
        ws: false,
        secure: false,
      },
      "^/firebaseConfig.json": {
        target: "http://localhost:3000",
        ws: false,
        secure: false,
      },
    },
    // headers: { "Cache-Control": "no-store" },
  },
}
