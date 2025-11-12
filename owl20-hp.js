import OBR from "@owlbear-rodeo/sdk";
import he from 'he';
import "./style.css";

const renderHP = (request) =>{
    let  html = `<h3><span title="${he.encode(request.playerName)}" class=playerBubble style="background-color:${request.playerColor}"></span>${he.encode(request.character)}</h3> ${request.html}`;
  
    /*
    compromise for now, firure it out
    if (request.request) {
      html = `<h3><img src="${request.request.character.avatar}" class="playerAvatar"></span>${he.encode(request.character)}</h3> ${request.html}`;
    }*/


    console.log(request.request.character);

    const element = document.querySelector("#rolls-list");
    const node = document.createElement("div");
    node.innerHTML = html;
    element.appendChild(node); 
    window.scrollTo(0, document.body.scrollHeight);
}

const broadcastHP = async (request) => {
    // load sound every time because I want to play 5 at a time if someone 5-clicked.    
    request.playerColor = await OBR.player.getColor();
    request.playerName = await OBR.player.getName();

    OBR.broadcast.sendMessage("owl20.hp", request, {destination:"ALL"});
}

addEventListener("message", (event) => { 
  //broadcastRoll(event) 
  switch(event.data.type) {
    case 'Beyond20_Roll':
      console.log("owl20-owlbear: Broadcasting roll:", event.data.data);
      broadcastRoll(event.data.data);
      break;
    default:
      //Ignore unknown messages silently
  }
})

const themeManager  = async () => {
  const setTheme = (theme) => {
      console.log(theme)
      document.body.setAttribute('data-theme',theme.mode);
  }
  let theme = await OBR.theme.getTheme();
  setTheme(theme)
  OBR.theme.onChange((theme) => {
    setTheme(theme)
  })
}

OBR.onReady(() => {
  console.log("owl20-owlbear: OBR Ready")
  OBR.broadcast.onMessage("owl20.hp", (event) => {
      renderHP(event.data); 
  })
  themeManager()
})

window.OBR = OBR