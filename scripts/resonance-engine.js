globalThis.RawgrimSurvival = globalThis.RawgrimSurvival || {};

globalThis.RawgrimSurvival.tampilkanShatterLayarTengah = function() {
    const oldOverlay = document.getElementById('rawgrim-shatter-overlay');
    if (oldOverlay) oldOverlay.remove();

    const overlay = document.createElement('div');
    overlay.id = 'rawgrim-shatter-overlay';
    overlay.innerHTML = `
        <div class="rawgrim-shatter-box">
            <div class="rawgrim-shatter-icon"><i class="fas fa-link-slash"></i></div>
            <h1 class="rawgrim-shatter-title">Your Prosthetic is Broken</h1>
            <p class="rawgrim-shatter-text">The artificial mechanism splinters. All tactical benefits have ceased.</p>
        </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => { overlay.style.opacity = '1'; }, 10);
    
    setTimeout(() => { 
        overlay.style.opacity = '0'; 
        setTimeout(() => { overlay.remove(); }, 300);
    }, 3500);
};

globalThis.RawgrimSurvival.applyMarksAdvance = async function(actor, options = {}) {
    if (!actor) return;

    const reason = options.reason || "Backlash failure";
    const source = options.source || "Laws of Rawgrim";
    const showCinematic = options.showCinematic !== false;
    const overloadProsthetics = options.overloadProsthetics !== false;
    const marksResult = await globalThis.RawgrimSurvival.advanceActorMarks(actor);
    const oldStage = marksResult.oldState.stageName;
    const newStage = marksResult.newState.stageName;
    const stageLimit = marksResult.newState.stageLimit ? `/${marksResult.newState.stageLimit}` : "";
    const escapedReason = foundry.utils.escapeHTML
        ? foundry.utils.escapeHTML(reason)
        : String(reason).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    
    let markContent = `
        <div class="rawgrim-sys-card marks">
            <h4 class="rawgrim-card-title">The Marks Advance</h4>
            <p class="rawgrim-card-sub"><strong>${actor.name}</strong> gains a mark of corruption.</p>
            <table class="rawgrim-table-compact">
                <thead><tr><th>Trigger</th><th>Stage</th><th>Marks</th></tr></thead>
                <tbody><tr><td>${escapedReason}</td><td>${newStage}</td><td>${marksResult.newState.stageCount}${stageLimit}</td></tr></tbody>
            </table>
            <p class="rawgrim-card-note">${marksResult.newState.stageDescription}</p>
            ${marksResult.nearTransition ? `<p class="rawgrim-card-note rg-status-warning"><strong>Warning:</strong> only a few marks remain before the next stage.</p>` : ""}
        </div>
    `;
    await ChatMessage.create({ content: markContent, speaker: { alias: source } });

    if (marksResult.stageChanged) {
        if (showCinematic) globalThis.RawgrimSurvival.tampilkanCinematicNotice?.(
            "Stage Transition: Overload",
            `${actor.name}'s corruption advances to ${newStage}.`,
            "fas fa-burst"
        );

        const prosthetics = overloadProsthetics ? globalThis.RawgrimSurvival.getActorProsthetics(actor) : [];
        let itemLockedCount = 0;

        for (let item of prosthetics) {
            const alreadyOverloaded = item.getFlag('rawgrim-toll-of-survival', 'isOverloaded') || false;
            if (!alreadyOverloaded) {
                const wasEquipped = item.system?.equipped || false;
                const originalAttunement = item.system?.attunement || 0;
                
                await item.setFlag('rawgrim-toll-of-survival', 'isOverloaded', true);
                await item.setFlag('rawgrim-toll-of-survival', 'wasEquipped', wasEquipped);
                await item.setFlag('rawgrim-toll-of-survival', 'originalAttunement', originalAttunement);
                
                await item.update({ 
                    name: `[OVERLOADED] ${item.name}`,
                    "system.equipped": false,
                    "system.attunement": 0
                });
                
                if (item.effects && item.effects.size > 0) {
                    for (let effect of item.effects) {
                        await effect.update({ disabled: true });
                    }
                }
                itemLockedCount++;
            }
        }

        const transitionContent = `
            <div class="rawgrim-sys-card marks">
                <h3 class="rawgrim-card-title">Stage Transition: Overload</h3>
                <p class="rawgrim-card-sub"><strong>${actor.name}</strong> advances from ${oldStage} to ${newStage}.</p>
                <p class="rawgrim-card-note"><i class="fas fa-link-slash"></i> Overloaded mechanisms: ${itemLockedCount}.</p>
            </div>
        `;
        await ChatMessage.create({ content: transitionContent, speaker: { alias: 'Arcane Detonation' } });

        if (itemLockedCount > 0) {
            await actor.prepareData();
            if (actor.sheet?.rendered) actor.sheet.render(false);

            globalThis.RawgrimSurvival.tampilkanShatterLayarTengah();
        }
    }

    return marksResult;
};

globalThis.RawgrimSurvival.prosesKegagalanBacklashAktor = async function(actor) {
    return globalThis.RawgrimSurvival.applyMarksAdvance(actor, {
        reason: "Backlash failure",
        source: "Laws of Rawgrim",
        showCinematic: true,
        overloadProsthetics: true
    });
};

globalThis.RawgrimSurvival.pemicuPeringatanBacklashGM = async function(actor, totalRP, threshold) {
    const safeActorName = this.escapeHTML(actor?.name || "Unknown Actor");
    const chatContent = `
        <div class="rawgrim-backlash-prompt-card" data-actor-id="${actor.id}" data-total-rp="${totalRP}" data-threshold="${threshold}">
            <h3 class="rawgrim-card-title">Arcane Overload</h3>
            <p class="rawgrim-card-sub"><strong>${safeActorName}</strong> has more Resonance Points than their body can safely hold.</p>
            
            <table class="rawgrim-table-compact">
                <thead><tr><th>Current RP</th><th>Limit</th></tr></thead>
                <tbody><tr><td style="color: #bf3f3f;">${totalRP}</td><td>${threshold}</td></tr></tbody>
            </table>
            
            <div class="gm-only-controls rawgrim-gm-grid">
                <button class="rg-vtt-roll-btn rawgrim-btn-flat"><i class="fas fa-dice-d20"></i> Roll Control Check</button>
                <div style="display: flex; gap: 4px; width: 100%;">
                    <button class="rg-manual-fail-btn rawgrim-btn-flat rawgrim-btn-danger-flat" style="flex: 1;"><i class="fas fa-skull"></i> Backlash</button>
                    <button class="rg-manual-pass-btn rawgrim-btn-flat rawgrim-btn-success-flat" style="flex: 1;"><i class="fas fa-check"></i> Contain</button>
                </div>
            </div>
        </div>
    `;
    await ChatMessage.create({ content: chatContent, whisper: this.getGMUserIds(), speaker: { alias: 'Laws of Rawgrim' } });
};

globalThis.RawgrimSurvival.prosesResonansiMantraSINKRON = async function(actor, item, config, options, result = null) {
    let tingkatSlotMantra = this.getSpellCastLevel(actor, item, config, options, result);

    if (tingkatSlotMantra === 0) return;

    const cooldownKey = `rawgrim_sinkron_rp_cd_${actor.id}_${item.id}`;
    if (globalThis[cooldownKey]) return;
    globalThis[cooldownKey] = true;
    setTimeout(() => { globalThis[cooldownKey] = false; }, 500);

    const multiplier = game.settings.get('rawgrim-toll-of-survival', 'resonanceMultiplier') || 2;
    const rpMasuk = tingkatSlotMantra * multiplier; 
    
    const currentRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || 0;
    const newRP = currentRP + rpMasuk;
    const threshold = this.getResonanceThreshold(actor);

    await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', newRP);

    const gmIds = game.users.filter(u => u.isGM).map(u => u.id);
    if (gmIds.length > 0) {
        await ChatMessage.create({
            content: `
                <div class="rawgrim-sys-card" style="border-top-color: #2d261f !important;">
                    <h4 class="rawgrim-card-title">Resonance Update</h4>
                    <p class="rawgrim-card-sub"><strong>${actor.name}</strong> gains ${rpMasuk} RP from a level ${tingkatSlotMantra} spell.</p>
                    <table class="rawgrim-table-compact">
                        <thead><tr><th>Added</th><th>Total</th></tr></thead>
                        <tbody><tr><td>${rpMasuk} RP</td><td>${newRP}/${threshold} RP</td></tr></tbody>
                    </table>
                </div>
            `,
            whisper: gmIds, speaker: { alias: 'System Telemetry' }
        });
    }

    await this.checkAndPromptOverload(actor, newRP);
};

globalThis.RawgrimSurvival.kirimPermintaanRollCantrip = async function(actor) {
    if (!actor) return;

    const playerOwners = game.users
        .filter(user => !user.isGM && actor.testUserPermission(user, "OWNER"))
        .map(user => user.id);

    const whisper = playerOwners.length > 0
        ? playerOwners.concat(game.users.filter(user => user.isGM).map(user => user.id))
        : game.users.filter(user => user.isGM).map(user => user.id);

    const chatContent = `
        <div class="rawgrim-cantrip-roll-card" data-actor-id="${actor.id}">
            <h4 class="rawgrim-card-title">Minor Magic Strain</h4>
            <p class="rawgrim-card-sub"><strong>${actor.name}</strong> has used enough minor magic to risk Resonance buildup.</p>
            <p class="rawgrim-card-note">Private request: only the actor owner and GM can see this prompt. Roll 1d6. On a 1, gain 1 RP.</p>
            <button type="button" class="rg-cantrip-roll-btn rawgrim-btn-flat"><i class="fas fa-dice-d6"></i> Roll Strain Check</button>
        </div>
    `;

    await ChatMessage.create({
        content: chatContent,
        whisper,
        speaker: { alias: 'Laws of Rawgrim' }
    });
};

Hooks.on('renderChatMessage', (message, html, data) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    const catalystCard = root.querySelector('.rawgrim-catalyst-roll-card');
    if (catalystCard) {
        const actorId = catalystCard.getAttribute('data-actor-id');
        const trigger = decodeURIComponent(catalystCard.getAttribute('data-trigger') || "1st-level%20spell%20or%20higher");
        const actor = game.actors.get(actorId);
        if (!actor) return;

        const canRoll = game.user.isGM || actor.testUserPermission(game.user, "OWNER");
        if (!canRoll) {
            catalystCard.querySelector('.rg-catalyst-roll-btn')?.remove();
            return;
        }

        catalystCard.querySelector('.rg-catalyst-roll-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const button = e.currentTarget;
            button.disabled = true;
            await globalThis.RawgrimSurvival.eksekusiUjiDaduKatalis(actor, trigger, {
                rollerName: game.user?.name,
                rollMode: game.user.isGM ? "GM confirmed roll" : "Character use"
            });
            button.remove();
        });
        return;
    }

    const durabilityCard = root.querySelector('.rawgrim-durability-roll-card');
    if (durabilityCard) {
        const actorId = durabilityCard.getAttribute('data-actor-id');
        const itemId = durabilityCard.getAttribute('data-item-id');
        const reason = decodeURIComponent(durabilityCard.getAttribute('data-reason') || "GM%20request");
        const actor = game.actors.get(actorId);
        const item = actor?.items?.get(itemId);
        if (!actor || !item) return;

        const canRoll = game.user.isGM || actor.testUserPermission(game.user, "OWNER");
        if (!canRoll) {
            durabilityCard.querySelector('.rg-durability-roll-btn')?.remove();
            return;
        }

        durabilityCard.querySelector('.rg-durability-roll-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const button = e.currentTarget;
            button.disabled = true;
            await globalThis.RawgrimSurvival.rollItemDurability(actor, item, reason, {
                rollerName: game.user?.name,
                rollMode: game.user.isGM ? "GM confirmed roll" : "Character use"
            });
            button.remove();
        });
        return;
    }

    const injuryCard = root.querySelector('.rawgrim-injury-roll-card');
    if (injuryCard) {
        const actorId = injuryCard.getAttribute('data-actor-id');
        const reason = decodeURIComponent(injuryCard.getAttribute('data-reason') || "GM%20confirmed%20injury%20trigger");
        const actor = game.actors.get(actorId);
        if (!actor) return;

        const canRoll = game.user.isGM || actor.testUserPermission(game.user, "OWNER");
        if (!canRoll) {
            injuryCard.querySelector('.rg-injury-roll-btn')?.remove();
            return;
        }

        injuryCard.querySelector('.rg-injury-roll-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const button = e.currentTarget;
            button.disabled = true;
            await globalThis.RawgrimSurvival.rollLingeringInjury(actor, reason, {
                rollerName: game.user?.name,
                rollMode: game.user.isGM ? "GM confirmed roll" : "Character use"
            });
            button.remove();
        });
        return;
    }

    const cantripCard = root.querySelector('.rawgrim-cantrip-roll-card');
    if (cantripCard) {
        const actorId = cantripCard.getAttribute('data-actor-id');
        const actor = game.actors.get(actorId);
        if (!actor) return;

        const canRoll = game.user.isGM || actor.testUserPermission(game.user, "OWNER");
        if (!canRoll) {
            cantripCard.querySelector('.rg-cantrip-roll-btn')?.remove();
            return;
        }

        cantripCard.querySelector('.rg-cantrip-roll-btn')?.addEventListener('click', async (e) => {
            e.preventDefault();
            const button = e.currentTarget;
            button.disabled = true;
            const roll = await new Roll("1d6").evaluate();
            await globalThis.RawgrimSurvival.showDiceSoNiceRoll(roll);
            const currentRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || 0;
            const gainsRP = roll.total === 1;
            const newRP = gainsRP ? currentRP + 1 : currentRP;
            if (gainsRP) await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', newRP);
            await actor.setFlag('rawgrim-toll-of-survival', 'cantripCounter', 0);
            if (gainsRP) await globalThis.RawgrimSurvival.checkAndPromptOverload(actor, newRP);

            await ChatMessage.create({
                content: `
                    <div class="rawgrim-sys-card" style="border-top-color: ${gainsRP ? '#541e1e' : '#1b4224'} !important;">
                        <h4 class="rawgrim-card-title">Minor Magic Strain</h4>
                        <p class="rawgrim-card-sub"><strong>${actor.name}</strong> rolls ${roll.total} on the strain check.</p>
                        <p class="rawgrim-card-note">Public result.</p>
                        <table class="rawgrim-table-compact">
                            <thead><tr><th>Result</th><th>RP</th></tr></thead>
                            <tbody><tr><td>${gainsRP ? '+1 RP' : 'No RP'}</td><td>${newRP}</td></tr></tbody>
                        </table>
                    </div>
                `,
                speaker: { alias: 'Laws of Rawgrim' }
            });

            cantripCard.querySelector('.rg-cantrip-roll-btn')?.remove();
            globalThis.RawgrimSurvival.refreshOpenGMDashboards?.();
        });
        return;
    }

    const card = root.querySelector('.rawgrim-backlash-prompt-card');
    if (!card) return;

    if (!game.user.isGM) {
        root.querySelectorAll('.gm-only-controls').forEach(el => el.remove());
        return;
    }

    const actorId = card.getAttribute('data-actor-id');
    const totalRP = parseInt(card.getAttribute('data-total-rp')) || 0;
    const threshold = parseInt(card.getAttribute('data-threshold')) || 0;
    const actor = game.actors.get(actorId);
    if (!actor) return;

    const stopIfAlreadyStable = async () => {
        const activeTotalRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || 0;
        const activeThreshold = globalThis.RawgrimSurvival.getResonanceThreshold(actor) || threshold;
        if (activeTotalRP >= activeThreshold) return false;

        await globalThis.RawgrimSurvival.clearPendingOverload(actor);
        ui.notifications.info(`${actor.name}: overload is already stable.`);
        card.querySelector('.gm-only-controls')?.remove();
        globalThis.RawgrimSurvival.refreshOpenGMDashboards?.();
        return true;
    };

    card.querySelector('.rg-vtt-roll-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (await stopIfAlreadyStable()) return;
        const controls = card.querySelector('.gm-only-controls');
        controls?.querySelectorAll('button').forEach(button => { button.disabled = true; });
        const activeTotalRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || totalRP;
        const activeThreshold = globalThis.RawgrimSurvival.getResonanceThreshold(actor) || threshold;
        const roll = await new Roll("1d20").evaluate();
        await globalThis.RawgrimSurvival.showDiceSoNiceRoll(roll);
        const isBacklash = roll.total < activeTotalRP;
        const newRP = isBacklash
            ? globalThis.RawgrimSurvival.getReleasedResonance(activeTotalRP, activeThreshold)
            : globalThis.RawgrimSurvival.getContainedResonance(activeTotalRP, activeThreshold);

        await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', newRP);
        await globalThis.RawgrimSurvival.clearPendingOverload(actor);
        await globalThis.RawgrimSurvival.createResonanceResolutionMessage(actor, isBacklash ? "Backlash Failure" : "Overload Contained", {
            before: activeTotalRP,
            after: newRP,
            borderColor: isBacklash ? '#541e1e' : '#1b4224',
            message: isBacklash ? "fails to control the overload. The excess resonance is released as backlash." : "contains the overload. Their Resonance Points fall below the limit.",
            note: `Control check: ${roll.total} vs ${activeTotalRP}.`
        });

        if (isBacklash) await globalThis.RawgrimSurvival.prosesKegagalanBacklashAktor(actor);
        card.querySelector('.gm-only-controls')?.remove();
        globalThis.RawgrimSurvival.refreshOpenGMDashboards?.();
    });

    card.querySelector('.rg-manual-fail-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (await stopIfAlreadyStable()) return;
        const controls = card.querySelector('.gm-only-controls');
        controls?.querySelectorAll('button').forEach(button => { button.disabled = true; });
        const activeTotalRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || totalRP;
        const activeThreshold = globalThis.RawgrimSurvival.getResonanceThreshold(actor) || threshold;
        const newRP = globalThis.RawgrimSurvival.getReleasedResonance(activeTotalRP, activeThreshold);
        await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', newRP);
        await globalThis.RawgrimSurvival.clearPendingOverload(actor);
        await globalThis.RawgrimSurvival.createResonanceResolutionMessage(actor, "Backlash Failure", {
            before: activeTotalRP,
            after: newRP,
            borderColor: '#541e1e',
            message: "fails to control the overload. The excess resonance is released as backlash.",
            note: "Resolved by the GM."
        });
        await globalThis.RawgrimSurvival.prosesKegagalanBacklashAktor(actor);
        card.querySelector('.gm-only-controls')?.remove();
        globalThis.RawgrimSurvival.refreshOpenGMDashboards?.();
    });

    card.querySelector('.rg-manual-pass-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        if (await stopIfAlreadyStable()) return;
        const controls = card.querySelector('.gm-only-controls');
        controls?.querySelectorAll('button').forEach(button => { button.disabled = true; });
        const activeTotalRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || totalRP;
        const activeThreshold = globalThis.RawgrimSurvival.getResonanceThreshold(actor) || threshold;
        const newRP = globalThis.RawgrimSurvival.getContainedResonance(activeTotalRP, activeThreshold);
        await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', newRP);
        await globalThis.RawgrimSurvival.clearPendingOverload(actor);
        await globalThis.RawgrimSurvival.createResonanceResolutionMessage(actor, "Overload Contained", {
            before: activeTotalRP,
            after: newRP,
            borderColor: '#1b4224',
            message: "contains the overload. Their Resonance Points fall below the limit.",
            note: "Resolved by the GM."
        });
        card.querySelector('.gm-only-controls')?.remove();
        globalThis.RawgrimSurvival.refreshOpenGMDashboards?.();
    });
});
