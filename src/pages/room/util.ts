export const CommonMixin = {
  formatTime(timestamp: number): string {
    const t = new Date(timestamp)
    const now = new Date()
    const is_today =
      t.getFullYear() == now.getFullYear() &&
      t.getMonth() == now.getMonth() &&
      t.getDate() == now.getDate()
    return (
      (!is_today ? "" + (t.getMonth() + 1) + "/" + t.getDate() + " " : "") +
      t.getHours().toString() +
      ":" +
      t
        .getMinutes()
        .toString()
        .padStart(2, "0") +
      ":" +
      t
        .getSeconds()
        .toString()
        .padStart(2, "0")
    )
  },
  truncateComment(c: string): string {
    if (c.length <= 100) {
      return c
    } else {
      return c.slice(0, 80) + "..."
    }
  },
}
