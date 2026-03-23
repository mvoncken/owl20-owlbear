import OBR from "@owlbear-rodeo/sdk";
import he from 'he';
import { handleInitiative, broadcastHP, checkBrokenSettings } from "./owl20-extras";
import DOMPurify from 'dompurify';
import { themeManager } from "./theme";
import "./style.css";

console.log("owl20-owlbear:version:", __VERSION__)

let prevChar = "prev"
const renderRoll = async (roll) =>{
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
    const charUrl = roll.request?.character?.url || roll.request?.character?.avatar;
    // isFirst: only show the character/player header if it changes.
    const isFirst = (char !== prevChar);   
    if (isFirst) {
      html = `<h3 class="player"><span title="${he.encode(roll.playerName)}" class=playerBubble style="background-color:${roll.playerColor}"></span><a href="${charUrl}" target="_new">${roll.whisper ? 'ⓦ ' : ''}${he.encode(roll.character)}</a></h3>`
    }
    html += roll.html;
    const element = document.querySelector("#rolls-list");
    const node = document.createElement("div");
    node.className = isFirst ? "player-first" : "player-more"
    node.innerHTML = DOMPurify.sanitize(html);
    element.appendChild(node); 
    window.scrollTo(0, document.body.scrollHeight);
    prevChar = char;
}

const broadcastRoll = async (roll) => {
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
}


OBR.onReady(async () => {
  console.log("owl20-owlbear: OBR Ready")
  OBR.broadcast.onMessage("owl20.roll", (event) => {
      renderRoll(event.data); 
  })
  themeManager()
  // sa-event : slug is unique enough, but non identifyable unless you're in the game.
  const players = (await OBR.party.getPlayers()).length + 1;
  window.sa_event("room",{ slug: OBR.room.id.substring(0,4), players });

  setTimeout(async ()=>{
      // 60 minutes+ is a session, and will catch num players more correctly since half don't have tracking.
      const pl = (await OBR.party.getPlayers()).length + 1;
      window.sa_event("t60",{ slug: OBR.room.id.substring(0,4), players:pl });
  }, 1000*60*60);
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
