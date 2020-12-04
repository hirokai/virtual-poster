const colors10 = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf",
]

export const abstractColorOfAvatar = (avatar: string) => {
  const n = parseInt(avatar)
  if (!isNaN(n)) {
    return colors10[n % 10]
  }
  if (avatar == "010") {
    return "white"
  }
  if (avatar == "018") {
    return "gray"
  }
  if (avatar == "019") {
    return "darkgray"
  }
  if (avatar == "021") {
    return "#d2b48c"
  }
  return "green"
}
