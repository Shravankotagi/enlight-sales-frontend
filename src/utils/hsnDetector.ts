/**
 * Steel Products HSN/SAC Code Auto-Detection Mapping:
 *
 * | Product | HSN Code |
 * |---|---|
 * | HR Coil / Hot Rolled Coil / HR Sheet | 72082700 |
 * | CR Coil / Cold Rolled Coil / CR Sheet / CRCA | 72092900 |
 * | MS Sheet / MS Plate / Mild Steel Sheet / Mild Steel Plate | 72083730 |
 * | MS Round Bar / Round Bar | 72141000 |
 * | MS Square Bar / Square Bar | 72142000 |
 * | MS Flat Bar / Flat Bar / MS Flat | 72149100 |
 * | TMT Bar / TMT Rebar / Reinforcement Bar | 72139190 |
 * | MS Angle / Angle Iron | 72162100 |
 * | MS Channel / Channel Section | 72163100 |
 * | MS Beam / Joist / I-Beam / H-Beam | 72163200 |
 * | MS Square Pipe / Square Hollow Section / SHS | 73063090 |
 * | MS Rectangular Pipe / Rectangular Hollow Section / RHS | 73063090 |
 * | MS Round Pipe / ERW Pipe / Seamless Pipe | 73061090 |
 * | GI Sheet / Galvanized Sheet / GI Coil / Galvanized Coil | 72104900 |
 * | Chequered Plate / Checkered Plate | 72085100 |
 * | Stainless Steel Sheet / SS Sheet / SS Coil | 72193390 |
 */

export function detectHsnCode(productName: string): string {
  if (!productName || typeof productName !== 'string') return '';
  const text = productName.toLowerCase().trim();
  if (!text) return '';

  // 1. Stainless Steel / SS Sheet / SS Coil
  if (/\bstainless\b|\bss\s*(?:sheet|coil|plate|pipe|bar|flat|round|angle|channel|304|316)?\b/i.test(text)) {
    return '72193390';
  }

  // 2. Galvanized / GI Sheet / GI Coil
  if (/\bgalvanized\b|\bgalvanised\b|\bgi\s*(?:sheet|coil|pipe|corrugated|plain)?\b|\bgp\s*sheet\b/i.test(text)) {
    return '72104900';
  }

  // 3. Chequered / Checkered Plate
  if (/\bchequered\b|\bcheckered\b|\bchequred\b/i.test(text)) {
    return '72085100';
  }

  // 4. Square Pipe / Rectangular Pipe / Hollow Sections
  if (
    /\bsquare\s*(?:pipe|tube|tubing|hollow)\b|\bshs\b|\brectangular\s*(?:pipe|tube|tubing|hollow)\b|\brhs\b|\bbox\s*(?:pipe|section)\b/i.test(
      text,
    )
  ) {
    return '73063090';
  }

  // 5. Round Pipe / ERW Pipe / Seamless Pipe
  if (
    /\bround\s*pipe\b|\berw\s*pipe\b|\berw\b|\bseamless\s*pipe\b|\bseamless\b|\bms\s*pipe\b|\bsteel\s*pipe\b|\bpipe\b|\btube\b/i.test(
      text,
    )
  ) {
    return '73061090';
  }

  // 6. MS Beam / Joist / I-Beam / H-Beam
  if (
    /\bi-beam\b|\bh-beam\b|\bbeam\b|\bjoist\b|\bismb\b|\bisnb\b|\bisjb\b|\biswb\b|\bnpb\b|\bwfb\b|\buc\s*column\b|\bub\s*beam\b/i.test(
      text,
    )
  ) {
    return '72163200';
  }

  // 7. MS Channel / Channel Section
  if (/\bchannel\b|\bismc\b|\bisjc\b|\bispc\b/i.test(text)) {
    return '72163100';
  }

  // 8. MS Angle / Angle Iron
  if (/\bangle\b|\bisa\b/i.test(text)) {
    return '72162100';
  }

  // 9. TMT Bar / TMT Rebar / Reinforcement Bar
  if (
    /\btmt\b|\brebar\b|\breinforcement\b|\bfe\s*500\b|\bfe\s*550\b|\bfe\s*500d\b|\btor\s*steel\b|\bthermex\b/i.test(
      text,
    )
  ) {
    return '72139190';
  }

  // 10. Flat Bar / MS Flat Bar / MS Flat
  if (/\bflat\s*bar\b|\bms\s*flat\s*bar\b|\bms\s*flat\b|\bflats\b|\bpatti\b|\bflat\b/i.test(text)) {
    return '72149100';
  }

  // 11. Square Bar / MS Square Bar
  if (/\bsquare\s*bar\b|\bms\s*square\s*bar\b|\bsq\s*bar\b|\bsquare\s*rod\b/i.test(text)) {
    return '72142000';
  }

  // 12. Round Bar / MS Round Bar
  if (/\bround\s*bar\b|\bms\s*round\s*bar\b|\bms\s*round\b|\bbright\s*bar\b|\bround\s*rod\b|\bwire\s*rod\b/i.test(text)) {
    return '72141000';
  }

  // 13. CR Coil / Cold Rolled Coil / CR Sheet / CRCA
  if (/\bcold\s*rolled\b|\bcrca\b|\bcr\s*coils?\b|\bcr\s*sheets?\b|\bcr\s*plates?\b|\bcr\b/i.test(text)) {
    return '72092900';
  }

  // 14. HR Coil / Hot Rolled Coil / HR Sheet
  if (/\bhot\s*rolled\b|\bhr\s*coils?\b|\bhr\s*sheets?\b|\bhr\s*plates?\b|\bhrpo\b|\bhr\b/i.test(text)) {
    return '72082700';
  }

  // 15. MS Sheet / MS Plate / Mild Steel Sheet / Mild Steel Plate
  if (
    /\bms\s*sheets?\b|\bms\s*plates?\b|\bmild\s*steel\s*sheets?\b|\bmild\s*steel\s*plates?\b|\bmild\s*steel\b|\bis\s*2062\b|\be250\b|\be350\b|\bplates?\b|\bsheets?\b|\bms\b/i.test(
      text,
    )
  ) {
    return '72083730';
  }

  return '';
}
