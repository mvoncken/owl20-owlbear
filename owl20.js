import OBR from "@owlbear-rodeo/sdk";
import he from 'he';
import { handleInitiative, broadcastHP, checkBrokenSettings } from "./owl20-extras";
import DOMPurify from 'dompurify';
import { themeManager } from "./theme";
import { collapseBrRuns } from "./statblock";
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
