import fs from "fs"
import yaml from "js-yaml"
import { Config, Convert } from "./parse_config"

let _config: Config
try {
  console.log(process.argv)
  const in_path = process.env.NODE_TEST
    ? "./app_config.test.yaml"
    : "./app_config.yaml"
  const doc = yaml.safeLoad(fs.readFileSync(in_path, "utf8"))
  const json = JSON.stringify(doc)
  _config = Convert.toConfig(json)
} catch (err) {
  console.error("Config file fail to read: app_config.yaml")
  console.log(err)
  process.exit(0)
}

export const config = _config
