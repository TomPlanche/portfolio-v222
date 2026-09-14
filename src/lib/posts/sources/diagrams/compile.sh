#!/bin/bash

# Compiles every .d2 file under src/lib/posts/sources/diagrams into an SVG next to it, then copies each SVG into static/diagrams so it is servable, dark mauve theme by default, background softened with BG_OPACITY (matches BG_COLOR to the theme's actual background hex if you change THEME).
# Each .d2 file declares its own layout engine via a `vars.d2-config.layout-engine` block, since a D2_LAYOUT env var here would override every file's own choice.
# Usage: ./compile.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATIC_DIAGRAMS_DIR="$(cd "$SCRIPT_DIR/../../../../../static/diagrams" && pwd)"

THEME="${THEME:-200}"
BG_COLOR="${BG_COLOR:-#1E1E2E}"
BG_OPACITY="${BG_OPACITY:-0.2}"

D2_FILES=$(find "$SCRIPT_DIR" -name "*.d2" -type f)

if [ -z "$D2_FILES" ]; then
  echo "No .d2 files found under $SCRIPT_DIR"
  exit 0
fi

echo "Compiling .d2 files under $SCRIPT_DIR with theme=$THEME (layout picked per file)..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

while IFS= read -r INPUT_FILE; do
  OUTPUT_FILE="${INPUT_FILE%.d2}.svg"
  RELATIVE_DIR="$(dirname "${INPUT_FILE#"$SCRIPT_DIR"/}")"
  FILENAME=$(basename "$INPUT_FILE")

  echo "Compiling $RELATIVE_DIR/$FILENAME..."

  if d2 -t "$THEME" "$INPUT_FILE" "$OUTPUT_FILE"; then
    sed -i.bak "s/fill=\"$BG_COLOR\"/fill=\"$BG_COLOR\" fill-opacity=\"$BG_OPACITY\"/g" "$OUTPUT_FILE"
    rm -f "${OUTPUT_FILE}.bak"

    DEST_DIR="$STATIC_DIAGRAMS_DIR/$RELATIVE_DIR"
    mkdir -p "$DEST_DIR"
    cp "$OUTPUT_FILE" "$DEST_DIR/"
    echo "  OK: copied to static/diagrams/$RELATIVE_DIR/$(basename "$OUTPUT_FILE")"
    ((SUCCESS_COUNT++))
  else
    echo "  FAILED: $FILENAME"
    ((FAIL_COUNT++))
  fi
  echo ""
done <<<"$D2_FILES"

echo "========================================="
echo "Compilation complete: $SUCCESS_COUNT succeeded, $FAIL_COUNT failed"
echo "========================================="

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 1
fi
