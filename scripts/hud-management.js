globalThis.RawgrimSurvival = globalThis.RawgrimSurvival || {};

Hooks.on('renderTokenHUD', (hud, html, data) => {
    if (!game.user.isGM) return;

    const token = hud.object;
    const actor = token?.actor;
    if (!actor || actor.type !== 'character') return;

    const rootElement = html instanceof HTMLElement ? html : (html[0] || html);
    if (!rootElement || rootElement.querySelector('.rawgrim-hud-trigger')) return;

    const hudBtn = document.createElement('div');
    hudBtn.className = 'control-icon rawgrim-hud-trigger';
    hudBtn.title = `Rawgrim Oversight: ${actor.name}`;
    hudBtn.innerHTML = `<i class="fas fa-skull" style="color: #8f8173;"></i>`;
    hudBtn.style.cssText = 'background: #0d0c0b; border: 1px solid #2d261f; margin-bottom: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 0px;';

    hudBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        
        const isDependent = actor.getFlag('rawgrim-toll-of-survival', 'isCatalystDependent') || false;
        const currentRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || 0;
        const marksState = globalThis.RawgrimSurvival.getActorMarksState(actor);
        const threshold = globalThis.RawgrimSurvival.getResonanceThreshold(actor);
        const activeStageName = marksState.stageName;
        const marksLimit = marksState.stageLimit ? ` / ${marksState.stageLimit}` : "";
        
        const currentDie = globalThis.RawgrimSurvival.getCatalystUsageDie(actor);
        const currentDieDisplay = currentDie || 'No Active Catalyst';

        const damagedProsthetics = actor.items.filter(i => i?.getFlag('rawgrim-toll-of-survival', 'isOverloaded') === true);

        const htmlContent = `
            <div style="font-family: 'Times New Roman', serif; color: #a8998a; padding: 5px; background: #0d0c0b;">
                <p style="margin-bottom: 12px; color: #63594f; font-size: 0.9em; text-align: center; font-style: italic;">Oversight Threshold: <strong>${actor.name}</strong></p>
                
                <div style="display: flex; align-items: center; justify-content: space-between; background: #060505; border: 1px solid #1c1815; padding: 8px; margin-bottom: 10px;">
                    <span style="font-weight: bold; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px;"><i class="fas fa-skull-crossbones"></i> Requires Catalyst</span>
                    <input type="checkbox" id="rg-dialog-dependent" ${isDependent ? 'checked' : ''} style="width: 15px; height: 15px; cursor: pointer; margin: 0; accent-color: #541e1e;"/>
                </div>
                
                <div style="background: #060505; border: 1px solid #1c1815; padding: 8px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: bold; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px;"><i class="fas fa-bolt"></i> Resonance (RP)</span>
                        <span style="font-weight: bold; color: #fff; background: #171412; padding: 1px 5px; font-size: 0.8em;">${currentRP} / ${threshold} RP</span>
                    </div>
                    <input type="number" id="rg-dialog-rp" value="${currentRP}" min="0" max="100" style="width: 100%; background: #090807; color: #a8998a; border: 1px solid #2d261f; padding: 4px; border-radius: 0px; text-align: center; font-family: 'Times New Roman', serif;"/>
                </div>
                
                <div style="background: #060505; border: 1px solid #1c1815; padding: 8px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                        <span style="font-weight: bold; font-size: 0.85em; text-transform: uppercase; letter-spacing: 1px;"><i class="fas fa-fingerprint"></i> The Marks</span>
                        <span style="font-weight: bold; color: #bf3f3f; background: #171412; padding: 1px 5px; font-size: 0.8em;">${activeStageName}</span>
                    </div>
                    <input type="number" id="rg-dialog-marks" value="${marksState.stageCount}" min="0" max="100" style="width: 100%; background: #090807; color: #a8998a; border: 1px solid #2d261f; padding: 4px; border-radius: 0px; text-align: center; font-family: 'Times New Roman', serif;"/>
                    <p style="margin: 5px 0 0 0; font-size: 0.78em; color: #63594f; text-align: center;">Current stage count${marksLimit}</p>
                </div>

                <div style="background: #060505; border: 1px solid #1c1815; padding: 8px; margin-bottom: 10px;">
                    <span style="font-weight: bold; font-size: 0.85em; text-transform: uppercase; display: block; margin-bottom: 6px; letter-spacing: 1px;"><i class="fas fa-wrench"></i> Maintenance</span>
                    <button type="button" id="rg-btn-repair" class="rawgrim-btn-flat rawgrim-btn-success-flat" style="width: 100%;" ${damagedProsthetics.length === 0 ? 'disabled' : ''}>
                        Recalibrate Mechanism (${damagedProsthetics.length})
                    </button>
                </div>
                
                <div style="background: #060505; border: 1px solid #1c1815; padding: 8px;">
                    <span style="font-weight: bold; font-size: 0.85em; text-transform: uppercase; display: block; margin-bottom: 6px; letter-spacing: 1px;"><i class="fas fa-hourglass-half"></i> Injunction</span>
                    <button type="button" id="rg-btn-force-roll" class="rawgrim-btn-flat" style="width: 100%;" ${currentDie ? '' : 'disabled'}>Force Usage Roll (${currentDieDisplay})</button>
                </div>
            </div>
        `;

        const dialogWindow = new Dialog({
            title: `Regulation Desk`,
            content: htmlContent,
            buttons: {
                save: {
                    label: "Apply Decrees",
                    callback: async (html) => {
                        const root = html instanceof HTMLElement ? html : html[0];
                        const updatedDependent = root.querySelector('#rg-dialog-dependent').checked;
                        const updatedRP = parseInt(root.querySelector('#rg-dialog-rp').value) || 0;
                        const updatedMarks = parseInt(root.querySelector('#rg-dialog-marks').value) || 0;

                        await actor.setFlag('rawgrim-toll-of-survival', 'isCatalystDependent', updatedDependent);
                        await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', updatedRP);
                        await globalThis.RawgrimSurvival.setActorMarksState(actor, marksState.stageKey, updatedMarks);
                        ui.notifications.info(`Regulatory parameters updated.`);
                    }
                }
            }
        }, { width: 300 });

        dialogWindow.render(true);

        setTimeout(() => {
            document.querySelector(`#rg-btn-force-roll`)?.addEventListener('click', async (e) => {
                e.preventDefault();
                await globalThis.RawgrimSurvival.eksekusiUjiDaduKatalis(actor, "Narrative Enforcement (Cantrip/Distance)", {
                    rollerName: game.user?.name,
                    rollMode: "GM forced roll"
                });
                dialogWindow.close();
            });

            document.querySelector(`#rg-btn-repair`)?.addEventListener('click', async (e) => {
                e.preventDefault();
                const lockedItems = actor.items.filter(i => i?.getFlag('rawgrim-toll-of-survival', 'isOverloaded') === true);
                
                for (let item of lockedItems) {
                    let cleanedName = item.name.replace('[OVERLOADED] ', '');
                    const originallyEquipped = item.getFlag('rawgrim-toll-of-survival', 'wasEquipped') || false;
                    const originalAttunement = item.getFlag('rawgrim-toll-of-survival', 'originalAttunement') || 0;

                    await item.update({
                        name: cleanedName,
                        "system.equipped": originallyEquipped,
                        "system.attunement": originalAttunement
                    });
                    await item.unsetFlag('rawgrim-toll-of-survival', 'isOverloaded');
                    await item.unsetFlag('rawgrim-toll-of-survival', 'wasEquipped');
                    await item.unsetFlag('rawgrim-toll-of-survival', 'originalAttunement');

                    if (item.effects && item.effects.size > 0) {
                        for (let effect of item.effects) {
                            await effect.update({ disabled: false });
                        }
                    }
                }

                await actor.prepareData();
                if (actor.sheet?.rendered) actor.sheet.render(false);

                globalThis.RawgrimSurvival.tampilkanCinematicNotice?.(
                    "Mechanism Recalibrated",
                    `${actor.name}'s overloaded mechanisms are restored.`,
                    "fas fa-wrench"
                );
                ui.notifications.info(`Mechanisms recalibrated. Functions restored.`);
                dialogWindow.close();
            });
        }, 150);
    });

    const leftColumn = rootElement.querySelector('.col.left');
    if (leftColumn) leftColumn.appendChild(hudBtn);
});
