import Vue from "vue"
import MyPage from "./MyPage.vue"

Vue.config.productionTip = false

new Vue({
  render: h => h(MyPage),
}).$mount("#app")
