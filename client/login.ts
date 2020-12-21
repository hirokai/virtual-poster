import { createApp } from "vue"
import Login from "./Login.vue"
import axiosDefault from "axios"

axiosDefault
  .get("/firebaseConfig.json")
  .then(({ data }) => {
    const propsData = {
      firebaseConfig: data,
    }
    createApp(Login, propsData).mount("#app")
  })
  .catch(err => {
    console.error("Failed to load Firebase config file")
  })
