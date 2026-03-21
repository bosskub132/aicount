# OCR Line-Item Parser

## Location
`src/lib/services/ocr.ts` → inside `extractFromGoogleVisionText()`

## Algorithm: Classify-Then-Extract
1. **Tag every line**: barcode, header, number, product_code, product_name, stop, skip
2. **Detect columns** from all header lines combined (qty, price, discount, amount, taxtype)
3. **Collect descriptions** from entire text (coded items or consecutive product name blocks)
4. **Collect numbers** after LAST header line (strips V/N tax flags first)
5. **Block-style zip** — infer colsPerRow from nums/descriptions ratio, detect tax flag columns
6. **Sequential fallback** — row# interleaved with desc + numbers
7. **Hybrid merge** — picks up trailing interleaved items after block section

## Critical Patterns
```
stripTaxFlag:          "199.00 V" → "199.00"
barcodePattern:        /^0?\d{12,13}$/
productCodePrefix:     /^(?:[VN]\s+)?(?:[\d]{4,}[\s|@]|CP\d+[_])/
productSizePattern:    /\d+\s*(?:กรัม|กก|ml|ML|g|G|L|ลิตร|มล|...)\b/
```

## Tax Flag Column Detection
If every value at the last column position is ≤2 and integer → it's a tax type flag, not data.
`effectiveCols = colsPerRow - taxFlagCols`

## Verified Receipt Formats
- Watsons (block, coded items with @$ decorations)
- Thai Watsadu/CRC (sequential, row#, V/N prefix, discount column)
- The Mall/Emporium (name-block, no codes, tax flag column)
- CP Extra/Lotus's (hybrid block + interleaved, CP_ prefixes, V suffix on numbers)

## Adding New Formats
1. Get raw_text_excerpt from Raw OCR JSON panel
2. Trace line classifications
3. Usually just update classification patterns (productCodePrefix, productSizePattern, headerKeywords, stopPattern)
4. If truly novel layout, add new step between 6 and 7
