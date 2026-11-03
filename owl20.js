import OBR from "@owlbear-rodeo/sdk";
import he from 'he';
import { handleInitiative, broadcastHP, checkBrokenSettings } from "./owl20-extras";
import DOMPurify from 'dompurify';
import { themeManager } from "./theme";
import "./style.css";

console.log("owl20-owlbear:version:", __VERSION__)

// Rolling log in localStorage: one key per roll, MAX_HISTORY slots reused
// round-robin, plus a counter with the total number of rolls written.
const MAX_HISTORY = 100;
const historyPrefix = () => `owl20.history.${OBR.room.id}`;
const counterKey = () => `${historyPrefix()}.count`;
const slotKey = (n) => `${historyPrefix()}.${n % MAX_HISTORY}`;

const loadHistory = () => {
  const count = parseInt(localStorage.getItem(counterKey())) || 0;
  const rolls = [];
  for (let n = Math.max(0, count - MAX_HISTORY); n < count; n++) {
    try {
      const roll = JSON.parse(localStorage.getItem(slotKey(n)));
      if (roll) rolls.push(roll);
    } catch (e) {
      console.warn("owl20-owlbear: skipping broken history entry", n, e);
    }
  }
  return rolls;
}

const saveToHistory = (roll) => {
  // only keep what renderRoll needs, the full request can be large.
  const entry = JSON.stringify({
    whisper: roll.whisper,
    character: roll.character,
    playerName: roll.playerName,
    playerColor: roll.playerColor,
    charUrl: roll.charUrl,
    html: roll.html,
  });
  const count = parseInt(localStorage.getItem(counterKey())) || 0;
  try {
    localStorage.setItem(slotKey(count), entry);
    localStorage.setItem(counterKey(), count + 1);
  } catch (e) {
    console.warn("owl20-owlbear: could not save roll to history", e);
  }
}

let prevChar = "prev"
const renderRoll = async (roll, persist = true) =>{
    if (roll.whisper) {
      const playerName = await OBR.player.getName();
      const role = await OBR.player.getRole();
      // show if DM or same player, otherwise return
      if (role !== "GM" && roll.playerName !== playerName) {
        return;
      }  
    }

    let html = '';
    const char = `${roll.whisper}${roll.character}-${roll.playerName}`;
    // characters have a url, monsters have an avatar, have not seen any other rolls.
    const charUrl = roll.charUrl || roll.request?.character?.url || roll.request?.character?.avatar;
    // isFirst: only show the character/player header if it changes.
    const isFirst = (char !== prevChar);   
    if (isFirst) {
      html = `<h3 class="player"><span title="${he.encode(roll.playerName)}" class=playerBubble style="background-color:${roll.playerColor}"></span><a href="${charUrl}" target="_blank" rel="noopener noreferrer">${roll.whisper ? 'ⓦ ' : ''}${he.encode(roll.character)}</a></h3>`
    }
    html += roll.html;
    const element = document.querySelector("#rolls-list");
    const node = document.createElement("div");
    node.className = isFirst ? "player-first" : "player-more"
    node.innerHTML = DOMPurify.sanitize(html, {ADD_ATTR: ["target"]});
    element.appendChild(node); 
    window.scrollTo(0, document.body.scrollHeight);
    prevChar = char;
    if (persist) saveToHistory({...roll, charUrl});
}

// Beyond20 flattens stat blocks with <br><br><br> between every line, collapse those runs.
// Then wrap the STR..CHA lines (label<br>score<br>, six times) in a grid row: .owl20-abilities
const BR = '<br\\s*/?>';
const ABILITIES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];
const ABILITY_ROW_RE = new RegExp(ABILITIES.map(a => `\\b(${a})${BR}((?:(?!${BR})[\\s\\S])*)`).join(BR) + `(?:${BR})?`, 'i');
const ABILITY_ROW_START = '<div class="owl20-abilities">';

// Below the ability row, one line per stat/trait/action; give them structure:
// "Actions" -> section header, "Chilling Rend. ..." -> bold-italic name, "Armor Class ..." -> bold label.
const SECTION_RE = /^(?:Traits|Actions|Bonus Actions|Reactions|Legendary Actions|Mythic Actions|Lair Actions)$/i;
const TRAIT_RE = /^[A-Z][\w'’-]*(?: (?:[A-Z0-9][\w'’\/-]*|of|the|and|or|from|to|a|an|in|on|with))*(?: \([^()<]{1,30}\))?\.(?=\s)/;
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
  // Armor Class / Hit Points / Speed come right above the ability row: bold their labels too.
  const head = html.slice(0, start).split(new RegExp(BR, 'i'));
  for (let i = head.length - 1; i >= 0; i--) {
    if (!head[i].trim()) continue;
    const stat = head[i].match(STAT_RE);
    if (!stat) break;
    head[i] = `<b>${stat[0]}</b>${head[i].slice(stat[0].length)}`;
  }
  return head.join('<br>') + html.slice(start, tailStart) + tail + html.slice(tailEnd);
}

const collapseBrRuns = (html) => html && formatStatblock(html
  .replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br>')
  .replace(ABILITY_ROW_RE, (...m) => ABILITY_ROW_START +
    ABILITIES.map((_, i) => `<div><b>${m[1 + i * 2]}</b><span>${m[2 + i * 2]}</span></div>`).join('') + '</div>'));

const broadcastRoll = async (roll) => {
    roll.html = collapseBrRuns(roll.html);
    // load sound every time because I want to play 3 at a time if someone 3-clicked.
    const sound = new Audio('dice-89594.mp3');
    sound.load();
    sound.play();      
    roll.playerColor = await OBR.player.getColor();
    roll.playerName = await OBR.player.getName();

    console.log("broadcastRoll", roll)
    if (typeof roll.character  !== 'string') {
      // Is sometimes an empty object instead of null:
      // https://discord.com/channels/@me/1383472368621719654/1445786752819265737
      // fallback tot title, fallback to '*'
      roll.character = roll.playerName;
    }
    OBR.broadcast.sendMessage("owl20.roll", roll, {destination:"ALL"});
    OBR.broadcast.sendMessage("com.friendlymimic.mimic-chat/html", {
      origin: "com.friendlymimic.owl20",
      title: roll.character,
      gmOnly: !!roll.whisper,
      html: roll.html,
    }, {destination:"ALL"});
}


OBR.onReady(async () => {
  console.log("owl20-owlbear: OBR Ready")
  for (const roll of loadHistory()) {
    await renderRoll(roll, false);
  }
  OBR.broadcast.onMessage("owl20.roll", (event) => {
      renderRoll(event.data); 
  })
  themeManager()

})


const handleLoaded = (settings) => {
  document.querySelector("#loaded").style.display = "block";
  document.querySelector("#not-loaded").style.display = "none";
  handleSettings(settings);
}

const handleSettings = (settings) => {
  console.log("owl20-owlbear: Beyond20 settings updated", settings);
  const el = document.querySelector("#broken-settings");
  const warnings = checkBrokenSettings(settings);
  el.innerHTML = warnings.map(({message}) => `<li>${DOMPurify.sanitize(message)}</li>`).join('');
}

// Listen to owl20-chrome-plugin events
addEventListener("message", (event) => { 
  switch(event.data.type) {
    case 'Beyond20_Roll':
      broadcastRoll(event.data.data);
      handleInitiative(event.data.data);
      break;
    case 'Beyond20_UpdateHP':
      broadcastHP(event.data.data);
      break;    
    case 'Beyond20_Loaded':
      handleLoaded(event.data.data)
      break;    
    case 'Beyond20_NewSettings':
      handleSettings(event.data.data)
      break;
    case 'Beyond20_UpdateHP':
      broadcastHP(event.data.data);
      break;      
    default:
      //Ignore unknown messages silently
  }
})

// Experimental: direct beyonds20 listener without owl20-chrome-plugin inbetween
// This requires that my patches to beyond20 are accepted, and that is not easy.
function addBeyond20EventListener(name, callback) {
    const event = ["Beyond20_" + name, (evt) => {
        const detail = evt.detail || [];
        callback(...detail)
    }, false];
    document.addEventListener(...event);
    return event;
}

addBeyond20EventListener("RenderedRoll", (request) => {
      broadcastRoll(request);
      handleInitiative(request);
})
// debug
window.OBR = OBR
