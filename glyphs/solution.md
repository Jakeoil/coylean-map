## Coylean Map - Order 5

`.figure` `id=coylean-map`

## Order 6h

`id=coylean-map-6h`

## Order 6

id=coylean-map-6` This is also refered by`data-map=`

## Substitution Rule v-> h

`vh-sub-table`

## Substitution Rule h-> v

`hv-sub-table`

## Translateion Table

'.grid-wrapper'`translation-table`

# glyphs

rebuildGrids takes care of all of these

## Vertical Seniority grid

The grids have lots of problem.
They are numbered incorrectly
000,100,010,110,001,101,011,111
421,400,020,420,001,401,021,421

.glyph-grid #v-grid
buildGrid(tableId:"v-grid", prefix:"V", verticalWinsTies:"true)
| table = $(tableId)
    thead=$(thead)
headerRow=$"tr"
corner = $"th"
corner.className="corner"
Change the headers to reflect the colunms and the side headers for the rows.
d = 0; d < 8
r = 0; r < 8
` ft = GLYPH-LETTERS(d,r)
drawGlyph(d,r,ft)

for r 0..7

## equivalent classes

.eq-classes #v-eq-classes
buildEquivalenceClasses("v-eq-classes", "V", true, V_CLASSES);

## Horizontal Seniority grid

.glyph-grid #h-grid

## equivalent classes

.eq-classes #h-eq-classes
