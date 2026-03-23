import OBR from "@owlbear-rodeo/sdk";
import { isImage } from "@owlbear-rodeo/sdk";
/*
Things thar are not core functionality but are nice to have.
*/

export const checkBrokenSettings = (settings) => {
  // initial version by Uberdragon.
  const warnings = [];

  if (!settings) return warnings;

  // Digital dice produce pre-rendered HTML without structured roll data;
  // owl20 receives the rendered result but the Owlbear extension may not be
  // able to parse dice details from it.
  if (settings['use-digital-dice'] === true) {
    warnings.push({
      id: 'digital-dice',
      message:
        'ℹ️ D&D Beyond Digital Dice is enabled. This is a frequent cause of issues.' +
        ' It\'s best to disable them, to avoid current or future problems.' 
    });
  }

  // Whispered rolls are not dispatched to VTTs via the DOM API, so they will
  // never reach owl20 / the Owlbear extension.
  if (settings['whisper-type'] !== undefined && settings['whisper-type'] !== '0' && settings['whisper-type'] !== 0) {
    warnings.push({
      id: 'whisper-rolls',
      message:
        'ℹ️ Beyond20 "Whisper Rolls to GM" is enabled, these will display with a ⓦ.'
      });
  }

  // When Discord integration is active Beyond20 may redirect output away
  // from the page, bypassing the DOM events that owl20 listens to.
  if (Array.isArray(settings['discord-channels']) && settings['discord-channels'].some(c => c.active === true)) {
    warnings.push({
      id: 'discord',
      message:
        '⚠️ Beyond20 Discord integration is enabled. Some roll events may be ' +
        'redirected to Discord instead of the page, and may not reach Owlbear Rodeo.'
    });
  }

  return warnings;
}

/*
handleInitiative
This depends on a token with exaclty the same name as the charatcter.ion. 
*/
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
