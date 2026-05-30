/**
 * Rawgrim: The Toll of Survival
 * GM Dashboard Foundation
 */

globalThis.RawgrimSurvival = globalThis.RawgrimSurvival || {};

Object.assign(globalThis.RawgrimSurvival, {
    getTrackedCharacters() {
        return game.actors
            .filter(actor => actor.type === "character")
            .sort((a, b) => a.name.localeCompare(b.name));
    },

    getDashboardDangerScore(state) {
        let score = 0;
        if (state.resonancePending) score += 120;
        if (state.currentRP >= state.threshold) score += 100;
        score += Math.min(30, state.exhaustion * 10);
        score += state.overloadedCount * 25;
        score += state.damagedCount * 18;
        score += state.injuryCount * 12;
        if (state.ignisStatus === "due") score += 20;
        else if (state.ignisStatus === "soon") score += 10;
        if (state.catalyst === "None" && state.requiresCatalyst) score += 15;
        if (state.cantripCounter >= 3) score += 8;
        if (state.stageLimit && state.marks >= 13) score += 8;
        return score;
    },

    getDashboardDangerLevel(score) {
        if (score >= 100) return "critical";
        if (score >= 25) return "watch";
        return "stable";
    },

    getDashboardEntries() {
        return this.getTrackedCharacters()
            .map(actor => {
                const state = this.getActorDashboardState(actor);
                const dangerScore = this.getDashboardDangerScore(state);
                return {
                    actor,
                    state,
                    dangerScore,
                    dangerLevel: this.getDashboardDangerLevel(dangerScore)
                };
            })
            .sort((a, b) => (b.dangerScore - a.dangerScore) || a.actor.name.localeCompare(b.actor.name));
    },

    getActorDashboardState(actor) {
        const currentRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || 0;
        const threshold = this.getResonanceThreshold(actor);
        const marksState = this.getActorMarksState(actor);
        const catalystState = this.getCatalystState(actor);
        const cantripCounter = actor.getFlag('rawgrim-toll-of-survival', 'cantripCounter') || 0;
        const exhaustion = actor.system.attributes?.exhaustion ?? 0;
        const integrity = this.getEquipmentIntegritySummary(actor);
        const prosthetics = integrity.prosthetics;
        const overloaded = integrity.overloaded;
        const damagedItems = actor.items.filter(i => i?.getFlag('rawgrim-toll-of-survival', 'isDamaged') === true);
        const injuries = this.getLingeringInjuries(actor);
        const ignisDays = integrity.ignisDays;

        return {
            currentRP,
            threshold,
            resonancePending: this.hasPendingOverload(actor),
            marks: marksState.stageCount,
            marksTotal: marksState.totalFailures,
            marksStageKey: marksState.stageKey,
            stage: marksState.stageName,
            stageLimit: marksState.stageLimit,
            catalyst: catalystState.display,
            catalystDie: catalystState.usageDie || "none",
            catalystCount: catalystState.count,
            requiresCatalyst: catalystState.requiresCatalyst,
            cantripCounter,
            exhaustion,
            prostheticCount: prosthetics.length,
            overloadedCount: overloaded.length,
            damagedCount: damagedItems.length,
            durabilityCount: integrity.durabilityItems.length,
            integrityConcerns: integrity.concernItems,
            ignisStatus: integrity.ignisStatus,
            injuryCount: injuries.length,
            ignisDays
        };
    },

    async recalibrateActorProsthetics(actor) {
        const lockedItems = actor.items.filter(i => i?.getFlag('rawgrim-toll-of-survival', 'isOverloaded') === true);
        for (let item of lockedItems) {
            const cleanedName = item.name.replace('[OVERLOADED] ', '');
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
        return lockedItems.length;
    },

    openDurabilityRequestDialog(actor) {
        const items = this.getDurabilityItems(actor).filter(i => this.getItemDurabilityDie(i) !== "damaged");
        if (items.length === 0) {
            ui.notifications.warn(`${actor.name}: no usable durability item found.`);
            return;
        }

        const options = items.map(item => `<option value="${item.id}">${this.escapeHTML(this.getCleanItemName(item))} (${this.getItemDurabilityDie(item)})</option>`).join("");
        new Dialog({
            title: `Equipment Integrity: ${actor.name}`,
            content: `
                <div class="rawgrim-mini-dialog">
                    <label>Item to test</label>
                    <select id="rg-durability-item">${options}</select>
                    <p>Choose the weapon or armor that must roll its Durability Die.</p>
                </div>
            `,
            buttons: {
                request: {
                    label: "Request Roll",
                    callback: async (html) => {
                        const root = html instanceof HTMLElement ? html : html[0];
                        const item = actor.items.get(root.querySelector('#rg-durability-item')?.value);
                        if (!item) return;
                        await this.kirimPermintaanRollDurability(actor, item, "GM requests an Equipment Integrity test.");
                        ui.notifications.info(`${actor.name}: durability roll requested for ${item.name}.`);
                        this.refreshOpenGMDashboards();
                    }
                },
                cancel: { label: "Cancel" }
            }
        }, { width: 320 }).render(true);
    },

    openRepairDamagedDialog(actor) {
        const items = actor.items.filter(i => i?.getFlag('rawgrim-toll-of-survival', 'isDamaged') === true);
        if (items.length === 0) {
            ui.notifications.warn(`${actor.name}: no damaged item found.`);
            return;
        }

        const options = items.map(item => `<option value="${item.id}">${this.escapeHTML(this.getCleanItemName(item))}</option>`).join("");
        new Dialog({
            title: `Repair Equipment: ${actor.name}`,
            content: `
                <div class="rawgrim-mini-dialog">
                    <label>Damaged item</label>
                    <select id="rg-repair-item">${options}</select>
                    <p>Repair returns the item to a d10 Durability Die.</p>
                </div>
            `,
            buttons: {
                repair: {
                    label: "Repair",
                    callback: async (html) => {
                        const root = html instanceof HTMLElement ? html : html[0];
                        const item = actor.items.get(root.querySelector('#rg-repair-item')?.value);
                        if (!item) return;
                        await this.repairDamagedItem(item, "d10");
                        await this.createEquipmentRepairMessage(actor, item, "d10");
                        ui.notifications.info(`${actor.name}: ${this.getCleanItemName(item)} repaired to d10.`);
                        this.refreshOpenGMDashboards();
                    }
                },
                cancel: { label: "Cancel" }
            }
        }, { width: 320 }).render(true);
    },

    openLingeringInjuryDialog(actor) {
        const reasons = [
            "Critical hit",
            "Dropped to 0 hit points",
            "Failed death save by 5 or more",
            "GM confirmed trigger"
        ];
        const options = reasons.map(reason => `<option value="${reason}">${reason}</option>`).join("");

        new Dialog({
            title: `Lingering Injury: ${actor.name}`,
            content: `
                <div class="rawgrim-mini-dialog">
                    <label>Trigger</label>
                    <select id="rg-injury-reason">${options}</select>
                    <label>Injury to record</label>
                    <input id="rg-injury-description" type="text" value="Lingering injury recorded by the GM."/>
                    <p>Request a player roll first, or record the injury directly. This does not apply automatic penalties.</p>
                </div>
            `,
            buttons: {
                request: {
                    label: "Request Roll",
                    callback: async (html) => {
                        const root = html instanceof HTMLElement ? html : html[0];
                        const reason = root.querySelector('#rg-injury-reason')?.value || "GM confirmed trigger";
                        await this.kirimPermintaanRollLingeringInjury(actor, reason);
                        ui.notifications.info(`${actor.name}: lingering injury roll requested.`);
                        this.refreshOpenGMDashboards();
                    }
                },
                record: {
                    label: "Record Injury",
                    callback: async (html) => {
                        const root = html instanceof HTMLElement ? html : html[0];
                        const reason = root.querySelector('#rg-injury-reason')?.value || "GM confirmed trigger";
                        const description = root.querySelector('#rg-injury-description')?.value || "Lingering injury recorded by the GM.";
                        const injury = await this.addLingeringInjury(actor, { reason, description });
                        await this.createLingeringInjuryRecordMessage(actor, injury);
                        ui.notifications.info(`${actor.name}: lingering injury recorded.`);
                        this.refreshOpenGMDashboards();
                    }
                },
                cancel: { label: "Cancel" }
            }
        }, { width: 360 }).render(true);
    },

    buildGMDashboardContent() {
        const entries = this.getDashboardEntries();
        const actors = entries.map(entry => entry.actor);
        const summary = entries.reduce((acc, entry) => {
            const state = entry.state;
            if (entry.dangerLevel === "critical") acc.critical++;
            if (entry.dangerLevel === "watch") acc.watch++;
            if (state.resonancePending) acc.pending++;
            if (state.currentRP >= state.threshold) acc.overLimit++;
            if (state.damagedCount > 0) acc.damaged++;
            if (state.injuryCount > 0) acc.injured++;
            return acc;
        }, { critical: 0, watch: 0, pending: 0, overLimit: 0, damaged: 0, injured: 0 });

        const cards = entries.map(({ actor, state, dangerLevel }) => {
            const rpClass = state.currentRP >= state.threshold ? "rg-status-zero" : "rg-status-full";
            const catalystClass = state.catalyst === "None" ? "rg-status-zero" : "rg-status-full";
            const pendingClass = state.resonancePending ? "rg-status-warning" : "";
            const damagedClass = state.damagedCount > 0 ? "rg-status-zero" : "";
            const injuryClass = state.injuryCount > 0 ? "rg-status-zero" : "";
            const ignisClass = state.prostheticCount > 0 && state.ignisDays >= 30 ? "rg-status-zero" : (state.prostheticCount > 0 && state.ignisDays >= 25 ? "rg-status-warning" : "");
            const markLimit = state.stageLimit ? `/${state.stageLimit}` : "";
            const dangerLabel = dangerLevel === "critical" ? "Critical" : (dangerLevel === "watch" ? "Watch" : "Stable");
            const dangerIcon = dangerLevel === "critical" ? "fa-triangle-exclamation" : (dangerLevel === "watch" ? "fa-eye" : "fa-shield");
            const catalystOptions = ["none", "d8", "d6", "d4"].map(die => {
                const label = die === "none" ? "None" : die;
                const selected = die === state.catalystDie ? "selected" : "";
                return `<option value="${die}" ${selected}>${label}</option>`;
            }).join("");
            const stageOptions = this.getMarksStages().map(stage => {
                const selected = stage.key === state.marksStageKey ? "selected" : "";
                return `<option value="${stage.key}" ${selected}>${stage.name}</option>`;
            }).join("");
            const visibleConcerns = state.integrityConcerns.slice(0, 4).map(entry => {
                const statusClass = entry.severity === "danger" ? "rg-status-zero" : (entry.severity === "warning" ? "rg-status-warning" : "");
                return `<span class="rg-dash-chip ${statusClass}" title="${this.escapeHTML(entry.name)}">${this.escapeHTML(entry.name)}: ${entry.status}</span>`;
            }).join("");
            const hiddenConcernCount = Math.max(0, state.integrityConcerns.length - 4);
            const ignisText = state.prostheticCount === 0
                ? "No prosthetics installed."
                : (state.ignisStatus === "due"
                    ? `Ignis calibration due: ${state.ignisDays}/30 days.`
                    : (state.ignisStatus === "soon" ? `Ignis calibration soon: ${state.ignisDays}/30 days.` : `Ignis stable: ${state.ignisDays}/30 days.`));
            const integrityNotes = `
                <div class="rg-dash-integrity-notes">
                    ${visibleConcerns || `<span class="rg-dash-chip">${state.durabilityCount === 0 ? "No durability gear tracked." : "All durability dice stable."}</span>`}
                    ${hiddenConcernCount > 0 ? `<span class="rg-dash-chip rg-status-warning">+${hiddenConcernCount} more</span>` : ""}
                    ${state.overloadedCount > 0 ? `<span class="rg-dash-chip rg-status-zero">${state.overloadedCount} overloaded mechanism${state.overloadedCount === 1 ? "" : "s"}</span>` : ""}
                    <span class="rg-dash-chip ${ignisClass}">${ignisText}</span>
                </div>
            `;

            return `
                <section class="rg-dash-card rg-dash-card-${dangerLevel}" data-actor-id="${actor.id}">
                    <header class="rg-dash-card-head">
                        <div>
                            <h3>${actor.name}</h3>
                            <span>${state.stage} - ${state.marks}${markLimit} marks</span>
                        </div>
                        <span class="rg-dash-severity rg-dash-severity-${dangerLevel}"><i class="fas ${dangerIcon}"></i> ${dangerLabel}</span>
                        <button type="button" class="rg-dash-save" data-action="save-edits" title="Save edited values"><i class="fas fa-floppy-disk"></i> Save</button>
                    </header>
                    <div class="rg-dash-status-row">
                        <div class="rg-dash-status"><span>RP</span><strong class="${rpClass}">${state.currentRP}/${state.threshold}</strong></div>
                        <div class="rg-dash-status"><span>Catalyst</span><strong class="${catalystClass}">${state.catalyst}</strong></div>
                        <div class="rg-dash-status"><span>Exhaustion</span><strong>${state.exhaustion}</strong></div>
                        <div class="rg-dash-status"><span>Overload</span><strong class="${pendingClass}">${state.resonancePending ? "Pending" : "Clear"}</strong></div>
                        <div class="rg-dash-status"><span>Damaged</span><strong class="${damagedClass}">${state.damagedCount}</strong></div>
                        <div class="rg-dash-status"><span>Injuries</span><strong class="${injuryClass}">${state.injuryCount}</strong></div>
                    </div>
                    <div class="rg-dash-actions">
                        <div class="rg-dash-action-group">
                            <span>Resonance</span>
                            <button type="button" data-action="rp-add" title="Add 1 RP"><i class="fas fa-plus"></i> RP</button>
                            <button type="button" data-action="rp-reset" title="Reset RP"><i class="fas fa-rotate-left"></i> RP</button>
                            <button type="button" data-action="cantrip-add" title="Add Cantrip Counter"><i class="fas fa-wand-magic-sparkles"></i> Ctr</button>
                            <button type="button" data-action="cantrip-request" title="Request Player Strain Roll" ${state.cantripCounter < 3 ? "disabled" : ""}><i class="fas fa-dice-d6"></i> Strain</button>
                            <button type="button" data-action="cantrip-reset" title="Reset Cantrip Counter"><i class="fas fa-rotate-left"></i> Ctr</button>
                        </div>
                        <div class="rg-dash-action-group">
                            <span>Catalyst</span>
                            <button type="button" data-action="catalyst-roll" title="Force Catalyst Roll" ${state.catalyst === "None" ? "disabled" : ""}><i class="fas fa-dice"></i> Roll</button>
                            <button type="button" data-action="catalyst-restore" title="Create or Restore Catalyst to d8"><i class="fas fa-gem"></i> d8</button>
                        </div>
                        <div class="rg-dash-action-group">
                            <span>Marks</span>
                            <button type="button" data-action="marks-add" title="Add 1 Mark"><i class="fas fa-fingerprint"></i> Mark</button>
                            <button type="button" data-action="injury-open" title="Lingering Injury"><i class="fas fa-notes-medical"></i> Injury</button>
                            <button type="button" data-action="injury-remove" title="Remove Latest Injury" ${state.injuryCount === 0 ? "disabled" : ""}><i class="fas fa-kit-medical"></i> Heal</button>
                        </div>
                        <div class="rg-dash-action-group">
                            <span>Integrity</span>
                            <button type="button" data-action="durability-request" title="Request Durability Roll" ${state.durabilityCount === 0 ? "disabled" : ""}><i class="fas fa-shield-halved"></i> Test</button>
                            <button type="button" data-action="repair-damaged" title="Repair Damaged Item" ${state.damagedCount === 0 ? "disabled" : ""}><i class="fas fa-hammer"></i> Repair</button>
                            <button type="button" data-action="ignis-add" title="Add 1 Ignis Day" ${state.prostheticCount === 0 ? "disabled" : ""}><i class="fas fa-calendar-plus"></i> Day</button>
                            <button type="button" data-action="ignis-reset" title="Reset Ignis Days" ${state.prostheticCount === 0 ? "disabled" : ""}><i class="fas fa-calendar-check"></i> Ignis</button>
                            <button type="button" data-action="recalibrate" title="Recalibrate Prosthetics" ${state.overloadedCount === 0 ? "disabled" : ""}><i class="fas fa-wrench"></i> Calib</button>
                        </div>
                    </div>
                    ${integrityNotes}
                    <details class="rg-dash-edit-panel">
                        <summary><i class="fas fa-sliders"></i> Manual Overrides</summary>
                        <div class="rg-dash-edit-grid">
                            <div class="rg-dash-stat"><span>RP</span><label><input type="number" data-field="rp" value="${state.currentRP}" min="0" max="999"/><strong class="${rpClass}">/${state.threshold}</strong></label></div>
                            <div class="rg-dash-stat"><span>Requires Catalyst</span><label class="rg-dash-check"><input type="checkbox" data-field="requires-catalyst" ${state.requiresCatalyst ? "checked" : ""}/><strong>${state.requiresCatalyst ? "Yes" : "No"}</strong></label></div>
                            <div class="rg-dash-stat"><span>Catalyst Die</span><select data-field="catalyst-die" class="${catalystClass}">${catalystOptions}</select></div>
                            <div class="rg-dash-stat"><span>Cantrip</span><label><input type="number" data-field="cantrip" value="${state.cantripCounter}" min="0" max="999"/><strong>/3</strong></label></div>
                            <div class="rg-dash-stat"><span>Stage</span><select data-field="marks-stage">${stageOptions}</select></div>
                            <div class="rg-dash-stat"><span>Marks</span><label><input type="number" data-field="marks" value="${state.marks}" min="0" max="999"/><strong>${markLimit}</strong></label></div>
                            <div class="rg-dash-stat"><span>Prosthetics</span><strong>${state.prostheticCount}</strong></div>
                            <div class="rg-dash-stat"><span>Ignis</span><label><input type="number" data-field="ignis" value="${state.ignisDays}" min="0" max="999"/><strong class="${ignisClass}">/30</strong></label></div>
                        </div>
                    </details>
                </section>
            `;
        }).join("");

        return `
            <div class="rawgrim-gm-dashboard">
                <div class="rg-dashboard-toolbar">
                    <div>
                        <h2>Rawgrim GM Dashboard</h2>
                        <span>${actors.length} tracked character${actors.length === 1 ? "" : "s"}</span>
                    </div>
                    <button type="button" data-dashboard-action="refresh"><i class="fas fa-rotate"></i> Refresh</button>
                </div>
                <div class="rg-dashboard-summary">
                    <span class="rg-dash-chip rg-status-zero"><i class="fas fa-triangle-exclamation"></i> Critical ${summary.critical}</span>
                    <span class="rg-dash-chip rg-status-warning"><i class="fas fa-eye"></i> Watch ${summary.watch}</span>
                    <span class="rg-dash-chip"><i class="fas fa-bolt"></i> Pending ${summary.pending}</span>
                    <span class="rg-dash-chip"><i class="fas fa-shield-halved"></i> Damaged ${summary.damaged}</span>
                    <span class="rg-dash-chip"><i class="fas fa-notes-medical"></i> Injuries ${summary.injured}</span>
                </div>
                <div class="rg-dashboard-note">Cards are sorted by urgency. Use quick actions during play; open Manual Overrides only for corrections.</div>
                <div class="rg-dashboard-card-list">${cards || `<p class="rg-dashboard-empty">No character actors found.</p>`}</div>
            </div>
        `;
    },

    refreshGMDashboard(root) {
        const dashboard = root?.querySelector('.rawgrim-gm-dashboard');
        if (dashboard) dashboard.outerHTML = this.buildGMDashboardContent();
    },

    refreshOpenGMDashboards() {
        document.querySelectorAll('.rawgrim-dashboard-window .window-content').forEach(root => {
            this.refreshGMDashboard(root);
        });
    },

    openGMDashboard() {
        if (!game.user.isGM) {
            ui.notifications.warn("Only the GM can open the Rawgrim Dashboard.");
            return;
        }

        const dialogWindow = new Dialog({
            title: "Rawgrim GM Dashboard",
            content: this.buildGMDashboardContent(),
            buttons: {
                close: {
                    label: "Close"
                }
            }
        }, { width: 980, height: "auto", classes: ["rawgrim-dashboard-window"] });

        dialogWindow.render(true);

        setTimeout(() => {
            const root = document.querySelector('.rawgrim-dashboard-window .window-content');
            root?.addEventListener('click', async (event) => {
                const dashboardButton = event.target.closest('[data-dashboard-action]');
                if (dashboardButton?.dataset?.dashboardAction === "refresh") {
                    event.preventDefault();
                    this.refreshGMDashboard(root);
                    return;
                }

                const button = event.target.closest('[data-action]');
                if (!button) return;

                event.preventDefault();
                const row = button.closest('[data-actor-id]');
                const actor = game.actors.get(row?.dataset?.actorId);
                if (!actor) return;

                await this.handleDashboardAction(actor, button.dataset.action, row);
                this.refreshGMDashboard(root);
            });
        }, 150);
    },

    async handleDashboardAction(actor, action, row = null) {
        const currentRP = actor.getFlag('rawgrim-toll-of-survival', 'resonancePoints') || 0;
        const currentMarksState = this.getActorMarksState(actor);
        const cantripCounter = actor.getFlag('rawgrim-toll-of-survival', 'cantripCounter') || 0;

        if (action === "save-edits") {
            const readNumber = (field, fallback) => {
                const input = row?.querySelector(`[data-field="${field}"]`);
                const value = Number.parseInt(input?.value, 10);
                return Number.isFinite(value) ? Math.max(0, value) : fallback;
            };
            const stageSelect = row?.querySelector('[data-field="marks-stage"]');
            const stageKey = stageSelect?.value || currentMarksState.stageKey;
            const requiresCatalyst = row?.querySelector('[data-field="requires-catalyst"]')?.checked || false;
            const catalystDie = row?.querySelector('[data-field="catalyst-die"]')?.value || "none";

            const editedRP = readNumber("rp", currentRP);
            await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', editedRP);
            await actor.setFlag('rawgrim-toll-of-survival', 'isCatalystDependent', requiresCatalyst);
            await this.setCatalystUsageDie(actor, catalystDie);
            await this.setActorMarksState(actor, stageKey, readNumber("marks", currentMarksState.stageCount));
            await actor.setFlag('rawgrim-toll-of-survival', 'cantripCounter', readNumber("cantrip", cantripCounter));
            await actor.setFlag('rawgrim-toll-of-survival', 'ignisCalibrationDays', readNumber("ignis", actor.getFlag('rawgrim-toll-of-survival', 'ignisCalibrationDays') || 0));
            await this.checkAndPromptOverload(actor, editedRP);
            ui.notifications.info(`${actor.name}: dashboard values saved.`);
        }

        if (action === "rp-add") {
            const nextRP = currentRP + 1;
            await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', nextRP);
            await this.checkAndPromptOverload(actor, nextRP);
            ui.notifications.info(`${actor.name}: +1 RP.`);
        }

        if (action === "rp-reset") {
            await actor.setFlag('rawgrim-toll-of-survival', 'resonancePoints', 0);
            await this.clearPendingOverload(actor);
            ui.notifications.info(`${actor.name}: RP reset.`);
        }

        if (action === "marks-add") {
            await this.applyMarksAdvance(actor, {
                reason: "GM added a mark from the dashboard",
                source: "Rawgrim GM Dashboard",
                showCinematic: true,
                overloadProsthetics: true
            });
            ui.notifications.info(`${actor.name}: +1 mark applied.`);
        }

        if (action === "catalyst-roll") {
            await this.eksekusiUjiDaduKatalis(actor, "GM Dashboard", {
                rollerName: game.user?.name,
                rollMode: "GM forced roll"
            });
        }

        if (action === "catalyst-restore") {
            await this.setCatalystUsageDie(actor, "d8");
            ui.notifications.info(`${actor.name}: Material Catalyst set to d8.`);
        }

        if (action === "cantrip-add") {
            const nextCounter = cantripCounter + 1;
            await actor.setFlag('rawgrim-toll-of-survival', 'cantripCounter', nextCounter);
            ui.notifications.info(`${actor.name}: cantrip counter ${nextCounter}/3.`);
        }

        if (action === "cantrip-request") {
            await this.kirimPermintaanRollCantrip(actor);
            ui.notifications.info(`${actor.name}: strain roll requested.`);
        }

        if (action === "cantrip-reset") {
            await actor.setFlag('rawgrim-toll-of-survival', 'cantripCounter', 0);
            ui.notifications.info(`${actor.name}: cantrip counter reset.`);
        }

        if (action === "recalibrate") {
            const repaired = await this.recalibrateActorProsthetics(actor);
            this.tampilkanCinematicNotice?.(
                "Mechanism Recalibrated",
                `${actor.name}'s overloaded mechanisms are restored.`,
                "fas fa-wrench"
            );
            ui.notifications.info(`${actor.name}: ${repaired} mechanism(s) recalibrated.`);
        }

        if (action === "durability-request") {
            this.openDurabilityRequestDialog(actor);
        }

        if (action === "repair-damaged") {
            this.openRepairDamagedDialog(actor);
        }

        if (action === "injury-open") {
            this.openLingeringInjuryDialog(actor);
        }

        if (action === "injury-remove") {
            const removed = await this.removeLatestLingeringInjury(actor);
            if (!removed) {
                ui.notifications.warn(`${actor.name}: no lingering injury to remove.`);
                return;
            }
            ui.notifications.info(`${actor.name}: removed latest lingering injury.`);
        }

        if (action === "ignis-add") {
            const nextDays = (actor.getFlag('rawgrim-toll-of-survival', 'ignisCalibrationDays') || 0) + 1;
            await actor.setFlag('rawgrim-toll-of-survival', 'ignisCalibrationDays', nextDays);
            if (nextDays >= 30) {
                await ChatMessage.create({
                    content: `
                        <div class="rawgrim-sys-card integrity">
                            <h4 class="rawgrim-card-title">Ignis Calibration Due</h4>
                            <p class="rawgrim-card-sub"><strong>${actor.name}</strong> has gone ${nextDays} days since prosthetic calibration.</p>
                            <p class="rawgrim-card-note">The prosthetic needs qualified maintenance before the body starts rejecting the mechanism.</p>
                        </div>
                    `,
                    whisper: this.getGMUserIds(),
                    speaker: { alias: "Rawgrim Maintenance" }
                });
            }
            ui.notifications.info(`${actor.name}: Ignis calibration day ${nextDays}/30.`);
        }

        if (action === "ignis-reset") {
            await actor.setFlag('rawgrim-toll-of-survival', 'ignisCalibrationDays', 0);
            ui.notifications.info(`${actor.name}: Ignis calibration reset.`);
        }
    }
});

Hooks.on('getSceneControlButtons', (controls) => {
    if (!game.user.isGM) return;

    const dashboardTool = {
        name: "rawgrim-dashboard",
        title: "Rawgrim GM Dashboard",
        icon: "fas fa-skull",
        button: true,
        onClick: () => globalThis.RawgrimSurvival.openGMDashboard()
    };

    if (Array.isArray(controls)) {
        const tokenControls = controls.find(c => c.name === "token") || controls[0];
        if (!tokenControls?.tools?.some(t => t.name === dashboardTool.name)) {
            tokenControls?.tools?.push(dashboardTool);
        }
        return;
    }

    const tokenControls = controls.tokens || controls.token || Object.values(controls)[0];
    if (tokenControls?.tools && !Object.values(tokenControls.tools).some(t => t.name === dashboardTool.name)) {
        tokenControls.tools[dashboardTool.name] = dashboardTool;
    }
});
