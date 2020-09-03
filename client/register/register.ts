import Vue from "vue"
import Register from "./Register.vue"
import VueCompositionApi from "@vue/composition-api"

Vue.config.productionTip = false
Vue.use(VueCompositionApi)

new Vue({
  render: h => h(Register),
}).$mount("#app")
