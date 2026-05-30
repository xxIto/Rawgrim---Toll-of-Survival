/**
 * Rawgrim: The Toll of Survival
 * Module 4: Rest Decay Management (Version 14.5)
 */

globalThis.RawgrimSurvival = globalThis.RawgrimSurvival || {};

Hooks.on("dnd5e.shortRest", async (actor, result) => {
    if (actor.type !== "character") return;
    const actorName = globalThis.RawgrimSurvival.escapeHTML?.(actor.name) || actor.name;
    const cantripCounter = actor.getFlag('rawgrim-toll-of-survival', 'cantripCounter') || 0;
    if (cantripCounter > 0) {
        await actor.setFlag('rawgrim-toll-of-survival', 'cantripCounter', 0);
    }

    const currentRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || 0;
    if (currentRP === 0) {
        await globalThis.RawgrimSurvival.clearPendingOverload?.(actor);
        return;
    }

    const newRP = Math.max(0, currentRP - 5);
    await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', newRP);
    await globalThis.RawgrimSurvival.checkAndPromptOverload?.(actor, newRP);

    const chatContent = `
        <div class="rawgrim-sys-card rest-short">
            <h4 class="rawgrim-card-title">Resonance Mitigation</h4>
            <p class="rawgrim-card-sub"><strong>${actorName}</strong> settles their breathing and lets a little Resonance fade.</p>
            <table class="rawgrim-table-compact">
                <thead><tr><th>Before</th><th>Current</th></tr></thead>
                <tbody><tr><td>${currentRP} RP</td><td style="color:#2a3d4a;">${newRP} RP</td></tr></tbody>
            </table>
        </div>
    `;
    await ChatMessage.create({ content: chatContent, speaker: { alias: "Laws of Rawgrim" } });
});

Hooks.on("dnd5e.longRest", async (actor, result) => {
    if (actor.type !== "character") return;
    const actorName = globalThis.RawgrimSurvival.escapeHTML?.(actor.name) || actor.name;
    const currentRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || 0;
    if (currentRP === 0) {
        await globalThis.RawgrimSurvival.clearPendingOverload?.(actor);
        return;
    }

    await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', 0);
    await globalThis.RawgrimSurvival.clearPendingOverload?.(actor);

    const chatContent = `
        <div class="rawgrim-sys-card rest-long">
            <h4 class="rawgrim-card-title">Resonance Cleansed</h4>
            <p class="rawgrim-card-sub"><strong>${actorName}</strong> completes a full rest. All remaining Resonance is cleared.</p>
            <table class="rawgrim-table-compact">
                <thead><tr><th>Before</th><th>Current</th></tr></thead>
                <tbody><tr><td>${currentRP} RP</td><td style="color:#1e3a24;">0 RP (Stable)</td></tr></tbody>
            </table>
        </div>
    `;
    await ChatMessage.create({ content: chatContent, speaker: { alias: "Laws of Rawgrim" } });
});
