/**
 * Rawgrim: The Toll of Survival
 * Module 2: Catalyst Upstream Gatekeeper & Unified Spell Hook (Version 14.5)
 */

globalThis.RawgrimSurvival = globalThis.RawgrimSurvival || {};

Hooks.once('setup', () => {
    if (typeof libWrapper === 'undefined' || !libWrapper.register) {
        console.error("Rawgrim | Critical Error: 'libWrapper' API tidak ditemukan!");
        return;
    }

    const moduleID = 'rawgrim-toll-of-survival';

    libWrapper.register(moduleID, 'CONFIG.Item.documentClass.prototype.use', async function (wrapped, config, options) {
        const item = this;
        const actor = item.actor;

        if (item.type === 'spell' && (item.system.level ?? 0) > 0 && actor) {
            const globalEnforced = game.settings.get('rawgrim-toll-of-survival', 'globalCatalystEnforcement') || false;
            const actorDependent = actor.getFlag('rawgrim-toll-of-survival', 'isCatalystDependent') || false;
            
            if (globalEnforced === true || actorDependent === true) {
                const catalystItem = globalThis.RawgrimSurvival.getActiveCatalyst(actor);
                if (!catalystItem) {
                    if (globalThis.RawgrimSurvival.tampilkanPeringatanLayarTengah) {
                        globalThis.RawgrimSurvival.tampilkanPeringatanLayarTengah(actor.name, item.name);
                    }
                    return false; 
                }
            }
        }

        const result = await wrapped(config, options);

        if (result !== false && item.type === 'spell' && actor) {
            const globalEnforced = game.settings.get('rawgrim-toll-of-survival', 'globalCatalystEnforcement') || false;
            const actorDependent = actor.getFlag('rawgrim-toll-of-survival', 'isCatalystDependent') || false;
            
            if (globalEnforced === true || actorDependent === true) {
                if ((item.system.level ?? 0) > 0) {
                    const castLevel = globalThis.RawgrimSurvival.getSpellCastLevel(actor, item, config, options, result);
                    setTimeout(() => {
                        if (globalThis.RawgrimSurvival.kirimPermintaanRollCatalyst) {
                            globalThis.RawgrimSurvival.kirimPermintaanRollCatalyst(actor, `Casting ${item.name} at level ${castLevel}`);
                        }
                    }, 500);
                }
            }
            if (globalThis.RawgrimSurvival.prosesResonansiMantraSINKRON) {
                globalThis.RawgrimSurvival.prosesResonansiMantraSINKRON(actor, item, config, options, result);
            }
        }

        return result;
    }, 'MIXED');
});

Hooks.once('ready', () => {
    if (ui.notifications) {
        const originalWarn = ui.notifications.warn;
        ui.notifications.warn = function (message, options) {
            if (typeof message === "string" && message.includes("libWrapper")) return;
            return originalWarn.apply(this, arguments);
        };
    }
    console.log("Rawgrim | 🟢 Catalyst Interceptor Engine Online.");
});
