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
    
    getResonanceThreshold(actor) {
        const totalLevel = actor.system.details.level || 1;
        if (totalLevel <= 2) return 20;
        if (totalLevel <= 4) return 19;
        if (totalLevel <= 6) return 18;
        if (totalLevel <= 8) return 17;
        return 16;
    },

    getBacklashStageName(failures) {
        if (failures <= 15) return "Early Stage";
        if (failures <= 30) return "Intermediate Stage";
        return "Advanced Stage";
    },

    tampilkanPeringatanLayarTengah(actorName, spellName) {
        const oldSplash = document.getElementById('rawgrim-cinematic-splash');
        if (oldSplash) oldSplash.remove();

        const splashContainer = document.createElement('div');
        splashContainer.id = 'rawgrim-cinematic-splash';
        splashContainer.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            display: flex; flex-direction: column; justify-content: center; align-items: center;
            background: rgba(0, 0, 0, 0.85); z-index: 9999999; pointer-events: none;
            opacity: 0; transition: opacity 0.4s ease-in-out; font-family: 'Signika', sans-serif;
        `;

        splashContainer.innerHTML = `
            <div style="background: #0a0a0a; width: 100%; padding: 40px 0; text-align: center; border-top: 1px solid #4a1111; border-bottom: 1px solid #4a1111;">
                <h1 style="color: #8c1c1c; font-size: 2.2em; margin: 0; text-transform: uppercase; letter-spacing: 3px; font-weight: bold; font-family: 'Times New Roman', serif; font-style: italic;">
                    The Arcane Refuses to Rise
                </h1>
                <p style="color: #8c8174; font-size: 1.1em; margin: 12px 0 0 0; letter-spacing: 1px;">
                    ${actorName} requires an active <strong>Material Catalyst</strong> to cast *${spellName}*.
                </p>
            </div>
        `;

        document.body.appendChild(splashContainer);
        setTimeout(() => { splashContainer.style.opacity = '1'; }, 50);
        setTimeout(() => { 
            splashContainer.style.opacity = '0'; 
            setTimeout(() => { splashContainer.remove(); }, 400);
        }, 2600);
    },

    async eksekusiUjiDaduKatalis(actor, pemicuSebab = "1st-level spell or higher") {
        const catalystItem = actor.items.find(i => i.name?.toLowerCase()?.includes('material catalyst'));
        if (!catalystItem) return;

        let currentDie = catalystItem.getFlag('rawgrim-toll-of-survival', 'usageDie') || 'd8';
        if (currentDie === 'expended') return;

        const roll = await new Roll(`1${currentDie}`).evaluate();
        const isDegraded = roll.total <= 2;
        let nextDie = currentDie;

        if (isDegraded) {
            if (currentDie === 'd8') nextDie = 'd6';
            else if (currentDie === 'd6') nextDie = 'd4';
            else nextDie = 'expended';
        }

        let resolusiTeks = isDegraded 
            ? (nextDie === 'expended' ? 'EXPENDED (The catalyst crumbles into ash.)' : `DEGRADED (Usage Die shrinks to 1${nextDie}.)`)
            : 'STABLE (The catalyst retains structural integrity.)';

        const chatContent = `
            <div class="rawgrim-sys-card catalyst">
                <h4 class="rawgrim-card-title">Catalyst Usage Die Roll</h4>
                <p class="rawgrim-card-sub">Triggered by: <strong>${pemicuSebab}</strong></p>
                <table class="rawgrim-table-compact">
                    <thead><tr><th>Current Die</th><th>Roll Result</th></tr></thead>
                    <tbody><tr><td>1${currentDie}</td><td style="color: ${isDegraded ? '#bf3f3f' : '#3fbf3f'};">${roll.total}</td></tr></tbody>
                </table>
                <p class="rawgrim-card-sub" style="font-weight: bold; text-align: center; color: ${isDegraded ? '#bf3f3f' : '#3fbf3f'}; margin-top: 6px;">
                    Resolution: ${resolusiTeks}
                </p>
            </div>
        `;

        await ChatMessage.create({ content: chatContent, speaker: { alias: `Laws of Kelangkaan` } });

        if (nextDie === 'expended') {
            await catalystItem.delete();
            ui.notifications.warn(`${actor.name}'s Material Catalyst has been completely expended.`);
        } else {
            await catalystItem.setFlag('rawgrim-toll-of-survival', 'usageDie', nextDie);
            await catalystItem.update({ name: `Material Catalyst (1${nextDie})` });
        }
    }
});