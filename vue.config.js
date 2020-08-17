module.exports = {
  pages: {
    login: {
      entry: "src/pages/login.ts",
      template: "public/login.html",
      filename: "login.html",
      title: "Login Page",
      chunks: ["chunk-vendors", "chunk-common", "login"],
    },
    index: {
      entry: "src/pages/index.ts",
      template: "public/index.html",
      filename: "index.html",
      title: "ホーム - バーチャルポスター",
      chunks: ["chunk-vendors", "chunk-common", "index"],
    },
    room: {
      entry: "src/pages/room.ts",
      template: "public/room.html",
      filename: "room.html",
      title: "Main Room Page",
      chunks: ["chunk-vendors", "chunk-common", "room"],
    },
    poster_list: {
      entry: "src/pages/poster_list.ts",
      template: "public/poster_list.html",
      filename: "poster_list.html",
      title: "Poster List Page",
      chunks: ["chunk-vendors", "chunk-common", "poster_list"],
    },
    admin: {
      entry: "src/pages/admin.ts",
      template: "public/admin.html",
      filename: "admin.html",
      title: "Admin Page",
      chunks: ["chunk-vendors", "chunk-common", "admin"],
    },
    loadtesting: {
      entry: "src/pages/loadtesting.ts",
      template: "public/loadtesting.html",
      filename: "loadtesting.html",
      title: "Load testing by Vue",
      chunks: ["chunk-vendors", "chunk-common", "loadtesting"],
    },
    mypage: {
      entry: "src/pages/mypage.ts",
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
  devServer: {
    proxy: {
      "^/api": {
        target: "http://localhost:3000",
        ws: true,
        secure: false,
      },
    },
  },
}
