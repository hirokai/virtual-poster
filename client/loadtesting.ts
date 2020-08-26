import Vue from "vue"
import App from "./LoadTesting.vue"

console.log("Loadtesting starting")

Vue.config.productionTip = false

new App().$mount("#app") as App
