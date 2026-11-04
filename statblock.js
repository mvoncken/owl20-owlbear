// Beyond20 sends spell/item descriptions as text with <br>s, stat blocks with <br><br><br> between every line.
// Collapse those runs, then wrap the STR..CHA lines (label<br>score<br>, six times) in a grid row: .owl20-abilities
// Beyond20 writes </br>; browsers read that as <br>, so accept both.
const BR = '</?br\\s*/?>';
const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const ABILITY_ROW_RE = new RegExp(ABILITIES.map(a => `\\b(${a})${BR}((?:(?!${BR})[\\s\\S])*)`).join(BR) + `(?:${BR})?`, 'i');
const ABILITY_ROW_START = '<div class="owl20-abilities">';
// 2024 stat blocks: "Mod<br>Save" header (before STR and INT), then name, score, mod, save per ability.
const LINE = `((?:(?!${BR})[\\s\\S])*)`;
const ABILITY_2024_RE = new RegExp(ABILITIES.map(a => `(?:Mod${BR}Save${BR})?\\b(${a})${BR}${LINE}${BR}${LINE}${BR}${LINE}`).join(BR) + `(?:${BR})?`, 'i');
const abilityTable2024 = (m) => {
  const col = (i, k) => m[1 + i * 4 + k];
  const row = (label, k) => `<div>${label}</div>` + ABILITIES.map((_, i) => `<div>${col(i, k)}</div>`).join('');
  return '<div class="owl20-abilities owl20-abilities-2024">' +
    row('', 0) + row('', 1) + row('Mod', 2) + row('Save', 3) + '</div>';
}

// Below the ability row, one line per stat/trait/action; give them structure:
// "Actions" -> section header, "Chilling Rend. ..." -> bold-italic name, "Armor Class ..." -> bold label.
const SECTION_RE = /^(?:Traits|Actions|Bonus Actions|Reactions|Legendary Actions|Mythic Actions|Lair Actions)$/i;
const TRAIT_RE = /^[A-Z][\w'’-]*(?: (?:[A-Z0-9][\w'’\/-]*|of|the|and|or|from|to|a|an|in|on|with))*(?: \([^()<]{1,30}\))?\.(?=\s)/;
const SIZE_RE = /^(?:Tiny|Small|Medium|Large|Huge|Gargantuan)\b.{0,60}$/;
const STAT_RE = /^(?:Armor Class|Hit Points|AC|HP|Initiative|Speed|Immunities|Resistances|Vulnerabilities|Gear|CR|Saving Throws|Skills|Damage Vulnerabilities|Damage Resistances|Damage Immunities|Condition Immunities|Senses|Languages|Challenge|Proficiency Bonus)\b/;

const formatStatLine = (line) => {
  const t = line.trim();
  if (!t) return '';
  if (SECTION_RE.test(t)) return `<div class="owl20-section">${t}</div>`;
  const trait = t.match(TRAIT_RE);
  if (trait) return `<div class="owl20-trait"><b><i>${trait[0]}</i></b>${t.slice(trait[0].length)}</div>`;
  const stat = t.match(STAT_RE);
  if (stat) return `<div class="owl20-stat"><b>${stat[0]}</b>${t.slice(stat[0].length)}</div>`;
  return `<div>${t}</div>`;
}

// Spell text: one paragraph per line, "Overgrowth. ..." / "<b>At Higher Levels.</b>" lead-ins in bold italic.
const formatProse = (lines) => lines.map(l => l.trim()).filter(Boolean).map(t => {
  const bold = t.match(/^<b>([^<]{1,60}\.)<\/b>/);
  if (bold) return `<p class="owl20-p"><b><i>${bold[1]}</i></b>${t.slice(bold[0].length)}</p>`;
  const lead = t.match(TRAIT_RE);
  if (lead) return `<p class="owl20-p"><b><i>${lead[0]}</i></b>${t.slice(lead[0].length)}</p>`;
  return `<p class="owl20-p">${t}</p>`;
}).join('');

const formatDescription = (body) => {
  const brRe = new RegExp(BR, 'i');
  body = body
    .replace(/(?:<\/?br\s*\/?>\s*){3,}/gi, '<br>')
    .replace(ABILITY_2024_RE, (...m) => abilityTable2024(m))
    .replace(ABILITY_ROW_RE, (...m) => ABILITY_ROW_START +
      ABILITIES.map((_, i) => `<div><b>${m[1 + i * 2]}</b><span>${m[2 + i * 2]}</span></div>`).join('') + '</div>');
  const start = body.indexOf('<div class="owl20-abilities');
  if (start === -1) return formatProse(body.split(brRe));
  const tailStart = body.indexOf('</div></div>', start) + '</div></div>'.length;
  // Below the ability row: stats, traits, sections.
  const tail = body.slice(tailStart).split(brRe).map(formatStatLine).join('');
  // Above the ability row: [spell text,] [name, "Medium monstrosity",] Armor Class / Hit Points / Speed.
  const head = body.slice(0, start).split(brRe);
  let i = head.length;
  while (i > 0 && (!head[i - 1].trim() || STAT_RE.test(head[i - 1].trim()))) i--;
  let block = head.slice(i).map(formatStatLine).join('');
  if (i > 0 && SIZE_RE.test(head[i - 1].trim())) {
    block = `<div class="owl20-type">${head[--i].trim()}</div>` + block;
    const name = (head[i - 1] ?? '').trim();
    if (name && !/[.<>]/.test(name)) {
      block = `<div class="owl20-name">${name}</div>` + block;
      i--;
    }
  }
  return formatProse(head.slice(0, i)) + block + body.slice(start, tailStart) + tail;
}

// Only the description is reformatted; it holds no divs, so its first </div> ends it.
const DESCRIPTION_RE = /<div class=(['"])beyond20-description\1>/i;
export const collapseBrRuns = (html) => {
  const m = html?.match(DESCRIPTION_RE);
  if (!m) return html;
  const bodyStart = m.index + m[0].length;
  const bodyEnd = html.indexOf('</div>', bodyStart);
  if (bodyEnd === -1) return html;
  return html.slice(0, bodyStart) + formatDescription(html.slice(bodyStart, bodyEnd)) + html.slice(bodyEnd);
}
