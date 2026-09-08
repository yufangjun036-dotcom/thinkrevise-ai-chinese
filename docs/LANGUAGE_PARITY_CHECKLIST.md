# Chinese/English parity checklist

The validated Chinese version is the source of truth. The English version must change user-visible language only; it must not become a separate product with different behaviour.

## Allowed differences

- User-interface copy and placeholders
- Page title, description, and document language metadata
- AI explanation language and translated demo-feedback copy
- English image alternative text and captions

## Required invariants

- Same routes, component hierarchy, styles, spacing, and responsive breakpoints
- Same two entrances and five-stage learning loop
- Same three help-mode identifiers (`coach`, `model`, and `rewrite`) and disclosure rules
- Same topic identifiers, vocabulary words, levels, and draw counts
- Same input limits, original-draft protection, feedback decisions, and reflection gates
- Same API schema, model setting, `store: false`, and fallback behaviour
- Same optional image path, dimensions, and source record
- Same WebMCP tool name, input schema, and visible state changes

## Verification before release

1. Run the complete build, learning-data, request-boundary, and three-mode tests in both versions.
2. Compare all files outside the approved language and metadata files.
3. Complete the same manual practice and revision journeys in both versions.
4. Check the same desktop and mobile widths.
5. Test both public links in a signed-out private browser window.
