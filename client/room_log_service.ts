import _ from "lodash-es"
import { AxiosStatic, AxiosInstance } from "axios"

let latency_log: {
  url: string
  method?: string
  latency: number
  timestamp: number
}[] = []

export async function submitLatencyReport(
  axios: AxiosStatic | AxiosInstance | AxiosInstance,
  logs: { url: string; method?: string; latency: number; timestamp: number }[]
): Promise<void> {
  await axios.post("/latency_report", logs)
}

export function addLatencyLog(
  axios: AxiosStatic | AxiosInstance | AxiosInstance,
  d: {
    url: string
    method?: string
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
