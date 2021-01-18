import { Cell, CellType } from "@/@types/types"

import Papa from "papaparse"
import { flatten } from "./util"

export function getCellOpenFromString(s: string): boolean {
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
): {
  name?: string
  cells: (Cell & { cell_type_id: string })[][]
  numRows: number
  numCols: number
  numCells: number
  cell_table: { [cell_name: string]: { custom_image?: string; kind: CellType } }
  allowPosterAssignment?: boolean
} | null {
  let name: string | undefined = undefined
  let allow_poster_assignment: boolean | undefined = undefined
  let dropArea:
    | { x1: number; y1: number; x2: number; y2: number }
    | undefined = undefined
  type CsvSection = "Config" | "Cells" | "Layout"
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
    if (["Config", "Cells", "Layout"].indexOf(row[0]) != -1) {
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
        } else if (row[0] == "DropArea") {
          dropArea = {
            x1: parseInt(row[1]),
            y1: parseInt(row[2]),
            x2: parseInt(row[3]),
            y2: parseInt(row[4]),
          }
        }
      } else if (section == "Cells") {
        const kind = getCellKindFromString(row[1]) || "grass"
        const open = getCellOpenFromString(row[1])
        const custom_image = row[2]
        if (row[0] == "__default__") {
          default_cell = {
            kind: getCellKindFromString(row[1]) || "grass",
            open,
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
            open,
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
  }
}
