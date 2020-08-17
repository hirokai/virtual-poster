import Vue from "vue"
import Login from "./Login.vue"
import VueCompositionApi from "@vue/composition-api"

Vue.config.productionTip = false
Vue.use(VueCompositionApi)

new Vue({
  render: h => h(Login),
}).$mount("#app")
