/**
 * Rawgrim: The Toll of Survival
 * Module 4: Rest Decay Management (Version 14.5)
 */

globalThis.RawgrimSurvival = globalThis.RawgrimSurvival || {};

Hooks.on("dnd5e.shortRest", async (actor, result) => {
    if (actor.type !== "character") return;
    const currentRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || 0;
    if (currentRP === 0) return;

    const newRP = Math.max(0, currentRP - 5);
    await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', newRP);

    const chatContent = `
        <div class="rawgrim-sys-card rest-short">
            <h4 class="rawgrim-card-title">Resonance Mitigation</h4>
            <p class="rawgrim-card-sub">Following a temporary rest, <strong>${actor.name}</strong> vents a minor fraction of ambient corruption from their flesh.</p>
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
    const currentRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || 0;
    if (currentRP === 0) return;

    await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', 0);

    const chatContent = `
        <div class="rawgrim-sys-card rest-long">
            <h4 class="rawgrim-card-title">Resonance Cleansed</h4>
            <p class="rawgrim-card-sub">Following an extended rest, <strong>${actor.name}</strong>'s vessel completely expels all remaining arcane feedback.</p>
            <table class="rawgrim-table-compact">
                <thead><tr><th>Before</th><th>Current</th></tr></thead>
                <tbody><tr><td>${currentRP} RP</td><td style="color:#1e3a24;">0 RP (Stable)</td></tr></tbody>
            </table>
        </div>
    `;
    await ChatMessage.create({ content: chatContent, speaker: { alias: "Laws of Rawgrim" } });
});