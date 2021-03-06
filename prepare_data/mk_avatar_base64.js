const fs = require("fs")

const res = {}

for (const a of "001,001a,001b,002,002a,002b,003,003a,003b,004,004a,004b,005,005a,005b,006,006a,006b,007,007a,007b,008,008a,008b,009,009a,009b,010,010a,010b,011,011a,011b,012,012a,012b,013,013a,013b,014,014a,014b,015,015a,015b,016,016a,016b,017,017a,017b,017c,018,018a,018b,018c,018d,018e,018f,018g,019,019a,019b,019c,019d,019e,020,021,021a,021b,021c,021d,021e,022,022a,022b,022c,022d,022e,023,023a,023b,023c,023d,023e,024,024a,024b,024c,024d,024e,025,025a,025b,025c,025d,025e,026,026a,026b,026c,026d,026e,027,027a,027b,027c,027d,027e,028,028a,028b,028c,028d,028e,029,029a,029b,029c,029d,029e,030,030a,030b,030c,030d,030e".split(
  ","
)) {
  for (const d of ["down", "up", "left", "right"]) {
    const key = a + "-" + d
    const in_path = "./public/img/avatar/" + key + ".png"
    // const out_path =  "/img/avatar/" + key + ".png"
    dat = fs.readFileSync(in_path)
    const image = dat.toString("base64")
    res[key] = image
  }
}

fs.writeFileSync("./public/img/avatars_base64.json", JSON.stringify(res))
