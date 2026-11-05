export { default as Command } from "./Command"
export { default as CommandGroup } from "./CommandGroup"

export type PrinterLanguage = "tspl" | "zpl"
export type UnitSystem = "imperial"|"metric"|"dot"

export * as tspl from "./tspl"
export * as zpl from "./zpl"
export * from "./types"