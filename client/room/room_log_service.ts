import { HttpMethod } from "@/@types/types"
import { AxiosStatic, AxiosInstance } from "axios"
import axiosClient from "@aspida/axios"
import api from "@/api/$api"

let latency_log: {
  url: string
  method?: HttpMethod
  latency: number
  timestamp: number
}[] = []

export async function submitLatencyReport(
  axios: AxiosStatic | AxiosInstance | AxiosInstance,
  logs: {
    url: string
    method?: HttpMethod
    latency: number
    timestamp: number
  }[]
): Promise<void> {
  const client = api(axiosClient(axios))
  await client.latency_report.$post({ body: logs })
}

export function addLatencyLog(
  axios: AxiosStatic | AxiosInstance | AxiosInstance,
  d: {
    url: string
    method?: HttpMethod
    latency: number
    timestamp: number
  }
): void {
  latency_log.push(d)
  if (
    latency_log.length >= 50 ||
    (latency_log.length > 0 &&
      Date.now() - latency_log[latency_log.length - 1].timestamp >=
        1000 * 60 * 5)
  ) {
    submitLatencyReport(axios, latency_log)
      .then(() => {
        console.log(
          "Latency log (used for server health diagnostics) sent to server"
        )
        latency_log = []
      })
      .catch(err => {
        console.error(err)
      })
  }
}
