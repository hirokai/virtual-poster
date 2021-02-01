import { createApp } from "vue"
import Register from "./Register.vue"
import axiosDefault from "axios"

axiosDefault
  .get("/api/firebaseConfig.json")
  .then(({ data }) => {
    const propsData = {
      firebaseConfig: data,
    }
    createApp(Register, propsData).mount("#app")
  })
  .catch(err => {
    console.error("Failed to load Firebase config file", err)
  })
