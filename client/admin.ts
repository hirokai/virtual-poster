import Vue from "vue"
import Admin from "./Admin.vue"

Vue.config.productionTip = false
new Vue({
  render: h => h(Admin),
}).$mount("#app")
