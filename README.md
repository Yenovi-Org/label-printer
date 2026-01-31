# Label Printer

> :warning: `label-printer` is still under heavy development and is subject to frequent API changes

This package provides a js based implementation for variouse languages used for label printers

## Layers

The packages is logacally divided into multiple sub layers. These are not separate modules per say, but separated parts of the code that serve different purposes

### 1. Command Layer

This layer provides a low lever wrapper for the different languages commands. Using this module, you can create commands that suite your needs the best or you can integrate this pacakge in your codebase

#### TODO

- Finish implementing basic commands
- Add example code

### 2. Label layer

This layer provides a language independent API to construct a label (object representation) without any knowledge of the fine details of the printer the label will be printed on.

#### TODO

- Add example code
- Implement layer

### 3. Printer layer

This layer contains code to interact with printers

#### TODO

- Add example code
- Implement layer

## Documentation of supported languages

- [TSPL](documentations/TSPL.pdf)

## Label fields

### Table

The `Table` field draws a grid and places text into each cell. It uses the existing `Text` field for cell contents and the existing `Line` field for the grid lines.

```ts
import { Label } from "label-printer/dist/labels"
import { Table } from "label-printer/dist/labels/fields"

const label = new Label(50, 25)

const table = new Table(10, 10, [
  ["A1", "A2"],
  ["B1", "B2"],
], {
  size: { width: 200, height: 100 },
  columnWidths: [80, 120],
  rowHeights: [40, 60],
  lineThickness: 2,
  cellPadding: 4,
  formatted: false,
  font: { name: "default", size: 10 },
})

label.add(table)
```

Sizing rules:

- **If `size.width`/`size.height` are set**
  - Any unspecified row/column sizes share the remaining space equally.
  - Cell text is constrained to the cell content box and will wrap to multiple lines. If a row height is fixed, the text may be clipped once it reaches the height limit.
- **If table size is not set**
  - Unspecified row/column sizes are measured from their content.

# Usefull units:

- 1 pt = 1/72 inch
- 1 dot = 1 / dpi

# Notes

- If a font is not working, make sure the extension is TTF
- If you want to use bold fonts, make sure you have one for weight 700
- Regular font weight is 400

# Update package

- Run `pnpm changeset` to create change. This change has to be merged into main first
- Run `pnpm changeset version` to create an update with all the versions. 
- PR is automatically created on push, merge it to trigger publish