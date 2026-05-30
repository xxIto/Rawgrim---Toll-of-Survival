/**
 * Rawgrim: The Toll of Survival
 * Module 1: Core Helpers & Shared Namespace (Version 14.5)
 */

globalThis.RawgrimSurvival = globalThis.RawgrimSurvival || {};

Hooks.once('init', () => {
    const moduleID = 'rawgrim-toll-of-survival';

    game.settings.register(moduleID, 'globalCatalystEnforcement', {
        name: "Global Catalyst Enforcement",
        hint: "If enabled, all spellcasters strictly require a Material Catalyst, overriding individual token configurations.",
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });

    game.settings.register(moduleID, 'resonanceMultiplier', {
        name: "Resonance Multiplier",
        hint: "The mathematical multiplier applied to the cast spell level to generate Resonance Points.",
        scope: "world",
        config: true,
        type: Number,
        range: { min: 1, max: 5, step: 1 },
        default: 2
    });

    game.settings.register(moduleID, 'restVariant', {
        name: "Sustenance Rest Variant",
        hint: "Select the time and resource scale. Gritty Realism forces scaled logistics consumption.",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "normal": "Normal Variant (1-Day Long Rest)",
            "gritty": "Gritty Realism (7-Day Long Rest)"
        },
        default: "gritty"
    });

    game.settings.register(moduleID, 'rationGoldCost', {
        name: "Base Ration Cost (GP)",
        hint: "The base price in Gold Pieces (GP) for a single day's ration when funding rest via currency.",
        scope: "world",
        config: true,
        type: Number,
        default: 0.5
    });

    game.settings.register(moduleID, 'waterGoldCost', {
        name: "Base Water Cost (GP)",
        hint: "The base price in Gold Pieces (GP) for a single day's water supply when funding rest via currency.",
        scope: "world",
        config: true,
        type: Number,
        default: 0.2
    });
});

Object.assign(globalThis.RawgrimSurvival, {
    escapeHTML(value) {
        if (foundry.utils.escapeHTML) return foundry.utils.escapeHTML(String(value ?? ""));
        return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    },

    getCleanItemName(itemOrName) {
        let name = typeof itemOrName === "string" ? itemOrName : (itemOrName?.name || "");
        return name.replace(/^(\[(DAMAGED|OVERLOADED)\]\s*)+/i, "");
    },

    
    getResonanceThreshold(actor) {
        const totalLevel = actor.system.details.level || 1;
        if (totalLevel <= 2) return 20;
        if (totalLevel <= 4) return 19;
        if (totalLevel <= 6) return 18;
        if (totalLevel <= 8) return 17;
        return 16;
    },

    getSpellCastLevel(actor, item, config = {}, options = {}, result = null) {
        const messageLevel = foundry.utils.getProperty(result, "message.system.spellLevel")
            ?? foundry.utils.getProperty(result, "message.data.system.spellLevel")
            ?? foundry.utils.getProperty(result, "system.spellLevel");
        if (messageLevel !== undefined && messageLevel !== null) return Number(messageLevel);

        const directLevel = config?.spellLevel ?? config?.slotLevel ?? config?.level
            ?? options?.spellLevel ?? options?.slotLevel ?? options?.level;
        if (directLevel !== undefined && directLevel !== null) return Number(directLevel);

        const spellSlot = config?.spell?.slot ?? options?.spell?.slot;
        const slotLevel = actor?.system?.spells?.[spellSlot]?.level;
        if (slotLevel !== undefined && slotLevel !== null) return Number(slotLevel);

        return Number(item?.system?.level ?? 0);
    },

    getBacklashStageName(failures) {
        if (failures <= 15) return "Early Stage";
        if (failures <= 30) return "Intermediate Stage";
        return "Advanced Stage";
    },

    getMarksStages() {
        return [
            {
                key: "early",
                name: "Early Stage",
                offset: 0,
                description: "Subtle signs appear: darkened veins, strange eyes, or unnatural warmth and cold."
            },
            {
                key: "intermediate",
                name: "Intermediate Stage",
                offset: 15,
                description: "The corruption is harder to hide: pale hair, deadened eyes, or skin that no longer feels right."
            },
            {
                key: "advanced",
                name: "Advanced Stage",
                offset: 30,
                description: "The body visibly fractures. Shadows, flame, and sound may answer the corruption."
            }
        ];
    },

    getMarksStage(stageKey) {
        return this.getMarksStages().find(stage => stage.key === stageKey) || this.getMarksStages()[0];
    },

    getMarksStageFromTotal(totalFailures) {
        const total = Math.max(0, Number.parseInt(totalFailures, 10) || 0);
        if (total <= 15) return { stageKey: "early", stageCount: total };
        if (total <= 30) return { stageKey: "intermediate", stageCount: total - 15 };
        return { stageKey: "advanced", stageCount: total - 30 };
    },

    getActorMarksState(actor) {
        const legacyTotal = Math.max(0, Number.parseInt(actor?.getFlag('rawgrim-toll-of-survival', 'backlashFailures'), 10) || 0);
        const migrated = this.getMarksStageFromTotal(legacyTotal);
        const storedStageKey = actor?.getFlag('rawgrim-toll-of-survival', 'marksStage') || migrated.stageKey;
        const stage = this.getMarksStage(storedStageKey);
        const rawStageCount = actor?.getFlag('rawgrim-toll-of-survival', 'marksStageCount');
        const stageCount = rawStageCount === undefined || rawStageCount === null
            ? migrated.stageCount
            : Math.max(0, Number.parseInt(rawStageCount, 10) || 0);
        const totalFailures = stage.offset + stageCount;

        return {
            stageKey: stage.key,
            stageName: stage.name,
            stageDescription: stage.description,
            stageCount,
            stageLimit: stage.key === "advanced" ? null : 15,
            totalFailures
        };
    },

    async setActorMarksState(actor, stageKey, stageCount) {
        const stage = this.getMarksStage(stageKey);
        const safeCount = Math.max(0, Number.parseInt(stageCount, 10) || 0);
        await actor.setFlag('rawgrim-toll-of-survival', 'marksStage', stage.key);
        await actor.setFlag('rawgrim-toll-of-survival', 'marksStageCount', safeCount);
        await actor.setFlag('rawgrim-toll-of-survival', 'backlashFailures', stage.offset + safeCount);
    },

    async advanceActorMarks(actor) {
        const oldState = this.getActorMarksState(actor);
        const stages = this.getMarksStages();
        const oldStageIndex = stages.findIndex(stage => stage.key === oldState.stageKey);
        let nextStageKey = oldState.stageKey;
        let nextCount = oldState.stageCount + 1;
        let stageChanged = false;

        if (oldState.stageKey !== "advanced" && nextCount > 15) {
            const nextStage = stages[Math.min(oldStageIndex + 1, stages.length - 1)];
            nextStageKey = nextStage.key;
            nextCount = 1;
            stageChanged = true;
        }

        await this.setActorMarksState(actor, nextStageKey, nextCount);
        const newState = this.getActorMarksState(actor);
        return {
            oldState,
            newState,
            stageChanged,
            nearTransition: !stageChanged && newState.stageKey !== "advanced" && newState.stageCount >= 13
        };
    },

    getActiveCatalyst(actor) {
        if (!actor) return null;
        return actor.items.find(i => {
            const name = i.name?.toLowerCase() || "";
            if (!name.includes('material catalyst')) return false;
            const usageDie = i.getFlag('rawgrim-toll-of-survival', 'usageDie') || 'd8';
            return usageDie !== 'expended';
        }) || null;
    },

    getCatalystUsageDie(actor) {
        const catalystItem = this.getActiveCatalyst(actor);
        return catalystItem ? (catalystItem.getFlag('rawgrim-toll-of-survival', 'usageDie') || 'd8') : null;
    },

    getCatalystState(actor) {
        const activeCatalyst = this.getActiveCatalyst(actor);
        const allCatalysts = actor?.items?.filter(i => i?.name?.toLowerCase()?.includes('material catalyst')) || [];
        const usageDie = activeCatalyst ? (activeCatalyst.getFlag('rawgrim-toll-of-survival', 'usageDie') || 'd8') : null;

        return {
            activeCatalyst,
            usageDie,
            display: usageDie || "None",
            count: allCatalysts.length,
            requiresCatalyst: actor?.getFlag('rawgrim-toll-of-survival', 'isCatalystDependent') || false
        };
    },

    getNextCatalystDie(currentDie) {
        if (currentDie === "d8") return "d6";
        if (currentDie === "d6") return "d4";
        if (currentDie === "d4") return "expended";
        return "expended";
    },

    getNextDurabilityDie(currentDie) {
        if (currentDie === "d10") return "d8";
        if (currentDie === "d8") return "d6";
        if (currentDie === "d6") return "d4";
        if (currentDie === "d4") return "damaged";
        return "damaged";
    },

    isDurabilityItem(item) {
        if (!item) return false;
        if (item.type === "weapon") return true;
        if (item.type !== "equipment") return false;
        const armorType = item.system?.type?.value || item.system?.armor?.type || "";
        return ["light", "medium", "heavy", "shield"].includes(armorType);
    },

    isProstheticItem(item) {
        return !!item?.name?.toLowerCase()?.includes("prosthetic");
    },

    getActorProsthetics(actor) {
        return actor?.items?.filter(item => this.isProstheticItem(item)) || [];
    },

    getDurabilityItems(actor) {
        return actor?.items?.filter(item => this.isDurabilityItem(item)) || [];
    },

    getItemDurabilityDie(item) {
        if (!item || !this.isDurabilityItem(item)) return null;
        if (item.getFlag('rawgrim-toll-of-survival', 'isDamaged') === true) return "damaged";
        return item.getFlag('rawgrim-toll-of-survival', 'durabilityDie') || "d10";
    },

    getEquipmentIntegritySummary(actor) {
        const durabilityItems = this.getDurabilityItems(actor);
        const prosthetics = this.getActorProsthetics(actor);
        const concernItems = durabilityItems
            .map(item => ({ item, die: this.getItemDurabilityDie(item) }))
            .filter(entry => entry.die && entry.die !== "d10")
            .map(entry => ({
                name: this.getCleanItemName(entry.item),
                status: entry.die === "damaged" ? "Damaged" : entry.die,
                severity: entry.die === "damaged" ? "danger" : (entry.die === "d4" ? "warning" : "muted")
            }));
        const overloaded = prosthetics.filter(item => item?.getFlag('rawgrim-toll-of-survival', 'isOverloaded') === true);
        const ignisDays = actor?.getFlag('rawgrim-toll-of-survival', 'ignisCalibrationDays') || 0;

        return {
            durabilityItems,
            concernItems,
            prosthetics,
            overloaded,
            ignisDays,
            ignisStatus: prosthetics.length === 0 ? "none" : (ignisDays >= 30 ? "due" : (ignisDays >= 25 ? "soon" : "ok"))
        };
    },

    async setItemDurabilityDie(item, durabilityDie = "d10") {
        if (!item || !this.isDurabilityItem(item)) return;
        const normalizedDie = ["d10", "d8", "d6", "d4", "damaged"].includes(durabilityDie) ? durabilityDie : "d10";
        if (normalizedDie === "damaged") {
            await this.markItemDamaged(item);
            return;
        }
        await item.setFlag('rawgrim-toll-of-survival', 'durabilityDie', normalizedDie);
        await item.unsetFlag('rawgrim-toll-of-survival', 'isDamaged');
        if (item.name.startsWith("[DAMAGED] ")) await item.update({ name: item.name.replace("[DAMAGED] ", "") });
    },

    async markItemDamaged(item) {
        if (!item) return;
        await item.setFlag('rawgrim-toll-of-survival', 'isDamaged', true);
        await item.setFlag('rawgrim-toll-of-survival', 'durabilityDie', "damaged");
        if (!item.name.startsWith("[DAMAGED] ")) await item.update({ name: `[DAMAGED] ${item.name}` });
    },

    async repairDamagedItem(item, durabilityDie = "d10") {
        if (!item) return;
        const cleanedName = item.name.replace("[DAMAGED] ", "");
        await item.update({ name: cleanedName });
        await item.unsetFlag('rawgrim-toll-of-survival', 'isDamaged');
        await item.setFlag('rawgrim-toll-of-survival', 'durabilityDie', durabilityDie);
    },

    async createEquipmentRepairMessage(actor, item, durabilityDie = "d10") {
        if (!actor || !item) return;
        const itemName = this.escapeHTML(this.getCleanItemName(item));
        const chatContent = `
            <div class="rawgrim-sys-card integrity">
                <h4 class="rawgrim-card-title">Equipment Repaired</h4>
                <p class="rawgrim-card-sub"><strong>${itemName}</strong> is repaired and ready for use.</p>
                <table class="rawgrim-table-compact">
                    <thead><tr><th>Durability Die</th><th>Resolved By</th></tr></thead>
                    <tbody><tr><td>${durabilityDie}</td><td>${this.escapeHTML(game.user?.name || "GM")}</td></tr></tbody>
                </table>
                <p class="rawgrim-card-note">Any manual item penalty should be removed by the GM if one was applied.</p>
            </div>
        `;
        await ChatMessage.create({ content: chatContent, speaker: ChatMessage.getSpeaker({ actor }) });
    },

    getLingeringInjuries(actor) {
        return actor?.getFlag('rawgrim-toll-of-survival', 'lingeringInjuries') || [];
    },

    async addLingeringInjury(actor, injury) {
        if (!actor) return;
        const injuries = this.getLingeringInjuries(actor);
        const entry = {
            id: foundry.utils.randomID(),
            reason: injury.reason || "GM confirmed trigger",
            description: injury.description || "Lingering injury recorded by the GM.",
            createdAt: Date.now()
        };
        await actor.setFlag('rawgrim-toll-of-survival', 'lingeringInjuries', injuries.concat(entry));
        return entry;
    },

    async removeLatestLingeringInjury(actor) {
        const injuries = this.getLingeringInjuries(actor);
        if (injuries.length === 0) return null;
        const removed = injuries[injuries.length - 1];
        await actor.setFlag('rawgrim-toll-of-survival', 'lingeringInjuries', injuries.slice(0, -1));
        return removed;
    },

    async createMaterialCatalyst(actor, usageDie = "d8") {
        const [created] = await actor.createEmbeddedDocuments("Item", [{
            name: `Material Catalyst (${usageDie})`,
            type: "loot",
            img: "icons/commodities/gems/gem-rough-teal.webp",
            system: {
                quantity: 1,
                weight: 1,
                price: { value: 25, denomination: "gp" },
                description: {
                    value: "<p>A refined mana-resonant object used to channel magic through a body that cannot draw mana on its own.</p>"
                }
            },
            flags: {
                "rawgrim-toll-of-survival": {
                    usageDie
                }
            }
        }]);

        return created;
    },

    async setCatalystUsageDie(actor, usageDie) {
        if (!actor) return null;
        const normalizedDie = usageDie === "none" ? "expended" : (["d8", "d6", "d4", "expended"].includes(usageDie) ? usageDie : null);
        let catalystItem = this.getActiveCatalyst(actor);

        if (!normalizedDie) return catalystItem;
        if (!catalystItem && normalizedDie !== "expended") {
            catalystItem = await this.createMaterialCatalyst(actor, normalizedDie);
            return catalystItem;
        }
        if (!catalystItem) return null;

        await catalystItem.setFlag('rawgrim-toll-of-survival', 'usageDie', normalizedDie);
        await catalystItem.update({ name: normalizedDie === "expended" ? "Material Catalyst (Expended)" : `Material Catalyst (${normalizedDie})` });
        return catalystItem;
    },

    getContainedResonance(totalRP, threshold) {
        return Math.max(0, threshold - 1);
    },

    getReleasedResonance(totalRP, threshold) {
        return Math.max(0, totalRP - threshold);
    },

    hasPendingOverload(actor) {
        return actor?.getFlag('rawgrim-toll-of-survival', 'resonanceOverloadPending') === true;
    },

    async setPendingOverload(actor, totalRP = 0) {
        if (!actor) return;
        await actor.setFlag('rawgrim-toll-of-survival', 'resonanceOverloadPending', true);
        await actor.setFlag('rawgrim-toll-of-survival', 'resonanceOverloadTotal', Math.max(0, Number.parseInt(totalRP, 10) || 0));
    },

    async clearPendingOverload(actor) {
        if (!actor) return;
        await actor.unsetFlag('rawgrim-toll-of-survival', 'resonanceOverloadPending');
        await actor.unsetFlag('rawgrim-toll-of-survival', 'resonanceOverloadTotal');
    },

    async checkAndPromptOverload(actor, totalRP = null) {
        if (!actor) return false;
        const threshold = this.getResonanceThreshold(actor);
        const currentRP = totalRP === null || totalRP === undefined
            ? (actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || 0)
            : Math.max(0, Number.parseInt(totalRP, 10) || 0);

        if (currentRP < threshold) {
            if (this.hasPendingOverload(actor)) await this.clearPendingOverload(actor);
            return false;
        }

        if (this.hasPendingOverload(actor)) return false;
        await this.setPendingOverload(actor, currentRP);
        await this.pemicuPeringatanBacklashGM(actor, currentRP, threshold);
        return true;
    },

    getGMUserIds() {
        return game.users.filter(user => user.isGM).map(user => user.id);
    },

    getActorOwnerAndGMUserIds(actor) {
        const playerOwners = game.users
            .filter(user => !user.isGM && actor?.testUserPermission(user, "OWNER"))
            .map(user => user.id);
        const gmIds = this.getGMUserIds();
        return playerOwners.length > 0 ? playerOwners.concat(gmIds) : gmIds;
    },

    async showDiceSoNiceRoll(roll, { whisper = null, blind = false } = {}) {
        if (!game.dice3d?.showForRoll) return;

        try {
            await game.dice3d.showForRoll(roll, game.user, true, whisper, blind);
        } catch (error) {
            console.warn("Rawgrim | Dice So Nice animation skipped.", error);
        }
    },

    async createResonanceResolutionMessage(actor, title, details) {
        const actorName = this.escapeHTML(actor?.name || "Unknown Actor");
        const message = this.escapeHTML(details.message || "");
        const note = details.note ? this.escapeHTML(details.note) : "";
        const chatContent = `
            <div class="rawgrim-sys-card" style="border-top-color: ${details.borderColor || '#2d261f'} !important;">
                <h4 class="rawgrim-card-title">${this.escapeHTML(title)}</h4>
                <p class="rawgrim-card-sub"><strong>${actorName}</strong> ${message}</p>
                <table class="rawgrim-table-compact">
                    <thead><tr><th>Before</th><th>After</th></tr></thead>
                    <tbody><tr><td>${details.before} RP</td><td>${details.after} RP</td></tr></tbody>
                </table>
                ${note ? `<p class="rawgrim-card-note">${note}</p>` : ''}
            </div>
        `;
        await ChatMessage.create({ content: chatContent, speaker: { alias: 'Laws of Rawgrim' } });
    },

    async kirimPermintaanRollCatalyst(actor, pemicuSebab = "1st-level spell or higher") {
        if (!actor) return;

        const currentDie = this.getCatalystUsageDie(actor);
        if (!currentDie) return;
        const encodedTrigger = encodeURIComponent(pemicuSebab);

        const chatContent = `
            <div class="rawgrim-catalyst-roll-card" data-actor-id="${actor.id}" data-trigger="${encodedTrigger}">
                <h4 class="rawgrim-card-title">Catalyst Usage Die Roll</h4>
                <p class="rawgrim-card-sub"><strong>${actor.name}</strong> must test their Material Catalyst.</p>
                <table class="rawgrim-table-compact">
                    <thead><tr><th>Trigger</th><th>Current Die</th></tr></thead>
                    <tbody><tr><td>${pemicuSebab}</td><td>${currentDie}</td></tr></tbody>
                </table>
                <p class="rawgrim-card-note">Private request: the actor owner or GM presses the roll button after the ability resolves.</p>
                <button type="button" class="rg-catalyst-roll-btn rawgrim-btn-flat"><i class="fas fa-dice"></i> Roll Catalyst</button>
            </div>
        `;

        await ChatMessage.create({
            content: chatContent,
            whisper: this.getActorOwnerAndGMUserIds(actor),
            speaker: ChatMessage.getSpeaker({ actor })
        });
    },

    async rollItemDurability(actor, item, reason = "GM request", options = {}) {
        if (!actor || !item) return;

        const currentDie = this.getItemDurabilityDie(item);
        if (!currentDie || currentDie === "damaged") {
            ui.notifications.warn(`${item.name} is already damaged or cannot use a Durability Die.`);
            return;
        }

        const roll = await new Roll(`1${currentDie}`).evaluate();
        await this.showDiceSoNiceRoll(roll);

        const degrades = roll.total === 1;
        const nextDie = degrades ? this.getNextDurabilityDie(currentDie) : currentDie;
        if (nextDie === "damaged") await this.markItemDamaged(item);
        else if (degrades) await this.setItemDurabilityDie(item, nextDie);

        const resultClass = degrades ? "rg-status-zero" : "rg-status-full";
        const outcome = degrades
            ? (nextDie === "damaged" ? "Damaged. Apply the item's penalty until repaired." : `Degraded. Durability Die is now ${nextDie}.`)
            : "Stable. No change.";
        const itemName = this.escapeHTML(this.getCleanItemName(item));
        const reasonText = this.escapeHTML(reason);
        const rollerName = this.escapeHTML(options.rollerName || game.user?.name || "Unknown User");
        const rollMode = this.escapeHTML(options.rollMode || "Character use");

        const chatContent = `
            <div class="rawgrim-sys-card integrity">
                <h4 class="rawgrim-card-title">Durability Die Roll</h4>
                <p class="rawgrim-card-sub"><strong>${itemName}</strong> is tested. ${reasonText}</p>
                <p class="rawgrim-card-note">Rolled by: <strong>${rollerName}</strong> (${rollMode}).</p>
                <table class="rawgrim-table-compact">
                    <thead><tr><th>Before</th><th>Roll</th><th>After</th></tr></thead>
                    <tbody><tr><td>${currentDie}</td><td class="${resultClass}">${roll.total}</td><td>${nextDie === "damaged" ? "Damaged" : nextDie}</td></tr></tbody>
                </table>
                <p class="rawgrim-card-note ${resultClass}">Resolution: ${outcome}</p>
            </div>
        `;

        await ChatMessage.create({ content: chatContent, speaker: ChatMessage.getSpeaker({ actor }) });
        this.refreshOpenGMDashboards?.();
    },

    async kirimPermintaanRollDurability(actor, item, reason = "GM request") {
        if (!actor || !item) return;
        const currentDie = this.getItemDurabilityDie(item);
        if (!currentDie || currentDie === "damaged") return;
        const itemName = this.escapeHTML(this.getCleanItemName(item));
        const reasonText = this.escapeHTML(reason);

        const chatContent = `
            <div class="rawgrim-durability-roll-card" data-actor-id="${actor.id}" data-item-id="${item.id}" data-reason="${encodeURIComponent(reason)}">
                <h4 class="rawgrim-card-title">Durability Die Roll</h4>
                <p class="rawgrim-card-sub"><strong>${itemName}</strong> must be tested.</p>
                <table class="rawgrim-table-compact">
                    <thead><tr><th>Reason</th><th>Current Die</th></tr></thead>
                    <tbody><tr><td>${reasonText}</td><td>${currentDie}</td></tr></tbody>
                </table>
                <p class="rawgrim-card-note">Private request: the actor owner or GM presses the roll button.</p>
                <button type="button" class="rg-durability-roll-btn rawgrim-btn-flat"><i class="fas fa-dice"></i> Roll Durability</button>
            </div>
        `;

        await ChatMessage.create({
            content: chatContent,
            whisper: this.getActorOwnerAndGMUserIds(actor),
            speaker: ChatMessage.getSpeaker({ actor })
        });
    },

    async kirimPermintaanRollLingeringInjury(actor, reason = "GM confirmed injury trigger") {
        if (!actor) return;

        const chatContent = `
            <div class="rawgrim-injury-roll-card" data-actor-id="${actor.id}" data-reason="${encodeURIComponent(reason)}">
                <h4 class="rawgrim-card-title">Lingering Injury Check</h4>
                <p class="rawgrim-card-sub"><strong>${actor.name}</strong> may suffer a lasting injury.</p>
                <table class="rawgrim-table-compact">
                    <thead><tr><th>Trigger</th><th>Roll</th></tr></thead>
                    <tbody><tr><td>${reason}</td><td>1d20</td></tr></tbody>
                </table>
                <p class="rawgrim-card-note">Private request: the actor owner or GM rolls. The GM decides and records the injury; no automatic penalty is applied.</p>
                <button type="button" class="rg-injury-roll-btn rawgrim-btn-flat"><i class="fas fa-dice-d20"></i> Roll Injury</button>
            </div>
        `;

        await ChatMessage.create({
            content: chatContent,
            whisper: this.getActorOwnerAndGMUserIds(actor),
            speaker: ChatMessage.getSpeaker({ actor })
        });
    },

    async rollLingeringInjury(actor, reason = "GM confirmed injury trigger", options = {}) {
        if (!actor) return;
        const roll = await new Roll("1d20").evaluate();
        await this.showDiceSoNiceRoll(roll);

        const severity = roll.total <= 5 ? "Severe" : (roll.total <= 12 ? "Moderate" : "Minor");
        const chatContent = `
            <div class="rawgrim-sys-card injury">
                <h4 class="rawgrim-card-title">Lingering Injury Roll</h4>
                <p class="rawgrim-card-sub"><strong>${actor.name}</strong> rolls for a possible lingering injury.</p>
                <p class="rawgrim-card-note">Rolled by: <strong>${options.rollerName || game.user?.name || "Unknown User"}</strong> (${options.rollMode || "Character use"}).</p>
                <table class="rawgrim-table-compact">
                    <thead><tr><th>Trigger</th><th>Roll</th><th>Severity</th></tr></thead>
                    <tbody><tr><td>${reason}</td><td>${roll.total}</td><td>${severity}</td></tr></tbody>
                </table>
                <p class="rawgrim-card-note">GM chooses the final injury and records it from the dashboard.</p>
            </div>
        `;

        await ChatMessage.create({ content: chatContent, speaker: ChatMessage.getSpeaker({ actor }) });
    },

    async createLingeringInjuryRecordMessage(actor, injury) {
        const chatContent = `
            <div class="rawgrim-sys-card injury">
                <h4 class="rawgrim-card-title">Lingering Injury Recorded</h4>
                <p class="rawgrim-card-sub"><strong>${actor.name}</strong> suffers a lasting injury.</p>
                <table class="rawgrim-table-compact">
                    <thead><tr><th>Trigger</th><th>Injury</th></tr></thead>
                    <tbody><tr><td>${injury.reason}</td><td>${injury.description}</td></tr></tbody>
                </table>
                <p class="rawgrim-card-note">No automatic penalty was applied. Resolve the effect manually at the table.</p>
            </div>
        `;

        await ChatMessage.create({ content: chatContent, speaker: ChatMessage.getSpeaker({ actor }) });
    },

    tampilkanCinematicNotice(title, message, iconClass = 'fas fa-exclamation-triangle', duration = 3200) {
        const oldNotice = document.getElementById('rawgrim-cinematic-notice');
        if (oldNotice) oldNotice.remove();

        const notice = document.createElement('div');
        notice.id = 'rawgrim-cinematic-notice';
        notice.innerHTML = `
            <div class="rawgrim-shatter-box">
                <div class="rawgrim-shatter-icon"><i class="${iconClass}"></i></div>
                <h1 class="rawgrim-shatter-title">${title}</h1>
                <p class="rawgrim-shatter-text">${message}</p>
            </div>
        `;

        document.body.appendChild(notice);
        setTimeout(() => { notice.style.opacity = '1'; }, 50);
        setTimeout(() => {
            notice.style.opacity = '0';
            setTimeout(() => { notice.remove(); }, 400);
        }, duration);
    },

    tampilkanPeringatanLayarTengah(actorName, spellName) {
        const oldSplash = document.getElementById('rawgrim-cinematic-splash');
        if (oldSplash) oldSplash.remove();

        const splashContainer = document.createElement('div');
        splashContainer.id = 'rawgrim-cinematic-splash';

        splashContainer.innerHTML = `
            <div class="rawgrim-shatter-box">
                <div class="rawgrim-shatter-icon"><i class="fas fa-ban"></i></div>
                <h1 class="rawgrim-shatter-title">The Arcane Refuses to Rise</h1>
                <p class="rawgrim-shatter-text">${actorName} needs an active Material Catalyst to cast ${spellName}.</p>
            </div>
        `;

        document.body.appendChild(splashContainer);
        setTimeout(() => { splashContainer.style.opacity = '1'; }, 50);
        setTimeout(() => { 
            splashContainer.style.opacity = '0'; 
            setTimeout(() => { splashContainer.remove(); }, 400);
        }, 2600);
    },

    async eksekusiUjiDaduKatalis(actor, pemicuSebab = "1st-level spell or higher", options = {}) {
        const catalystItem = this.getActiveCatalyst(actor);
        if (!catalystItem) return;

        let currentDie = catalystItem.getFlag('rawgrim-toll-of-survival', 'usageDie') || 'd8';
        if (currentDie === 'expended') return;

        const roll = await new Roll(`1${currentDie}`).evaluate();
        await this.showDiceSoNiceRoll(roll);
        const isDegraded = roll.total <= 2;
        let nextDie = currentDie;

        if (isDegraded) {
            nextDie = this.getNextCatalystDie(currentDie);
        }

        const resultClass = isDegraded ? 'rg-status-zero' : 'rg-status-full';
        const nextDieDisplay = nextDie === 'expended' ? 'Expended' : nextDie;
        let resolusiTeks = isDegraded 
            ? (nextDie === 'expended' ? 'Expended. The catalyst crumbles into ash.' : `Degraded. The usage die is now ${nextDie}.`)
            : 'Stable. The catalyst is not degraded.';
        const rollerName = options.rollerName || game.user?.name || "Unknown User";
        const rollMode = options.rollMode || "Character use";

        const chatContent = `
            <div class="rawgrim-sys-card catalyst">
                <h4 class="rawgrim-card-title">Catalyst Usage Die Roll</h4>
                <p class="rawgrim-card-sub">Triggered by: <strong>${pemicuSebab}</strong></p>
                <p class="rawgrim-card-note">Rolled by: <strong>${rollerName}</strong> (${rollMode}).</p>
                <table class="rawgrim-table-compact">
                    <thead><tr><th>Before</th><th>Roll</th><th>After</th></tr></thead>
                    <tbody><tr><td>${currentDie}</td><td class="${resultClass}">${roll.total}</td><td>${isDegraded ? nextDieDisplay : currentDie}</td></tr></tbody>
                </table>
                <p class="rawgrim-card-note ${resultClass}">
                    Resolution: ${resolusiTeks}
                </p>
            </div>
        `;

        await ChatMessage.create({ content: chatContent, speaker: ChatMessage.getSpeaker({ actor }) });

        if (nextDie === 'expended') {
            await catalystItem.delete();
            ui.notifications.warn(`${actor.name}'s Material Catalyst has been completely expended.`);
        } else {
            await catalystItem.setFlag('rawgrim-toll-of-survival', 'usageDie', nextDie);
            await catalystItem.update({ name: `Material Catalyst (${nextDie})` });
        }
    }
});
