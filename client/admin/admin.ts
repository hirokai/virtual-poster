import axios from "axios"
import { createApp } from "vue"
import Admin from "./Admin.vue"

import io from "socket.io-client"
const API_ROOT = "/api"
axios.defaults.baseURL = API_ROOT
import axiosClient from "@aspida/axios"
import api from "@/api/$api"

const client = api(axiosClient(axios))

client.socket_url
  .$get()
  .then(data => {
    if (!data.socket_url) {
      console.error("Socket URL was not obtained. Aborting.")
      return
    }
    const socket = io(data.socket_url, {
      path: "/socket.io",
      transports: ["websocket"],
    })
    createApp(Admin, {
      socket,
    }).mount("#app")
  })
  .catch(err => {
    console.error(err)
  })
