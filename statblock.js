// Beyond20 flattens stat blocks with <br><br><br> between every line, collapse those runs.
// Then wrap the STR..CHA lines (label<br>score<br>, six times) in a grid row: .owl20-abilities
// Beyond20 writes </br>; browsers read that as <br>, so accept both.
const BR = '</?br\\s*/?>';
const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const ABILITY_ROW_RE = new RegExp(ABILITIES.map(a => `\\b(${a})${BR}((?:(?!${BR})[\\s\\S])*)`).join(BR) + `(?:${BR})?`, 'i');
const ABILITY_ROW_START = '<div class="owl20-abilities">';

// Below the ability row, one line per stat/trait/action; give them structure:
// "Actions" -> section header, "Chilling Rend. ..." -> bold-italic name, "Armor Class ..." -> bold label.
const SECTION_RE = /^(?:Traits|Actions|Bonus Actions|Reactions|Legendary Actions|Mythic Actions|Lair Actions)$/i;
const TRAIT_RE = /^[A-Z][\w'’-]*(?: (?:[A-Z0-9][\w'’\/-]*|of|the|and|or|from|to|a|an|in|on|with))*(?: \([^()<]{1,30}\))?\.(?=\s)/;
const SIZE_RE = /^(?:Tiny|Small|Medium|Large|Huge|Gargantuan)\b.{0,60}$/;
const STAT_RE = /^(?:Armor Class|Hit Points|Speed|Saving Throws|Skills|Damage Vulnerabilities|Damage Resistances|Damage Immunities|Condition Immunities|Senses|Languages|Challenge|Proficiency Bonus)\b/;

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

const formatStatblock = (html) => {
  const start = html.indexOf(ABILITY_ROW_START);
  if (start === -1) return html;
  const tailStart = html.indexOf('</div></div>', start) + '</div></div>'.length;
  // the description div holds no other divs, so its first </div> ends the stat block.
  const tailEnd = html.indexOf('</div>', tailStart);
  if (tailEnd === -1) return html;
  const tail = html.slice(tailStart, tailEnd).split(new RegExp(BR, 'i')).map(formatStatLine).join('');
  // Above the ability row: [name, "Medium monstrosity",] Armor Class / Hit Points / Speed.
  // The stat block may follow spell text (e.g. Summon Shadowspawn), so set it apart from that.
  const head = html.slice(0, start).split(new RegExp(BR, 'i'));
  let i = head.length;
  while (i > 0 && (!head[i - 1].trim() || STAT_RE.test(head[i - 1].trim()))) i--;
  let block = head.slice(i).map(formatStatLine).join('');
  if (i > 0 && SIZE_RE.test(head[i - 1].trim())) {
    block = `<div class="owl20-type">${head[--i].trim()}</div>` + block;
    // the name line may still carry the description's opening tag when the stat block comes first
    const line = head[i - 1] ?? '';
    const tags = line.trimEnd().endsWith('>') ? '' : line.slice(0, line.lastIndexOf('>') + 1);
    const name = line.slice(tags.length);
    if (name.trim() && !/[.<>]/.test(name.trim())) {
      block = `${tags}<div class="owl20-name">${name.trim()}</div>` + block;
      i--;
    }
  }
  while (i > 0 && !head[i - 1].trim()) i--; // drop blank lines between the spell text and the block
  const before = head.slice(0, i).join('<br>');
  return before + block + html.slice(start, tailStart) + tail + html.slice(tailEnd);
}

export const collapseBrRuns = (html) => html && formatStatblock(html
  .replace(/(?:<\/?br\s*\/?>\s*){3,}/gi, '<br>')
  .replace(ABILITY_ROW_RE, (...m) => ABILITY_ROW_START +
    ABILITIES.map((_, i) => `<div><b>${m[1 + i * 2]}</b><span>${m[2 + i * 2]}</span></div>`).join('') + '</div>'));
