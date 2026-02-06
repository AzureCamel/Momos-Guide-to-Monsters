/**
 * Monster Knowledge Check Dialog
 * Uses Foundry VTT v13 ApplicationV2 API with tier-based knowledge system
 */

import { getSetting, getTierInfo, getAllTierConfig, INFO_TYPES } from "./settings.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const MODULE_ID = "momos-guide-to-monsters";

/**
 * Dialog for configuring and rolling monster knowledge checks
 * @extends ApplicationV2
 */
export class MonsterKnowledgeDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    super(options);
    this.monster = options.monster;
    this.availableCharacters = options.availableCharacters || [];
    this.selectedCharacterId = options.defaultCharacterId || this.availableCharacters[0]?.id;
  }

  /* -------------------------------------------- */
  /*  Static Properties                           */
  /* -------------------------------------------- */

  static DEFAULT_OPTIONS = {
    id: "monster-knowledge-check-dialog",
    classes: ["dnd5e2", "monster-knowledge-check"],
    tag: "form",
    window: {
      title: "MKC.Dialog.Title",
      icon: "fas fa-book-skull",
      contentClasses: ["standard-form"],
      minimizable: false,
      resizable: false
    },
    position: {
      width: 400,
      height: "auto"
    },
    form: {
      submitOnChange: false,
      closeOnSubmit: true
    }
  };

  /* -------------------------------------------- */

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/knowledge-check-dialog.hbs`
    },
    footer: {
      template: `modules/${MODULE_ID}/templates/dialog-footer.hbs`
    }
  };

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  monster;
  availableCharacters;
  selectedCharacterId;

  /**
   * Get the currently selected player actor
   * @returns {Actor5e}
   */
  get player() {
    return game.actors.get(this.selectedCharacterId);
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  get title() {
    return game.i18n.format("MKC.Dialog.TitleWithMonster", { 
      name: this.monster.name 
    });
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const tierConfig = getAllTierConfig();
    
    const dcs = {
      tier1: getSetting("dcTier1"),
      tier2: getSetting("dcTier2"),
      tier3: getSetting("dcTier3"),
      tier4: getSetting("dcTier4")
    };
    
    // Include tier5 only if configured
    const tier5Configured = tierConfig.tier5 && tierConfig.tier5.dc && tierConfig.tier5.info.length > 0;
    if (tier5Configured) {
      dcs.tier5 = tierConfig.tier5.dc;
    }

    // Build character list for dropdown
    const characters = this.availableCharacters.map(char => ({
      id: char.id,
      name: char.name,
      selected: char.id === this.selectedCharacterId
    }));

    // Get skills for currently selected character
    const skills = this._getKnowledgeSkills();

    context.monster = this.monster;
    context.player = this.player;
    context.characters = characters;
    context.skills = skills;
    context.dcs = dcs;
    context.tier5Configured = tier5Configured;
    context.selectedSkill = skills[0]?.id || "arc";

    return context;
  }

  /* -------------------------------------------- */

  _getKnowledgeSkills() {
    const knowledgeSkillIds = ["arc", "his", "nat", "rel"];
    const skills = [];

    for (const skillId of knowledgeSkillIds) {
      const skill = this.player.system.skills[skillId];
      const skillConfig = CONFIG.DND5E.skills[skillId];
      
      if (skill && skillConfig) {
        skills.push({
          id: skillId,
          label: skillConfig.label,
          modifier: skill.total,
          modifierDisplay: (skill.total >= 0 ? "+" : "") + skill.total
        });
      }
    }

    return skills;
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    
    // Add change listener for character dropdown
    const characterSelect = this.element.querySelector('select[name="character"]');
    if (characterSelect) {
      characterSelect.addEventListener("change", (event) => {
        this.selectedCharacterId = event.target.value;
        this.render({ force: true });
      });
    }
  }

  async _onSubmitForm(formConfig, event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormDataExtended(form);
    const data = formData.object;
    
    // Update selected character from form
    if (data.character) {
      this.selectedCharacterId = data.character;
    }
    
    const skill = data.skill;
    const advantage = data.advantage || false;
    const dcModifier = parseInt(data.dcModifier) || 0;
    const autopass = data.autopass || "";

    await this._performKnowledgeCheck(skill, advantage, dcModifier, autopass);
  }

  /* -------------------------------------------- */

  async _performKnowledgeCheck(skillId, advantage, dcModifier, autopass) {
    const skill = this.player.system.skills[skillId];
    const skillConfig = CONFIG.DND5E.skills[skillId];

    // Get tier config with DC modifier applied
    const tierConfig = getAllTierConfig();
    const dcs = {
      tier1: tierConfig.tier1.dc + dcModifier,
      tier2: tierConfig.tier2.dc + dcModifier,
      tier3: tierConfig.tier3.dc + dcModifier,
      tier4: tierConfig.tier4.dc + dcModifier
    };
    
    // Only include tier5 if it's configured
    if (tierConfig.tier5 && tierConfig.tier5.dc && tierConfig.tier5.info.length > 0) {
      dcs.tier5 = tierConfig.tier5.dc + dcModifier;
    }

    let roll = null;
    let effectiveTotal = 0;
    let isAutopass = false;

    if (autopass) {
      isAutopass = true;
      effectiveTotal = dcs[autopass];
    } else {
      let rollFormula = advantage ? "2d20kh" : "1d20";
      rollFormula += ` + ${skill.total}`;
      
      roll = new Roll(rollFormula, this.player.getRollData());
      await roll.evaluate();
      effectiveTotal = roll.total;
    }

    // Determine what tiers were unlocked
    const unlockedTiers = this._determineUnlockedTiers(effectiveTotal, dcs);
    
    // Gather knowledge based on unlocked tiers
    const knowledge = this._gatherKnowledge(unlockedTiers, tierConfig);

    // Send to chat
    await this._sendResultToChat(roll, skillId, skillConfig, knowledge, dcs, advantage, dcModifier, isAutopass, autopass);
  }

  /* -------------------------------------------- */

  _determineUnlockedTiers(rollTotal, dcs) {
    const unlocked = {};
    const tierOrder = ["tier1", "tier2", "tier3", "tier4", "tier5"];
    
    for (const tier of tierOrder) {
      if (dcs[tier]) {
        unlocked[tier] = rollTotal >= dcs[tier];
      }
    }
    
    return unlocked;
  }

  /* -------------------------------------------- */

  _gatherKnowledge(unlockedTiers, tierConfig) {
    const knowledge = {
      tiers: [],
      hasAny: false
    };

    const tierLabels = {
      tier1: { label: game.i18n.localize("MKC.Tier.I"), icon: "fas fa-star", level: 1 },
      tier2: { label: game.i18n.localize("MKC.Tier.II"), icon: "fas fa-star", level: 2 },
      tier3: { label: game.i18n.localize("MKC.Tier.III"), icon: "fas fa-star", level: 3 },
      tier4: { label: game.i18n.localize("MKC.Tier.IV"), icon: "fas fa-crown", level: 4 },
      tier5: { label: game.i18n.localize("MKC.Tier.V"), icon: "fas fa-gem", level: 5 }
    };

    for (const [tierId, unlocked] of Object.entries(unlockedTiers)) {
      if (unlocked && tierConfig[tierId]) {
        const infoTypes = tierConfig[tierId].info;
        if (!infoTypes || infoTypes.length === 0) continue;
        
        knowledge.hasAny = true;
        const tierData = {
          id: tierId,
          ...tierLabels[tierId],
          unlocked: true,
          info: []
        };

        for (const infoType of infoTypes) {
          const info = this._getInfoByType(infoType);
          if (info) {
            // Handle array returns (like resistances which returns multiple items)
            if (Array.isArray(info)) {
              tierData.info.push(...info);
            } else {
              tierData.info.push(info);
            }
          }
        }

        if (tierData.info.length > 0) {
          knowledge.tiers.push(tierData);
        }
      }
    }

    return knowledge;
  }

  /* -------------------------------------------- */

  _getInfoByType(infoType) {
    const system = this.monster.system;
    
    switch (infoType) {
      case "resistances":
        return this._getResistancesInfo();
      case "conditionImmunities":
        return this._getConditionImmunitiesInfo();
      case "highestStat":
        return this._getHighestStatInfo();
      case "lowestStat":
        return this._getLowestStatInfo();
      case "ac":
        return {
          label: game.i18n.localize("MKC.InfoType.AC"),
          value: system.attributes.ac?.value ?? "—"
        };
      case "hp":
        return {
          label: game.i18n.localize("MKC.InfoType.HP"),
          value: system.attributes.hp?.max ?? "—",
          formula: system.attributes.hp?.formula || null
        };
      case "speed":
        return {
          label: game.i18n.localize("MKC.InfoType.Speed"),
          value: this._formatSpeed()
        };
      case "senses":
        return {
          label: game.i18n.localize("MKC.InfoType.Senses"),
          value: this._formatSenses()
        };
      case "languages":
        return {
          label: game.i18n.localize("MKC.InfoType.Languages"),
          value: this._formatLanguages()
        };
      case "cr":
        return {
          label: game.i18n.localize("MKC.InfoType.CR"),
          value: system.details.cr ?? "—"
        };
      case "creatureType":
        return {
          label: game.i18n.localize("MKC.InfoType.CreatureType"),
          value: this._formatCreatureType()
        };
      case "allStats":
        return {
          label: game.i18n.localize("MKC.InfoType.AllStats"),
          value: this._formatAllStats()
        };
      case "allSaves":
        return {
          label: game.i18n.localize("MKC.InfoType.AllSaves"),
          value: this._formatAllSaves()
        };
      case "legendaryActions":
        return {
          label: game.i18n.localize("MKC.InfoType.LegendaryActions"),
          value: system.resources?.legact?.max ?? 0
        };
      case "legendaryResistances":
        return {
          label: game.i18n.localize("MKC.InfoType.LegendaryResistances"),
          value: system.resources?.legres?.max ?? 0
        };
      default:
        return null;
    }
  }

  /* -------------------------------------------- */

  _getResistancesInfo() {
    const traits = this.monster.system.traits;
    const parts = [];
    
    const vuln = this._formatDamageTraits(traits.dv);
    const res = this._formatDamageTraits(traits.dr);
    const imm = this._formatDamageTraits(traits.di);
    
    // Build array of info items (same format as condition immunities)
    const infoItems = [];
    
    if (vuln.length) {
      infoItems.push({
        label: game.i18n.localize("MKC.Chat.DamageVulnerabilities"),
        items: vuln,
        emptyText: ""
      });
    }
    if (res.length) {
      infoItems.push({
        label: game.i18n.localize("MKC.Chat.DamageResistances"),
        items: res,
        emptyText: ""
      });
    }
    if (imm.length) {
      infoItems.push({
        label: game.i18n.localize("MKC.Chat.DamageImmunities"),
        items: imm,
        emptyText: ""
      });
    }
    
    if (infoItems.length === 0) {
      return {
        label: game.i18n.localize("MKC.Chat.DamageTraits"),
        value: game.i18n.localize("MKC.Chat.NoDamageTraits")
      };
    }
    
    // Return multiple items to be added individually
    return infoItems;
  }

  /* -------------------------------------------- */

  _getConditionImmunitiesInfo() {
    const conditions = this._getConditionImmunities();
    return {
      label: game.i18n.localize("MKC.InfoType.ConditionImmunities"),
      items: conditions,
      emptyText: game.i18n.localize("MKC.Chat.NoConditionImmunities")
    };
  }

  /* -------------------------------------------- */

  _getHighestStatInfo() {
    const stat = this._getHighestStat();
    if (!stat) return null;
    
    const saveSign = stat.save >= 0 ? "+" : "";
    return {
      label: game.i18n.localize("MKC.Chat.HighestStat"),
      value: `${stat.label}: ${stat.value} (${game.i18n.localize("MKC.Chat.Save")}: ${saveSign}${stat.save})`
    };
  }

  /* -------------------------------------------- */

  _getLowestStatInfo() {
    const stat = this._getLowestStat();
    if (!stat) return null;
    
    const saveSign = stat.save >= 0 ? "+" : "";
    return {
      label: game.i18n.localize("MKC.Chat.LowestStat"),
      value: `${stat.label}: ${stat.value} (${game.i18n.localize("MKC.Chat.Save")}: ${saveSign}${stat.save})`
    };
  }

  /* -------------------------------------------- */

  _formatDamageTraits(trait) {
    if (!trait) return [];
    
    const values = [];
    
    if (trait.value instanceof Set) {
      for (const type of trait.value) {
        const label = CONFIG.DND5E.damageTypes[type]?.label || type;
        values.push(label);
      }
    } else if (Array.isArray(trait.value)) {
      for (const type of trait.value) {
        const label = CONFIG.DND5E.damageTypes[type]?.label || type;
        values.push(label);
      }
    }
    
    if (trait.custom) values.push(trait.custom);
    
    return values;
  }

  /* -------------------------------------------- */

  _getConditionImmunities() {
    const ci = this.monster.system.traits.ci;
    if (!ci) return [];
    
    const values = [];
    
    if (ci.value instanceof Set) {
      for (const condition of ci.value) {
        const label = CONFIG.DND5E.conditionTypes[condition]?.label || condition;
        values.push(label);
      }
    } else if (Array.isArray(ci.value)) {
      for (const condition of ci.value) {
        const label = CONFIG.DND5E.conditionTypes[condition]?.label || condition;
        values.push(label);
      }
    }
    
    if (ci.custom) values.push(ci.custom);
    
    return values;
  }

  /* -------------------------------------------- */

  _getHighestStat() {
    const abilities = this.monster.system.abilities;
    let highest = { id: null, value: -Infinity, save: 0, label: "" };
    
    for (const [id, ability] of Object.entries(abilities)) {
      if (ability.value > highest.value) {
        highest = {
          id,
          value: ability.value,
          save: ability.save?.value ?? ability.save ?? 0,
          label: CONFIG.DND5E.abilities[id]?.label || id
        };
      }
    }
    
    return highest.id ? highest : null;
  }

  /* -------------------------------------------- */

  _getLowestStat() {
    const abilities = this.monster.system.abilities;
    let lowest = { id: null, value: Infinity, save: 0, label: "" };
    
    for (const [id, ability] of Object.entries(abilities)) {
      if (ability.value < lowest.value) {
        lowest = {
          id,
          value: ability.value,
          save: ability.save?.value ?? ability.save ?? 0,
          label: CONFIG.DND5E.abilities[id]?.label || id
        };
      }
    }
    
    return lowest.id ? lowest : null;
  }

  /* -------------------------------------------- */

  _formatSpeed() {
    const movement = this.monster.system.attributes.movement;
    if (!movement) return "—";

    const parts = [];
    if (movement.walk) parts.push(`${movement.walk} ${movement.units || "ft."}`);
    if (movement.fly) parts.push(`fly ${movement.fly} ${movement.units || "ft."}${movement.hover ? " (hover)" : ""}`);
    if (movement.swim) parts.push(`swim ${movement.swim} ${movement.units || "ft."}`);
    if (movement.climb) parts.push(`climb ${movement.climb} ${movement.units || "ft."}`);
    if (movement.burrow) parts.push(`burrow ${movement.burrow} ${movement.units || "ft."}`);

    return parts.join(", ") || "—";
  }

  /* -------------------------------------------- */

  _formatSenses() {
    const senses = this.monster.system.attributes.senses;
    if (!senses) return "—";

    const parts = [];
    const units = senses.units || "ft.";
    
    if (senses.darkvision) parts.push(`darkvision ${senses.darkvision} ${units}`);
    if (senses.blindsight) parts.push(`blindsight ${senses.blindsight} ${units}`);
    if (senses.tremorsense) parts.push(`tremorsense ${senses.tremorsense} ${units}`);
    if (senses.truesight) parts.push(`truesight ${senses.truesight} ${units}`);
    if (senses.special) parts.push(senses.special);

    return parts.join(", ") || "—";
  }

  /* -------------------------------------------- */

  _formatLanguages() {
    const languages = this.monster.system.traits.languages;
    if (!languages) return "—";

    const parts = [];

    if (languages.value instanceof Set) {
      for (const lang of languages.value) {
        const label = CONFIG.DND5E.languages[lang]?.label || lang;
        parts.push(label);
      }
    } else if (Array.isArray(languages.value)) {
      for (const lang of languages.value) {
        const label = CONFIG.DND5E.languages[lang]?.label || lang;
        parts.push(label);
      }
    }

    if (languages.custom) parts.push(languages.custom);

    return parts.join(", ") || "—";
  }

  /* -------------------------------------------- */

  _formatCreatureType() {
    const details = this.monster.system.details;
    const typeValue = details.type?.value;
    const typeLabel = CONFIG.DND5E.creatureTypes[typeValue]?.label || typeValue || "—";
    
    if (details.type?.subtype) {
      return `${typeLabel} (${details.type.subtype})`;
    }
    return typeLabel;
  }

  /* -------------------------------------------- */

  _formatAllStats() {
    const abilities = this.monster.system.abilities;
    const parts = [];

    for (const [id, ability] of Object.entries(abilities)) {
      const label = CONFIG.DND5E.abilities[id]?.abbreviation?.toUpperCase() || id;
      parts.push(`${label}: ${ability.value}`);
    }

    return parts.join(", ");
  }

  /* -------------------------------------------- */

  _formatAllSaves() {
    const abilities = this.monster.system.abilities;
    const parts = [];

    for (const [id, ability] of Object.entries(abilities)) {
      const label = CONFIG.DND5E.abilities[id]?.abbreviation?.toUpperCase() || id;
      const save = ability.save?.value ?? ability.save ?? 0;
      const sign = save >= 0 ? "+" : "";
      parts.push(`${label}: ${sign}${save}`);
    }

    return parts.join(", ");
  }

  /* -------------------------------------------- */

  async _sendResultToChat(roll, skillId, skillConfig, knowledge, dcs, advantage, dcModifier, isAutopass, autopassLevel) {
    const templatePath = `modules/${MODULE_ID}/templates/knowledge-result.hbs`;
    
    let autopassLevelLabel = "";
    if (autopassLevel) {
      const tierNum = autopassLevel.replace("tier", "");
      const romanNumerals = { "1": "I", "2": "II", "3": "III", "4": "IV", "5": "V" };
      autopassLevelLabel = game.i18n.localize(`MKC.Tier.${romanNumerals[tierNum]}`);
    }
    
    const templateData = {
      monster: this.monster,
      player: this.player,
      skill: skillConfig,
      skillId,
      roll: roll ? { total: roll.total, formula: roll.formula } : null,
      isAutopass,
      autopassLevel,
      autopassLevelLabel,
      advantage,
      dcModifier,
      dcs,
      tiers: knowledge.tiers,
      hasKnowledge: knowledge.hasAny
    };

    const content = await renderTemplate(templatePath, templateData);

    const messageData = {
      speaker: ChatMessage.getSpeaker({ actor: this.player }),
      content,
      rolls: roll ? [roll] : [],
      type: CONST.CHAT_MESSAGE_STYLES.OTHER,
      flags: {
        [MODULE_ID]: {
          monsterId: this.monster.id,
          monsterName: this.monster.name,
          skillUsed: skillId,
          knowledge: knowledge
        }
      }
    };

    await ChatMessage.create(messageData);
  }
}

/* -------------------------------------------- */
/*  Bestiary Functions (exported for main.mjs)  */
/* -------------------------------------------- */

/**
 * Add monster knowledge to the bestiary journal
 * @param {string} monsterId - The monster actor ID
 * @param {Object} knowledge - The knowledge data from the chat message
 */
export async function addToBestiary(monsterId, knowledge) {
  const monster = game.actors.get(monsterId);
  if (!monster) {
    ui.notifications.error(game.i18n.localize("MKC.Errors.MonsterNotFound"));
    return;
  }

  const monsterName = monster.name;
  const journalName = game.i18n.localize("MKC.Journal.BestiaryName");

  // Build content from knowledge
  const content = buildBestiaryContent(knowledge, monsterName);

  // Find or create the bestiary journal
  let bestiary = game.journal.find(j => j.name === journalName);

  if (!bestiary) {
    bestiary = await JournalEntry.create({
      name: journalName,
      pages: [{
        name: monsterName,
        type: "text",
        text: { content }
      }]
    });
    ui.notifications.info(game.i18n.format("MKC.Journal.Created", { name: monsterName }));
  } else {
    const existingPage = bestiary.pages.find(p => p.name === monsterName);
    
    if (existingPage) {
      // Merge content
      const mergedContent = mergeBestiaryContent(existingPage.text.content, content);
      await existingPage.update({ "text.content": mergedContent });
      ui.notifications.info(game.i18n.format("MKC.Journal.Updated", { name: monsterName }));
    } else {
      await bestiary.createEmbeddedDocuments("JournalEntryPage", [{
        name: monsterName,
        type: "text",
        text: { content }
      }]);
      ui.notifications.info(game.i18n.format("MKC.Journal.PageAdded", { name: monsterName }));
    }
  }
}

/**
 * Build HTML content for bestiary entry
 */
function buildBestiaryContent(knowledge, monsterName) {
  const timestamp = new Date().toLocaleDateString();
  let content = `<p><em>${game.i18n.format("MKC.Journal.LastUpdated", { date: timestamp })}</em></p><hr>`;

  for (const tier of knowledge.tiers) {
    content += `<h3>${tier.label}</h3>`;
    
    for (const info of tier.info) {
      if (info.subItems) {
        content += `<p><strong>${info.label}:</strong></p><ul>`;
        for (const sub of info.subItems) {
          content += `<li><strong>${sub.label}:</strong> ${sub.items.join(", ")}</li>`;
        }
        content += `</ul>`;
      } else if (info.items) {
        if (info.items.length) {
          content += `<p><strong>${info.label}:</strong> ${info.items.join(", ")}</p>`;
        } else {
          content += `<p><strong>${info.label}:</strong> <em>${info.emptyText || "None"}</em></p>`;
        }
      } else {
        content += `<p><strong>${info.label}:</strong> ${info.value}${info.formula ? ` (${info.formula})` : ""}</p>`;
      }
    }
  }

  return content;
}

/**
 * Merge new content with existing bestiary content
 */
function mergeBestiaryContent(existingContent, newContent) {
  // Simple approach: replace with new content (which should include all accumulated knowledge)
  // The knowledge object from chat flags should already contain merged data
  return newContent;
}
