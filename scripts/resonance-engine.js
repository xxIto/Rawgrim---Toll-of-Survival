/**
 * Rawgrim: The Toll of Survival
 * Module 3: Soul Resonance & Backlash Card Engine (Version 14.5)
 */

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

globalThis.RawgrimSurvival.prosesKegagalanBacklashAktor = async function(actor) {
    if (!actor) return;
    
    const currentFailures = actor.getFlag('rawgrim-toll-of-survival', 'backlashFailures') || 0;
    const oldStage = globalThis.RawgrimSurvival.getBacklashStageName(currentFailures);
    
    const newFailures = currentFailures + 1;
    const newStage = globalThis.RawgrimSurvival.getBacklashStageName(newFailures);
    await actor.setFlag('rawgrim-toll-of-survival', 'backlashFailures', newFailures);
    
    let markContent = `
        <div class="rawgrim-sys-card" style="border-top-color: #541e1e !important;">
            <p class="rawgrim-card-sub" style="color: #bf3f3f; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 1px;">The Marks Advance.</p>
            <p class="rawgrim-card-sub" style="margin: 4px 0 0 0;">${actor.name} accumulates a new mark of corruption. Total Failed Backlashes: <strong>${newFailures}</strong> [${newStage}].</p>
        </div>
    `;
    await ChatMessage.create({ content: markContent, speaker: { alias: 'Laws of Rawgrim' } });

    if (oldStage !== newStage) {
        const prosthetics = actor.items.filter(i => i?.name?.toLowerCase()?.includes('prosthetic'));
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

        if (itemLockedCount > 0) {
            await actor.prepareData();
            if (actor.sheet?.rendered) actor.sheet.render(false);

            globalThis.RawgrimSurvival.tampilkanShatterLayarTengah();

            let transitionContent = `
                <div class="rawgrim-backlash-prompt-card" style="border-top-color: #8c2222 !important;">
                    <h3 class="rawgrim-card-title" style="color: #bf3f3f !important;">Stage Transition: Overload</h3>
                    <p class="rawgrim-card-sub">As ${actor.name}'s corruptive marks advance from <strong>${oldStage}</strong> to <strong>${newStage}</strong>, all installed iron mechanisms enter immediate breakdown.</p>
                    <p class="rawgrim-card-sub" style="font-weight: bold; color: #bf3f3f; margin: 4px 0 0 0;"><i class="fas fa-link-slash"></i> Total Mechanisms Extinguished: ${itemLockedCount}</p>
                </div>
            `;
            await ChatMessage.create({ content: transitionContent, speaker: { alias: 'Arcane Detonation' } });
        }
    }
};

globalThis.RawgrimSurvival.pemicuPeringatanBacklashGM = async function(actor, totalRP, threshold) {
    const chatContent = `
        <div class="rawgrim-backlash-prompt-card" data-actor-id="${actor.id}" data-total-rp="${totalRP}" data-threshold="${threshold}">
            <h3 class="rawgrim-card-title">Arcane Overload Impending</h3>
            <p class="rawgrim-card-sub">The spellcaster's vessel strains under ambient pressure. Arcane Resonance has violated the structural threshold of the flesh.</p>
            
            <table class="rawgrim-table-compact">
                <thead><tr><th>Accumulated Score (DC)</th><th>Threshold Limit</th></tr></thead>
                <tbody><tr><td style="color: #bf3f3f;">${totalRP} RP</td><td>${threshold} RP</td></tr></tbody>
            </table>
            
            <div class="gm-only-controls rawgrim-gm-grid">
                <button class="rg-vtt-roll-btn rawgrim-btn-flat"><i class="fas fa-dice-d20"></i> Roll Contained Check</button>
                <div style="display: flex; gap: 4px; width: 100%;">
                    <button class="rg-manual-fail-btn rawgrim-btn-flat rawgrim-btn-danger-flat" style="flex: 1;"><i class="fas fa-skull"></i> Enforce Failure</button>
                    <button class="rg-manual-pass-btn rawgrim-btn-flat rawgrim-btn-success-flat" style="flex: 1;"><i class="fas fa-check"></i> Absolve</button>
                </div>
            </div>
        </div>
    `;
    await ChatMessage.create({ content: chatContent, speaker: { alias: 'Laws of Rawgrim' } });
};

globalThis.RawgrimSurvival.prosesResonansiMantraSINKRON = async function(actor, item, config, options) {
    let tingkatSlotMantra = item.system?.level ?? 0;
    if (config && typeof config === 'object') {
        if (config.spellLevel !== undefined) tingkatSlotMantra = config.spellLevel;
        else if (config.slotLevel !== undefined) tingkatSlotMantra = config.slotLevel;
        else if (config.level !== undefined) tingkatSlotMantra = config.level;
    }

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
            content: `<div class="rawgrim-sys-card" style="border-top-color: #2d261f !important;"><p class="rawgrim-card-sub" style="margin:0; text-align:center;"><strong>Resonance Update:</strong> ${actor.name} (+${rpMasuk} RP for Slot Level ${tingkatSlotMantra}) | Total: ${newRP}/${threshold} RP</p></div>`,
            whisper: gmIds, speaker: { alias: 'System Telemetry' }
        });
    }

    if (newRP >= threshold) {
        await this.pemicuPeringatanBacklashGM(actor, newRP, threshold);
    }
};

Hooks.on('renderChatMessage', (message, html, data) => {
    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

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

    card.querySelector('.rg-vtt-roll-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const roll = await new Roll("1d20").evaluate();
        const isBacklash = roll.total < totalRP;
        
        let resolusiText = isBacklash 
            ? `<span style="color: #bf3f3f; font-weight: bold;">CRITICAL BREAKDOWN</span><br/>The caster loses control. Consult the secret Breakdown Table.`
            : `<span style="color: #3fbf3f; font-weight: bold;">STABILIZED</span><br/>The containment holds. Corruption restrained.`;

        await ChatMessage.create({
            content: `<div class="rawgrim-sys-card" style="border-top-color: ${isBacklash ? '#541e1e' : '#1b4224'} !important;"><p class="rawgrim-card-sub" style="margin:0; text-align:center;">Result: <strong>${roll.total}</strong> (vs Target ${totalRP})</p><hr style="border-top:1px solid #1c1815; margin:4px 0;"/><p class="rawgrim-card-sub" style="margin:0; text-align:center;">${resolusiText}</p></div>`,
            speaker: { alias: 'Laws of Rawgrim' }
        });

        const sisaRP = isBacklash ? Math.max(0, totalRP - threshold) : totalRP;
        await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', sisaRP);
        if (isBacklash) await globalThis.RawgrimSurvival.prosesKegagalanBacklashAktor(actor);
        card.querySelector('.gm-only-controls')?.remove();
    });

    card.querySelector('.rg-manual-fail-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await ChatMessage.create({
            content: `<div class="rawgrim-sys-card" style="border-top-color:#541e1e !important;"><p class="rawgrim-card-sub" style="margin:0; color:#bf3f3f; text-align:center;"><strong>Manual Resolution:</strong> ${actor.name} fails by DM decree. Open the Breakdown Ledger.</p></div>`,
            speaker: { alias: 'Laws of Rawgrim' }
        });
        const sisaRP = Math.max(0, totalRP - threshold);
        await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', sisaRP);
        await globalThis.RawgrimSurvival.prosesKegagalanBacklashAktor(actor);
        card.querySelector('.gm-only-controls')?.remove();
    });

    card.querySelector('.rg-manual-pass-btn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await ChatMessage.create({
            content: `<div class="rawgrim-sys-card" style="border-top-color:#1b4224 !important;"><p class="rawgrim-card-sub" style="margin:0; color:#3fbf3f; text-align:center;"><strong>Manual Resolution:</strong> ${actor.name} endures the overload by DM decree.</p></div>`,
            speaker: { alias: 'Laws of Rawgrim' }
        });
        card.querySelector('.gm-only-controls')?.remove();
    });
});