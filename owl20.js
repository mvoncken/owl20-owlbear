import OBR from "@owlbear-rodeo/sdk";

const sound = new Audio('dice-89594.mp3');

const renderRoll = (html) =>{
    const element = document.querySelector("#rolls-list");
    const node = document.createElement("div");
    node.innerHTML = html;
    element.appendChild(node); 
    window.scrollTo(0, document.body.scrollHeight);
}

const broadcastRoll = (request) =>{
    sound.load();
    sound.play();      
    const html = `<h3>${request.character}</h3> ${request.html}`;
    OBR.broadcast.sendMessage("owl20.roll", html, {destination:"ALL"});
}

addEventListener("message", (event) => { 
  //broadcastRoll(event) 
  switch(event.data.type) {
    case 'Beyond20_Roll':
      console.log("Broadcasting roll:", event.data.data);
      broadcastRoll(event.data.data);
      break;
    default:
      console.log("OWL20-owlbear extension recieved unknown message:", event);
  }
})

OBR.onReady(() => {
  console.log("OBR Ready")
  OBR.broadcast.onMessage("owl20.roll", (event) => {
      renderRoll(event.data); 
  })
})

window.OBR = OBR