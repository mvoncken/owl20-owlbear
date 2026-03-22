import OBR from "@owlbear-rodeo/sdk";
import { isImage } from "@owlbear-rodeo/sdk";

export const handleInitiative = async (roll) => {
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


export const broadcastHP = async (payload) => {
    // Future
    // This broadast can be picked up by other extensions.
    payload.playerColor = await OBR.player.getColor();
    payload.playerName = await OBR.player.getName();

    OBR.broadcast.sendMessage("owl20.hp", payload, {destination:"ALL"});
}
