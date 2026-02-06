/**
 * Settings Registration for Monster Knowledge Check
 * Uses a tier-based system (Tier I-IV) with configurable info per tier
 */

const MODULE_ID = "momos-guide-to-monsters";

/**
 * Available info types that can be revealed
 */
export const INFO_TYPES = {
  resistances: "MKC.InfoType.Resistances",
  conditionImmunities: "MKC.InfoType.ConditionImmunities",
  highestStat: "MKC.InfoType.HighestStat",
  lowestStat: "MKC.InfoType.LowestStat",
  ac: "MKC.InfoType.AC",
  hp: "MKC.InfoType.HP",
  speed: "MKC.InfoType.Speed",
  senses: "MKC.InfoType.Senses",
  languages: "MKC.InfoType.Languages",
  cr: "MKC.InfoType.CR",
  creatureType: "MKC.InfoType.CreatureType",
  allStats: "MKC.InfoType.AllStats",
  allSaves: "MKC.InfoType.AllSaves",
  legendaryActions: "MKC.InfoType.LegendaryActions",
  legendaryResistances: "MKC.InfoType.LegendaryResistances"
};

/**
 * Default info selections for each tier
 */
export const DEFAULT_TIER_INFO = {
  tier1: ["resistances"],
  tier2: ["conditionImmunities"],
  tier3: ["highestStat"],
  tier4: ["lowestStat"],
  tier5: []
};

/**
 * Default DC values for each tier
 */
export const DEFAULT_DCS = {
  tier1: 12,
  tier2: 15,
  tier3: 18,
  tier4: 22,
  tier5: 25
};

/**
 * Register all module settings
 */
export function registerSettings() {
  // DC Settings for each tier
  game.settings.register(MODULE_ID, "dcTier1", {
    name: "MKC.Settings.DCTier1.Name",
    hint: "MKC.Settings.DCTier1.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULT_DCS.tier1,
    range: {
      min: 1,
      max: 40,
      step: 1
    }
  });

  game.settings.register(MODULE_ID, "dcTier2", {
    name: "MKC.Settings.DCTier2.Name",
    hint: "MKC.Settings.DCTier2.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULT_DCS.tier2,
    range: {
      min: 1,
      max: 40,
      step: 1
    }
  });

  game.settings.register(MODULE_ID, "dcTier3", {
    name: "MKC.Settings.DCTier3.Name",
    hint: "MKC.Settings.DCTier3.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULT_DCS.tier3,
    range: {
      min: 1,
      max: 40,
      step: 1
    }
  });

  game.settings.register(MODULE_ID, "dcTier4", {
    name: "MKC.Settings.DCTier4.Name",
    hint: "MKC.Settings.DCTier4.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULT_DCS.tier4,
    range: {
      min: 1,
      max: 40,
      step: 1
    }
  });

  game.settings.register(MODULE_ID, "dcTier5", {
    name: "MKC.Settings.DCTier5.Name",
    hint: "MKC.Settings.DCTier5.Hint",
    scope: "world",
    config: true,
    type: Number,
    default: DEFAULT_DCS.tier5,
    range: {
      min: 1,
      max: 40,
      step: 1
    }
  });

  // Info type selections for each tier (stored as comma-separated strings)
  game.settings.register(MODULE_ID, "infoTier1", {
    name: "MKC.Settings.InfoTier1.Name",
    hint: "MKC.Settings.InfoTier1.Hint",
    scope: "world",
    config: false,
    type: String,
    default: DEFAULT_TIER_INFO.tier1.join(",")
  });

  game.settings.register(MODULE_ID, "infoTier2", {
    name: "MKC.Settings.InfoTier2.Name",
    hint: "MKC.Settings.InfoTier2.Hint",
    scope: "world",
    config: false,
    type: String,
    default: DEFAULT_TIER_INFO.tier2.join(",")
  });

  game.settings.register(MODULE_ID, "infoTier3", {
    name: "MKC.Settings.InfoTier3.Name",
    hint: "MKC.Settings.InfoTier3.Hint",
    scope: "world",
    config: false,
    type: String,
    default: DEFAULT_TIER_INFO.tier3.join(",")
  });

  game.settings.register(MODULE_ID, "infoTier4", {
    name: "MKC.Settings.InfoTier4.Name",
    hint: "MKC.Settings.InfoTier4.Hint",
    scope: "world",
    config: false,
    type: String,
    default: DEFAULT_TIER_INFO.tier4.join(",")
  });

  game.settings.register(MODULE_ID, "infoTier5", {
    name: "MKC.Settings.InfoTier5.Name",
    hint: "MKC.Settings.InfoTier5.Hint",
    scope: "world",
    config: false,
    type: String,
    default: DEFAULT_TIER_INFO.tier5.join(",")
  });

  // Register the settings menu button
  game.settings.registerMenu(MODULE_ID, "tierConfigMenu", {
    name: "MKC.Settings.TierConfig.Name",
    label: "MKC.Settings.TierConfig.Label",
    hint: "MKC.Settings.TierConfig.Hint",
    icon: "fas fa-cogs",
    type: TierConfigMenu,
    restricted: true
  });
}

/**
 * Get a setting value
 * @param {string} key
 * @returns {*}
 */
export function getSetting(key) {
  return game.settings.get(MODULE_ID, key);
}

/**
 * Set a setting value
 * @param {string} key
 * @param {*} value
 */
export async function setSetting(key, value) {
  return game.settings.set(MODULE_ID, key, value);
}

/**
 * Get the info types for a specific tier as an array
 * @param {string} tier - "tier1", "tier2", "tier3", "tier4", or "tier5"
 * @returns {string[]}
 */
export function getTierInfo(tier) {
  const setting = getSetting(`info${tier.charAt(0).toUpperCase() + tier.slice(1)}`);
  return setting ? setting.split(",").filter(s => s.trim()) : [];
}

/**
 * Get all tier configurations
 * @returns {Object}
 */
export function getAllTierConfig() {
  return {
    tier1: {
      dc: getSetting("dcTier1"),
      info: getTierInfo("tier1")
    },
    tier2: {
      dc: getSetting("dcTier2"),
      info: getTierInfo("tier2")
    },
    tier3: {
      dc: getSetting("dcTier3"),
      info: getTierInfo("tier3")
    },
    tier4: {
      dc: getSetting("dcTier4"),
      info: getTierInfo("tier4")
    },
    tier5: {
      dc: getSetting("dcTier5"),
      info: getTierInfo("tier5")
    }
  };
}

/* -------------------------------------------- */
/*  Tier Configuration Menu                     */
/* -------------------------------------------- */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Configuration menu for tier info selections
 */
class TierConfigMenu extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "mkc-tier-config",
    classes: ["dnd5e2", "mkc-tier-config"],
    tag: "form",
    window: {
      title: "MKC.Settings.TierConfig.Title",
      icon: "fas fa-list-check",
      contentClasses: ["standard-form"],
      resizable: true
    },
    position: {
      width: 600,
      height: "auto"
    },
    form: {
      submitOnChange: false,
      closeOnSubmit: true
    }
  };

  static PARTS = {
    form: {
      template: `modules/${MODULE_ID}/templates/tier-config.hbs`
    },
    footer: {
      template: "templates/generic/form-footer.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    
    // Build tier data with current selections
    const tiers = ["tier1", "tier2", "tier3", "tier4", "tier5"];
    const romanNumerals = ["I", "II", "III", "IV", "V"];
    context.tiers = tiers.map((tier, index) => {
      const currentInfo = getTierInfo(tier);
      return {
        id: tier,
        label: game.i18n.localize(`MKC.Tier.${romanNumerals[index]}`),
        dc: getSetting(`dc${tier.charAt(0).toUpperCase() + tier.slice(1)}`),
        isOptional: tier === "tier5",
        infoTypes: Object.entries(INFO_TYPES).map(([key, labelKey]) => ({
          key,
          label: game.i18n.localize(labelKey),
          checked: currentInfo.includes(key)
        }))
      };
    });

    return context;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    
    if (partId === "footer") {
      context.buttons = [
        {
          type: "submit",
          icon: "fas fa-save",
          label: game.i18n.localize("Save")
        }
      ];
    }
    
    return context;
  }

  async _onSubmitForm(formConfig, event) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormDataExtended(form);
    const data = formData.object;
    
    // Process each tier
    const tiers = ["tier1", "tier2", "tier3", "tier4", "tier5"];
    for (const tier of tiers) {
      // Collect all checked info types for this tier
      const checkedInfo = [];
      for (const infoKey of Object.keys(INFO_TYPES)) {
        if (data[`${tier}-${infoKey}`]) {
          checkedInfo.push(infoKey);
        }
      }
      
      // Save the info types as comma-separated string
      const settingKey = `info${tier.charAt(0).toUpperCase() + tier.slice(1)}`;
      await setSetting(settingKey, checkedInfo.join(","));
    }
    
    ui.notifications.info(game.i18n.localize("MKC.Settings.Saved"));
  }
}
