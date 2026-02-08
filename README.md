# Label Printer

> :warning: `label-printer` is still under heavy development and is subject to frequent API changes

This package provides a TypeScript/JavaScript API to:

- **Build labels** in a printer-language-independent way
- **Generate printer commands** (currently TSPL focused)
- **Find and talk to printers**
  - **Browser**: via WebUSB
  - **Node.js**: via USB and **automatic network discovery** (TCP/9100)

## Installation

```bash
npm install label-printer
```

## Main exports

The library exposes three main areas:

- **Commands**: `import { Command } from "label-printer"`
- **Labels**: `import { Label } from "label-printer"`
- **Printers**: `import { PrinterService } from "label-printer"`

## Runtime support (Browser vs Node)

### Browser

- Uses **WebUSB** to communicate with USB label printers.
- Typical entry point: `PrinterService.requestPrinter()`.

### Node.js

- Supports USB printing (where supported by the `usb` dependency).
- Supports **network printing over TCP** (raw printing, usually port `9100`).
- Supports **automatic network discovery**:
  - First attempts Bonjour/mDNS discovery of printer-related services
  - If Bonjour yields no candidates, falls back to a conservative private-subnet scan
  - Every discovered candidate is **verified** by sending the TSPL identify command (`~!I`)

## Printer layer

### Discover printers

```ts
import { PrinterService } from "label-printer"

const printers = await PrinterService.getPrinters()
if(printers.length === 0) {
  throw new Error("No printers found")
}

const printer = printers[0]
```

### Request a printer (browser-focused)

```ts
import { PrinterService } from "label-printer"

const printer = await PrinterService.requestPrinter()
if(!printer) throw new Error("No printer selected")
```

### Print or display a label

```ts
import { Label } from "label-printer"

const label = new Label(50, 25)
// 1 label, 3mm gap
await printer.print(label, 1, 3)
// or
await printer.display(label)

await printer.close()
```

### Connect directly (bypass discovery)

If you already know how to reach your printer (network address or USB identifiers), you can create a printer instance directly.

Auto-detect language (recommended default):

```ts
import { PrinterService } from "label-printer"

const printer = await PrinterService.connect({ network: { host: "192.168.100.31" } })
if(!printer) throw new Error("Printer not found or not supported")
```

Explicit TSPL (when you know it's a TSPL printer):

```ts
import { PrinterService } from "label-printer"

const printer = await PrinterService.connectTSPL({ network: { host: "192.168.100.31", port: 9100 } })
if(!printer) throw new Error("Not a TSPL printer")
```

USB (Node.js - filter without a prompt):

```ts
import { PrinterService } from "label-printer"

const printer = await PrinterService.connect({
  usb: { vendorId: 0x1234, productId: 0x5678, serialNumber: "ABC" }
})
if(!printer) throw new Error("Printer not found or not supported")
```

USB (Browser - shows a picker; you can optionally filter by `vendorId` / `productId`):

```ts
import { PrinterService } from "label-printer"

const printer = await PrinterService.connect({
  usb: { vendorId: 0x1234, productId: 0x5678 }
})
if(!printer) throw new Error("No printer selected")
```

## Device abstraction

Commands write to a transport-agnostic `Device` interface. This enables the same printer and label APIs to work over different transports.

- **USB** device implementation is internal to `USBUtils`.
- **Network** support uses a TCP implementation in Node.js.

## Label layer

The label layer provides a language-independent way to construct labels, which can then be rendered to commands for the chosen printer language.

```ts
import { Label } from "label-printer"

const label = new Label(50, 25)
// label.add(...fields)
```

## Supported languages

- [TSPL](documentations/TSPL.pdf)

## Fields

Fields live under `label-printer/dist/labels/fields` in the built output.

### Text

Create a text field at (`x`, `y`) in **dots**.

```ts
import { Label } from "label-printer/dist/labels"
import { Text } from "label-printer/dist/labels/fields"

const label = new Label(50, 25)

const text = new Text("Hello", 20, 20, true)
text.setSingleLine(200)

label.add(text)
```

Text wrapping/clipping:

- `text.setSingleLine(width?)`
- `text.setMultiLine(width, height?)`

Formatted text (when `formatted = true`) supports basic tags:

- `<b>...</b>`: bold (uses weight `700`)
- `<i>...</i>`: italic
- `<u>...</u>`: underline
- `<s>...</s>`: strike

### Line

Draw a line between two points (values in **dots**).

```ts
import { Line } from "label-printer/dist/labels/fields"

label.add(new Line({ x: 10, y: 10 }, { x: 300, y: 10 }, 3))
```

### Image

Draw a black/white bitmap image. You can either provide a bitmap-like object directly,
or use the async helper to load/convert an image.

```ts
import { Image } from "label-printer/dist/labels/fields"

const img = await Image.create("./logo.png", 10, 60, 200)
label.add(img)
```

### BarCode

Draw a barcode (TSPL-backed). Values are in **dots**.

```ts
import { BarCode } from "label-printer/dist/labels/fields"

const barcode = new BarCode("123456789", 20, 120, "CODE128", 80)
barcode.setHumanReadable("bottom")
barcode.setRotation(0)

label.add(barcode)
```

### QRCode

Draw a QR code.

```ts
import { QRCode } from "label-printer/dist/labels/fields"

label.add(new QRCode("https://example.com", 20, 220, 6))
```

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

## Command layer

The command layer is the lowest level and represents printer-language-specific commands.

Most users will not need this directly. It is primarily used internally by `Label` to generate
print/display command sequences.

## Public API summary

- **`Label`**
  - Construct labels and add fields
  - Generate language-specific print/display commands via printer layer
- **`PrinterService`**
  - `getPrinters()`
    - Browser: discovers accessible USB printers
    - Node: discovers USB printers + network printers (Bonjour/mDNS, then subnet scan fallback)
  - `requestPrinter()`
    - Browser: prompts user for a USB device
    - Node: selects first available USB device (may return `undefined`)
- **`Printer`**
  - `print(label, sets, gap, copiesPerSet?, direction?, mirror?, gapOffset?)`
  - `display(label, direction?, mirror?)`
  - `close()`

## Notes

### Useful units

- 1 pt = 1/72 inch
- 1 dot = 1 / dpi

### Fonts

There are two ways to use fonts:

1. Use printer built-in fonts (by using `name: "default"`)
2. Register and use custom fonts on a per-`Label` basis

#### Set a font on `Text` / `Table`

Fonts are configured using a `FontOption`:

```ts
text.setFont({ name: "default", size: 10 })
// or
text.setFont({ name: "MyFont", size: 18, weight: 700, style: "normal" })
```

- `size` is specified in **dots**.
- `weight` defaults to `400`.
- `style` defaults to `"normal"`.

#### Register a custom font on a `Label`

Registering fonts enables better text measurement (for wrapping) and ensures the font is uploaded
as part of the generated print/display command sequence.

```ts
import { Label } from "label-printer/dist/labels"

const label = new Label(50, 25)

await label.registerFont({
  name: "MyFont",
  data: await (await fetch("/fonts/MyFont-Regular.ttf")).arrayBuffer(),
  weight: 400,
  style: "normal",
})

await label.registerFont({
  name: "MyFont",
  data: await (await fetch("/fonts/MyFont-Bold.ttf")).arrayBuffer(),
  weight: 700,
  style: "normal",
})
```

Font notes:

- If a font is not working, make sure the extension is **TTF**.
- If you want bold text, register a `weight: 700` variant.
- When using formatted text (`<b>...</b>`), the library will request `weight: 700`.

# Update package

- Make changes on feature branch.
- Run `pnpm changeset` on feature branch to create change.
- Merge feature branch into main.
- Run `pnpm changeset version` on main to create an update with all the versions. 
- PR is automatically created on push, merge it to trigger publish
- Note: If there are unpublished changes on main and the release fails, it will be run again on the next push to main, no need to start again from the first step