const webpack = require("webpack")

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
      entry: "client/room.ts",
      template: "public/room.html",
      filename: "room.html",
      title: "Main Room Page",
      chunks: ["chunk-vendors", "chunk-common", "room"],
    },
    poster_list: {
      entry: "client/poster_list.ts",
      template: "public/poster_list.html",
      filename: "poster_list.html",
      title: "Poster List Page",
      chunks: ["chunk-vendors", "chunk-common", "poster_list"],
    },
    admin: {
      entry: "client/admin.ts",
      template: "public/admin.html",
      filename: "admin.html",
      title: "Admin Page",
      chunks: ["chunk-vendors", "chunk-common", "admin"],
    },
    loadtesting: {
      entry: "client/loadtesting.ts",
      template: "public/loadtesting.html",
      filename: "loadtesting.html",
      title: "Load testing by Vue",
      chunks: ["chunk-vendors", "chunk-common", "loadtesting"],
    },
    mypage: {
      entry: "client/mypage.ts",
      template: "public/mypage.html",
      filename: "mypage.html",
      title: "マイページ",
      chunks: ["chunk-vendors", "chunk-common", "mypage"],
    },
  },
  chainWebpack: config => {
    config.plugin("fork-ts-checker").tap(args => {
      args[0].memoryLimit = 4096
      return args
    })
  },
  configureWebpack: {
    plugins: [
      new webpack.IgnorePlugin(/^\.\/wordlists\/(?!english)/, /bip39\/src$/),
    ],
  },
  devServer: {
    proxy: {
      "^/api": {
        target: "http://localhost:3000",
        ws: true,
        secure: false,
      },
      "^/img": {
        target: "http://localhost:3000",
        ws: false,
        secure: false,
      },
    },
  },
}
