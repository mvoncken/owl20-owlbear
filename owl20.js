import OBR from "@owlbear-rodeo/sdk";
import { isImage } from "@owlbear-rodeo/sdk";
import he from 'he';
import { themeManager } from "./theme";
import "./style.css";

console.log("owl20-owlbear:version:", __VERSION__)

let prevChar = "prev"
const renderRoll = (roll) =>{
    let html = '';
    const char = `${roll.character}-${roll.playerName}`;
    // characters have a url, monsters have an avatar, have not seen any other rolls.
    const charUrl = roll.request?.character?.url || roll.request?.character?.avatar;
    // isFirst: only show the character/player header if it changes.
    const isFirst = (char !== prevChar);   
    if (isFirst) {
      html = `<h3 class="player"><span title="${he.encode(roll.playerName)}" class=playerBubble style="background-color:${roll.playerColor}"></span><a href="${charUrl}" target="_new">${he.encode(roll.character)}</a></h3>`
    }
    html += roll.html;
    const element = document.querySelector("#rolls-list");
    const node = document.createElement("div");
    node.className = isFirst ? "player-first" : "player-more"
    node.innerHTML = html;
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

const handleInitiative = async (roll) => {
  if (!roll.request?.type === 'initiative') return;
  // the text label on the token must match the rolled name
  const characters = await OBR.scene.items.getItems(
    (item) => item.layer === "CHARACTER" && isImage(item) && item.text.plainText === roll.character
  );
  const token = characters[0];
  if (!token) return;

  // The initiative value has to be calculated using request.advantage
  // 0 = default, 3=advantage, 4=disadvantage, 6=super adv
  // According to adv/dis rules pick the best from attack_rolls
  let initiativeRolls = roll.attack_rolls.map(r => r.total)
  if ((roll.request.advantage === 3) || (roll.request.advantage === 6))  {
    initiativeRolls = initiativeRolls.sort((a,b) => b.total - a.total); // desc
  } else if (roll.request.advantage === 4) {
    initiativeRolls = initiativeRolls.sort((a,b) => a.total - b.total); // asc
  }
  const topRoll = initiativeRolls[0];
  if (!topRoll) return;    
  
  // writing into metadata to be picked up by official initiative tracker
  const META_INIT = 'rodeo.owlbear.initiative-tracker/metadata'
  OBR.scene.items.updateItems([token],(items) => 
    items.forEach(
      item => item.metadata[META_INIT] = {count:topRoll.toString(), active:false}
  ))
  // Broadcast so other extensions can pick it up too.
  OBR.broadcast.sendMessage("owl20.initiative", {id:token.id, character:roll.character, roll:topRoll}, {destination:"LOCAL"});
}



const broadcastHP = async (payload) => {
    // Future
    // This broadast can be picked up by other extensions.
    payload.playerColor = await OBR.player.getColor();
    payload.playerName = await OBR.player.getName();

    OBR.broadcast.sendMessage("owl20.hp", payload, {destination:"ALL"});
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
    default:
      //Ignore unknown messages silently
  }
})

// Experimental: direct beyonds20 listener without owl20-chrome-plugin inbetween
// This requires that my patches to beyond20 are accepted.
function addBeyond20EventListener(name, callback) {
    const event = ["Beyond20_" + name, (evt) => {
        const detail = evt.detail || [];
        callback(...detail)
    }, false];
    document.addEventListener(...event);
    return event;
}

addBeyond20EventListener("Loaded", () => 
    document.querySelector("#loaded").innerText="Beyond20 connected ✅");

addBeyond20EventListener("RenderedRoll", (request) => {
      broadcastRoll(request);
      handleInitiative(request);
})
// debug
window.OBR = OBR
