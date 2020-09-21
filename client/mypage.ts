import { createApp } from "vue"
import MyPage from "./MyPage.vue"

createApp({
  render: h => h(MyPage),
}).mount("#app")
