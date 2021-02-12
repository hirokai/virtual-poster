import {
  Cell,
  CellType,
  MapUpdateEntry,
  MinimapVisibility,
  ParsedMapData,
  UserGroup,
} from "@/@types/types"

import Papa from "papaparse"
import { flatten } from "./util"

export function getCellOpenFromString(s: string): boolean {
  if (!s) {
    return false
  }
  if (s[0] == "+") {
    return true
  } else if (s[0] == "-") {
    return false
  } else if (["grass", "poster_seat", "mud"].indexOf(s) != -1) {
    return true
  } else {
    return false
  }
}

export function getCellKindFromString(s: string): CellType | null {
  if (!s) {
    return null
  }
  if (s.match(/[+-]?grass$/)) {
    return "grass"
  } else if (s.match(/[+-]?wall$/)) {
    return "wall"
  } else if (s.match(/[+-]?poster$/)) {
    return "poster"
  } else if (s.match(/[+-]?mud$/)) {
    return "mud"
  } else if (s.match(/[+-]?poster_seat$/)) {
    return "poster_seat"
  } else if (s.match(/[+-]?water$/)) {
    return "water"
  } else {
    return null
  }
}

export function mkKindString(t: CellType, open: boolean): string {
  switch (t) {
    case "grass":
    case "mud":
    case "poster_seat":
      // Default is open
      return open ? t : "-" + t
    case "water":
    case "wall":
    case "poster":
      // Default is not open
      return open ? "+" + t : t
  }
}

export function loadCustomMapCsv(
  str: string,
  genMapCellId?: () => string
): ParsedMapData | null {
  let name: string | undefined = undefined
  let allow_poster_assignment: boolean | undefined = undefined
  let minimap_visibility: MinimapVisibility | undefined = undefined
  let dropArea:
    | { x1: number; y1: number; x2: number; y2: number }
    | undefined = undefined
  let userGroups:
    | { name: string; description?: string }[]
    | undefined = undefined
  let regions:
    | {
        name: string
        description?: string
        rect: { x1: number; y1: number; x2: number; y2: number }
      }[]
    | undefined = undefined
  let permissions:
    | {
        group_names: string[]
        region_names: string[]
        operation: "poster_paste" | "drop_area"
        allow: "allow" | "disallow"
      }[]
    | undefined = undefined
  type CsvSection =
    | "Config"
    | "Regions"
    | "UserGroups"
    | "Permissions"
    | "Cells"
    | "Layout"
  const data = Papa.parse<string[]>(str, { comments: "#" })
  if (!data.data) {
    return null
  }
  const cells: (Cell & { cell_type_id: string })[][] = []
  const cell_table: {
    [cell_name: string]: Cell & { cell_type_id: string }
  } = {}
  let default_cell: Cell & { cell_type_id: string } = {
    kind: "grass",
    open: true,
    id: "",
    x: -1,
    y: -1,
    cell_type_id: "__default__",
  }
  let yi = 0
  let section: CsvSection | undefined = undefined
  for (const row of data.data) {
    if (row.length == 1 && row[0] == "") {
      continue
    }
    if (
      [
        "Config",
        "Regions",
        "UserGroups",
        "Permissions",
        "Cells",
        "Layout",
      ].indexOf(row[0]) != -1
    ) {
      section = row[0] as CsvSection
      console.log("Entering section: ", section)
      if (section == "Layout") {
        yi = 0
      }
    } else {
      if (section == "Config") {
        if (row[0] == "Name") {
          name = row[1]
        } else if (row[0] == "AllowUserPoster") {
          allow_poster_assignment = row[1] == "true"
        } else if (row[0] == "MinimapVisibility") {
          minimap_visibility =
            row[1] == "AllInitial"
              ? "all_initial"
              : row[1] == "AllOnlyVisited"
              ? "all_only_visited"
              : undefined
        } else if (row[0] == "DropArea") {
          dropArea = {
            x1: parseInt(row[2]),
            y1: parseInt(row[3]),
            x2: parseInt(row[4]),
            y2: parseInt(row[5]),
          }
        }
      } else if (section == "UserGroups") {
        if (!userGroups) {
          userGroups = []
        }
        if (row[0]) {
          userGroups.push({
            name: row[0],
            description: row[1] || undefined,
          })
        }
      } else if (section == "Regions") {
        if (row[0]) {
          if (!regions) {
            regions = []
          }
          regions.push({
            name: row[0],
            description: row[1],
            rect: {
              x1: parseInt(row[2]),
              y1: parseInt(row[3]),
              x2: parseInt(row[4]),
              y2: parseInt(row[5]),
            },
          })
        }
      } else if (section == "Permissions") {
        if (row[0]) {
          if (!permissions) {
            permissions = []
          }
          permissions.push({
            group_names: row[0].split(";;"),
            region_names: row[1].split(";;"),
            operation: row[2] as "poster_paste" | "drop_area",
            allow: row[3] as "allow" | "disallow",
          })
        }
      } else if (section == "Cells") {
        const kind = getCellKindFromString(row[1]) || "grass"
        const open = getCellOpenFromString(row[1])
        const custom_image = row[2]
        if (row[0] == "__default__") {
          default_cell = {
            kind: getCellKindFromString(row[1]) || "grass",
            open: open == null ? true : open,
            id: "",
            x: -1,
            y: -1,
            cell_type_id: "__default__",
          }
          if (custom_image) {
            default_cell.custom_image = custom_image
          }
        } else {
          cell_table[row[0]] = {
            kind,
            open: open == null ? true : open,
            x: -1,
            y: -1,
            id: "",
            cell_type_id: row[0],
            link_url: row[3],
          }
          if (custom_image) {
            cell_table[row[0]].custom_image = custom_image
          }
        }
      } else if (section == "Layout") {
        cells.push(
          row.map((s, xi) => {
            const obj = cell_table[s]
              ? {
                  ...cell_table[s],
                  id: genMapCellId ? genMapCellId() : "",
                  x: xi,
                  y: yi,
                }
              : {
                  ...default_cell,
                  x: xi,
                  y: yi,
                  id: genMapCellId ? genMapCellId() : "",
                }
            if (dropArea) {
              if (
                dropArea.x1 <= obj.x &&
                dropArea.y1 <= obj.y &&
                obj.x <= dropArea.x2 &&
                obj.y <= dropArea.y2
              ) {
                obj.no_initial_position = false
              } else {
                obj.no_initial_position = true
              }
            }
            return obj
          })
        )
        yi += 1
      }
    }
  }
  const numRows = cells.length
  const numCols =
    cells.length == 0 ? 0 : Math.max(...cells.map(row => row.length))
  return {
    name,
    cells,
    numRows,
    numCols,
    numCells: flatten(cells).length,
    cell_table,
    allowPosterAssignment: allow_poster_assignment,
    minimapVisibility: minimap_visibility,
    userGroups,
    regions,
    permissions,
  }
}

export function verifyMapUpdateEntries(changes: any): MapUpdateEntry[] | null {
  if (typeof changes != "object" || !Array.isArray(changes)) {
    return null
  }
  const res: MapUpdateEntry[] = []
  for (const c of changes) {
    console.log(c)
    if (typeof c.x != "number") {
      return null
    }
    if (typeof c.y != "number") {
      return null
    }
    const open = getCellOpenFromString(c.kind)
    const d: MapUpdateEntry = {
      x: c.x,
      y: c.y,
      kind: getCellKindFromString(c.kind) || undefined,
      open: open == null ? true : open,
      //FIXME: Complete this.
    }
    res.push(d)
  }
  return res
}
