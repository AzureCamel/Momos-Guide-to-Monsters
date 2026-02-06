/**
 * Monster Knowledge Check Module
 * Adds a token control button for players to make knowledge checks about monsters
 */

import { registerSettings } from "./settings.mjs";
import { MonsterKnowledgeDialog, addToBestiary } from "./knowledge-check-dialog.mjs";

const MODULE_ID = "momos-guide-to-monsters";

/* -------------------------------------------- */
/*  Initialization                              */
/* -------------------------------------------- */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Momo's Guide to Monsters`);
  registerSettings();
});

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Momo's Guide to Monsters ready`);
});

/* -------------------------------------------- */
/*  Token Controls                              */
/* -------------------------------------------- */

Hooks.on("getSceneControlButtons", (controls) => {
  const tokenControls = controls.tokens;
  if (!tokenControls) {
    console.warn(`${MODULE_ID} | Could not find token controls`);
    return;
  }

  tokenControls.tools.monsterKnowledge = {
    name: "monsterKnowledge",
    title: "MKC.TokenControl.Title",
    icon: "fas fa-book-skull",
    order: Object.keys(tokenControls.tools).length,
    button: true,
    visible: true,
    onChange: () => onMonsterKnowledgeClick()
  };
});

/* -------------------------------------------- */
/*  Chat Message Button Handler                 */
/* -------------------------------------------- */

Hooks.on("renderChatMessage", (message, html, data) => {
  // Check if this is our module's message
  const flags = message.flags[MODULE_ID];
  if (!flags) return;
  
  // Find the bestiary button container
  const container = html.find ? html.find(".mkc-bestiary-button-container") : html.querySelector(".mkc-bestiary-button-container");
  const containerEl = container?.jquery ? container[0] : container;
  
  if (!containerEl) return;
  
  // Only show the button for GMs
  if (game.user.isGM) {
    containerEl.style.display = "";
    
    // Find and setup the button
    const btn = containerEl.querySelector(".mkc-add-to-bestiary");
    if (btn) {
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        
        if (!flags.knowledge) {
          ui.notifications.error(game.i18n.localize("MKC.Errors.NoKnowledgeData"));
          return;
        }
        
        await addToBestiary(flags.monsterId, flags.knowledge);
      });
    }
  }
});

/* -------------------------------------------- */
/*  Click Handler                               */
/* -------------------------------------------- */

async function onMonsterKnowledgeClick() {
  const targets = game.user.targets;
  
  if (targets.size === 0) {
    ui.notifications.warn(game.i18n.localize("MKC.Warnings.NoTokenTargeted"));
    return;
  }
  
  if (targets.size > 1) {
    ui.notifications.warn(game.i18n.localize("MKC.Warnings.MultipleTokensTargeted"));
    return;
  }

  const token = targets.first();
  const actor = token.actor;

  if (!actor) {
    ui.notifications.warn(game.i18n.localize("MKC.Warnings.NoActorOnToken"));
    return;
  }

  if (actor.type !== "npc") {
    ui.notifications.warn(game.i18n.localize("MKC.Warnings.NotAnNPC"));
    return;
  }

  // Get all available player characters
  const availableCharacters = getAvailableCharacters();
  if (availableCharacters.length === 0) {
    ui.notifications.warn(game.i18n.localize("MKC.Warnings.NoPlayerCharacter"));
    return;
  }

  // Get the default character (user's assigned character or first available)
  const defaultCharacter = game.user.character || availableCharacters[0];

  const dialog = new MonsterKnowledgeDialog({
    monster: actor,
    availableCharacters: availableCharacters,
    defaultCharacterId: defaultCharacter.id
  });
  dialog.render({ force: true });
}

/* -------------------------------------------- */
/*  Helper Functions                            */
/* -------------------------------------------- */

/**
 * Get all player characters available to the current user
 * For GMs, this returns all player characters
 * For players, this returns characters they own
 * @returns {Actor5e[]}
 */
function getAvailableCharacters() {
  if (game.user.isGM) {
    // GMs can use any player character
    return game.actors.filter(a => a.type === "character");
  } else {
    // Players can only use characters they own
    return game.actors.filter(a => a.type === "character" && a.isOwner);
  }
}

/* -------------------------------------------- */
/*  Exports                                     */
/* -------------------------------------------- */

export { MODULE_ID };
