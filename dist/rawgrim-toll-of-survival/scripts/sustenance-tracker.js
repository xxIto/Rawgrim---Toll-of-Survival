/**
 * Rawgrim: The Toll of Survival
 * Module 6: Sustenance & Logistics Deprivation Tracker (Version 16.0)
 */

globalThis.RawgrimSurvival = globalThis.RawgrimSurvival || {};

// ARSITEKTUR TRANSAKSI ATOMIK SEKUENSEAL: Menghitung Akurasi Logistik Tanpa Kontaminasi Wadah
async function eksekusiKonsumsiLogistikTerpadu(actor, foodAmount, waterAmount) {
    const updates = [];

    // Fungsi pembantu internal untuk mereduksi stok komoditas fisik secara presisi
    const prosesPemotonganKomoditas = (keywords, amountNeeded) => {
        let leftToDeduct = amountNeeded;
        if (leftToDeduct <= 0) return;

        // FILTER EKSKLUSIF: Menyaring barang tetapi memblokir total item bertipe 'waterskin'
        const targets = actor.items.filter(i => {
            const n = i.name?.toLowerCase() || "";
            if (n.includes('waterskin')) return false; // Abaikan wadah penampung
            return keywords.some(k => n.includes(k));
        });

        for (let item of targets) {
            if (leftToDeduct <= 0) break;

            const qty = item.system?.quantity || 0;
            if (qty <= 0) continue;

            const usesMax = Number(item.system?.uses?.max) || 0;
            const usesVal = Number(item.system?.uses?.value) || 0;

            if (usesMax > 0) {
                // Jalur A: Jika item logistik tersebut memiliki charges internal
                let totalAvailableCharges = usesVal + ((qty - 1) * usesMax);

                if (totalAvailableCharges >= leftToDeduct) {
                    let remainingCharges = totalAvailableCharges - leftToDeduct;
                    let newQty = Math.floor(remainingCharges / usesMax) + 1;
                    let newUses = remainingCharges % usesMax;
                    
                    if (newUses === 0 && remainingCharges > 0) {
                        newQty -= 1;
                        newUses = usesMax;
                    }

                    updates.push({
                        _id: item.id,
                        "system.quantity": remainingCharges === 0 ? 0 : newQty,
                        "system.uses.value": remainingCharges === 0 ? 0 : newUses
                    });
                    leftToDeduct = 0;
                } else {
                    leftToDeduct -= totalAvailableCharges;
                    updates.push({
                        _id: item.id,
                        "system.quantity": 0,
                        "system.uses.value": 0
                    });
                }
            } else {
                // Jalur B: Jika item logistik berupa tumpukan kuantitas murni (Ration & Water Pint)
                if (qty >= leftToDeduct) {
                    updates.push({
                        _id: item.id,
                        "system.quantity": qty - leftToDeduct
                    });
                    leftToDeduct = 0;
                } else {
                    leftToDeduct -= qty;
                    updates.push({
                        _id: item.id,
                        "system.quantity": 0
                    });
                }
            }
        }
    };

    // Jalankan reduksi logistik linear berdasarkan input bersih dari ledger
    prosesPemotonganKomoditas(['ration', 'food'], foodAmount);
    prosesPemotonganKomoditas(['water', 'drink', 'quench'], waterAmount);

    // Satukan payload perubahan ke satu pintu transaksi tunggal untuk mencegah bug tumpang tindih ID
    if (updates.length > 0) {
        const uniqueUpdatesMap = new Map();
        for (let u of updates) {
            if (uniqueUpdatesMap.has(u._id)) {
                Object.assign(uniqueUpdatesMap.get(u._id), u);
            } else {
                uniqueUpdatesMap.set(u._id, u);
            }
        }
        await actor.updateEmbeddedDocuments("Item", Array.from(uniqueUpdatesMap.values()));
    }
}

Hooks.on("dnd5e.preShortRest", (actor, config) => {
    if (actor.type !== "character") return true;
    if (actor.getFlag('rawgrim-toll-of-survival', 'bypassSustenance')) return true;

    globalThis.RawgrimSurvival.bukaDialogSustenanceLedger(actor, "short");
    return false;
});

Hooks.on("dnd5e.preLongRest", (actor, config) => {
    if (actor.type !== "character") return true;
    if (actor.getFlag('rawgrim-toll-of-survival', 'bypassSustenance')) return true;

    globalThis.RawgrimSurvival.bukaDialogSustenanceLedger(actor, "long");
    return false;
});

globalThis.RawgrimSurvival.bukaDialogSustenanceLedger = function(actor, restType) {
    if (!actor) return;

    const actorName = globalThis.RawgrimSurvival.escapeHTML?.(actor.name) || actor.name;
    let physicalFoodCount = 0;
    let physicalWaterCount = 0;
    const currentGold = actor.system.currency?.gp || 0;

    // MESIN PEMINDAI INTELLIGENT MANIFEST: Memetakan keaslian data logistik riil aktor
    actor.items.forEach(i => {
        const name = i.name?.toLowerCase() || "";
        const qty = i.system?.quantity || 0;
        if (qty <= 0) return;

        // PROTEKSI ABSOLUT: Gagalkan pemindaian jika nama barang terdeteksi sebagai wadah/waterskin
        if (name.includes('waterskin')) return;

        const usesMax = Number(i.system?.uses?.max) || 0;
        const usesVal = Number(i.system?.uses?.value) || 0;

        let availableStock = 0;
        if (usesMax > 0) {
            availableStock = usesVal + ((qty - 1) * usesMax);
            if (availableStock < 0) availableStock = 0;
        } else {
            availableStock = qty;
        }

        if (name.includes('ration') || name.includes('food')) {
            physicalFoodCount += availableStock;
        }
        if (name.includes('water') || name.includes('drink') || name.includes('quench')) {
            physicalWaterCount += availableStock;
        }
    });

    const isLongRest = restType === "long";
    const restVariant = game.settings.get('rawgrim-toll-of-survival', 'restVariant') || "gritty";
    const isGrittyRest = restVariant === "gritty";
    const baseRationPrice = game.settings.get('rawgrim-toll-of-survival', 'rationGoldCost') || 0.5;
    const baseWaterPrice = game.settings.get('rawgrim-toll-of-survival', 'waterGoldCost') || 0.2;

    const requiredAmount = isLongRest ? (isGrittyRest ? 7 : 1) : 1;
    const restDurationLabel = isLongRest
        ? (isGrittyRest ? "7-day downtime vigil" : "1-day long rest")
        : "8-hour short rest";
    const longRestTitle = isGrittyRest ? "The Long Rest Sustenance Ledger" : "The Long Rest Ledger";
    const resourceLabel = `${requiredAmount} Ration${requiredAmount === 1 ? "" : "s"} and ${requiredAmount} Water${requiredAmount === 1 ? "" : "s"}`;

    function getLongRestSustenanceState(portions) {
        if (!isGrittyRest) {
            return portions >= requiredAmount
                ? {
                    className: "rg-status-full",
                    label: "Supplied",
                    message: "Enough food and water are set aside for the rest.",
                    penaltyLevel: 0
                }
                : {
                    className: "rg-status-zero",
                    label: "Short on supplies",
                    message: "The rest lacks food or water. Gain +1 exhaustion.",
                    penaltyLevel: 1
                };
        }

        if (portions >= 7) {
            return {
                className: "rg-status-full",
                label: "Fully supplied",
                message: "Food and water cover the full 7-day rest. No exhaustion penalty.",
                penaltyLevel: 0
            };
        }
        if (portions >= 5) {
            return {
                className: "rg-status-warning",
                label: "5-6 days supplied",
                message: "The rest is rough. Exhaustion becomes level 1.",
                penaltyLevel: 1
            };
        }
        if (portions >= 3) {
            return {
                className: "rg-status-danger",
                label: "3-4 days supplied",
                message: "The rest is harsh. Exhaustion becomes level 2.",
                penaltyLevel: 2
            };
        }
        return {
            className: "rg-status-zero",
            label: "0-2 days supplied",
            message: "The body is pushed too far. Exhaustion becomes level 3.",
            penaltyLevel: 3
        };
    }

    const htmlContent = `
        <div class="rawgrim-sustenance-dialog" style="font-family: 'Times New Roman', serif; color: #a8998a; background: #0d0c0b; padding: 5px;">
            <p style="margin-bottom: 12px; color: #63594f; font-size: 0.9em; text-align: center; font-style: italic;">
                Sustenance Ledger: <strong>${actorName}</strong> (Gold: ${currentGold} GP)
            </p>
            
            <div class="rawgrim-sustenance-row">
                <span class="rawgrim-sustenance-label"><i class="fas fa-cookie-bite"></i> Rations Found: ${physicalFoodCount}</span>
                <div class="rawgrim-sustenance-control">
                    <button type="button" class="rawgrim-btn-flat" id="rg-food-minus" style="padding: 2px 6px !important;">-</button>
                    <span class="rawgrim-sustenance-count rg-status-zero" id="rg-food-val">0</span>
                    <button type="button" class="rawgrim-btn-flat" id="rg-food-plus" style="padding: 2px 6px !important;">+</button>
                </div>
            </div>

            <div class="rawgrim-sustenance-row">
                <span class="rawgrim-sustenance-label"><i class="fas fa-tint"></i> Water Found: ${physicalWaterCount}</span>
                <div class="rawgrim-sustenance-control">
                    <button type="button" class="rawgrim-btn-flat" id="rg-water-minus" style="padding: 2px 6px !important;">-</button>
                    <span class="rawgrim-sustenance-count rg-status-zero" id="rg-water-val">0</span>
                    <button type="button" class="rawgrim-btn-flat" id="rg-water-plus" style="padding: 2px 6px !important;">+</button>
                </div>
            </div>

            ${isLongRest ? `
            <div class="rawgrim-lifestyle-box">
                <span class="rawgrim-sustenance-label"><i class="fas fa-coins"></i> Downtime Lifestyle Funding</span>
                <p style="font-size: 0.82em; color: #63594f; margin: 4px 0 6px 0; line-height: 1.2;">Pay coin instead of spending items. Required supplies: ${resourceLabel}.</p>
                <select id="rg-lifestyle-select" class="rawgrim-btn-flat" style="width: 100%; text-align: left; background: #090807;">
                    <option value="none">Use Physical Items Only</option>
                    <option value="cheap">Modest Purchase (0.5x Cost)</option>
                    <option value="standard">Standard Purchase (1.0x Cost)</option>
                    <option value="luxury">Comfortable Purchase (2.0x Cost)</option>
                </select>
                <div class="rawgrim-gold-display" id="rg-gold-tax-display">Additional Fee: 0 GP</div>
            </div>
            ` : ''}

            <div class="rawgrim-sustenance-warning" id="rg-sustenance-alert" style="border: 1px solid #421b1b; background: #1c0d0d; padding: 10px; margin-top: 12px; display: block;">
                <div class="rawgrim-sustenance-warning-text" id="rg-alert-text" style="font-size: 0.88em; color: #c29999; line-height: 1.4; font-style: italic;">
                    Choose the supplies spent for this rest.
                </div>
            </div>
        </div>
    `;

    const dialogWindow = new Dialog({
        title: isLongRest ? longRestTitle : "The Short Rest Sustenance Ledger",
        content: htmlContent,
        buttons: {
            confirm: {
                label: "Confirm Rest",
                callback: async (html) => {
                    const root = html instanceof HTMLElement ? html : html[0];
                    let chosenFood = parseInt(root.querySelector('#rg-food-val').textContent) || 0;
                    let chosenWater = parseInt(root.querySelector('#rg-water-val').textContent) || 0;

                    let useGoldFunding = false;
                    let lifestyleMultiplier = 1.0;
                    let goldTax = 0;

                    if (isLongRest) {
                        const lifestyle = root.querySelector('#rg-lifestyle-select').value;
                        if (lifestyle !== "none") {
                            useGoldFunding = true;
                            if (lifestyle === "cheap") lifestyleMultiplier = 0.5;
                            if (lifestyle === "luxury") lifestyleMultiplier = 2.0;
                            goldTax = Number((((baseRationPrice * requiredAmount) + (baseWaterPrice * requiredAmount)) * lifestyleMultiplier).toFixed(2));
                        }
                    }

                    if (useGoldFunding && currentGold < goldTax) {
                        ui.notifications.error("Transaction failed: Insufficient Gold Pieces.");
                        return;
                    }

                    if (useGoldFunding) {
                        await actor.update({ "system.currency.gp": Number((currentGold - goldTax).toFixed(2)) });
                        chosenFood = requiredAmount;
                        chosenWater = requiredAmount;
                    } else {
                        await eksekusiKonsumsiLogistikTerpadu(actor, chosenFood, chosenWater);
                    }

                    if (!isLongRest) {
                        const isShortFed = chosenFood >= 1 && chosenWater >= 1;
                        if (!isShortFed) {
                            let currentExhaustion = actor.system.attributes?.exhaustion ?? 0;
                            let newExhaustion = Math.min(6, currentExhaustion + 1);
                            await actor.update({ "system.attributes.exhaustion": newExhaustion });

                            let chatContent = `
                                <div class="rawgrim-sys-card starvation">
                                    <h4 class="rawgrim-card-title">Short Rest Interrupted</h4>
                                    <p class="rawgrim-card-sub"><strong>${actorName}</strong> lacks the food or water needed to rest safely.</p>
                                    <table class="rawgrim-table-compact">
                                        <thead><tr><th>Supplies Used</th><th>Result</th></tr></thead>
                                        <tbody><tr><td>Food ${chosenFood}/1<br/>Water ${chosenWater}/1</td><td class="rg-status-zero">Exhaustion ${newExhaustion}</td></tr></tbody>
                                    </table>
                                    <p class="rawgrim-card-note">Short rest penalty: +1 exhaustion.</p>
                                </div>
                            `;
                            await ChatMessage.create({ content: chatContent, speaker: { alias: 'Laws of Rawgrim' } });
                            ui.notifications.warn(`${actor.name} suffers exhaustion.`);
                        } else {
                            let chatContent = `
                                <div class="rawgrim-sys-card rest-short">
                                    <h4 class="rawgrim-card-title">Short Rest Complete</h4>
                                    <p class="rawgrim-card-sub"><strong>${actorName}</strong> spends 1 ration and 1 water, then gains the benefits of a short rest.</p>
                                </div>
                            `;
                            await ChatMessage.create({ content: chatContent, speaker: { alias: 'Laws of Rawgrim' } });
                        }
                    }

                    if (isLongRest) {
                        const minPorsi = Math.min(chosenFood, chosenWater);
                        const sustenanceState = getLongRestSustenanceState(minPorsi);
                        const finalPenaltyLevel = sustenanceState.penaltyLevel;

                        if (finalPenaltyLevel > 0) {
                            const currentExhaustion = actor.system.attributes?.exhaustion ?? 0;
                            const newExhaustion = isGrittyRest
                                ? Math.max(currentExhaustion, finalPenaltyLevel)
                                : Math.min(6, currentExhaustion + 1);

                            await actor.update({ "system.attributes.exhaustion": newExhaustion });

                            let chatContent = `
                                <div class="rawgrim-sys-card starvation">
                                    <h4 class="rawgrim-card-title">Long Rest Interrupted</h4>
                                    <p class="rawgrim-card-sub"><strong>${actorName}</strong> lacks the food or water needed to rest safely.</p>
                                    <table class="rawgrim-table-compact">
                                        <thead><tr><th>Supplies Used</th><th>Result</th></tr></thead>
                                        <tbody><tr><td>Food ${chosenFood}/${requiredAmount}<br/>Water ${chosenWater}/${requiredAmount}</td><td class="${sustenanceState.className}">Exhaustion ${newExhaustion}</td></tr></tbody>
                                    </table>
                                    <p class="rawgrim-card-note">${sustenanceState.message}</p>
                                </div>
                            `;
                            await ChatMessage.create({ content: chatContent, speaker: { alias: 'Laws of Rawgrim' } });
                            ui.notifications.error(`${actor.name}'s body decays to Exhaustion Level ${newExhaustion}.`);
                            return; 
                        } else {
                            let lifestyleText = useGoldFunding ? `Paid ${goldTax} GP for food and water.` : "Food and water were taken from inventory.";
                            let chatContent = `
                                <div class="rawgrim-sys-card rest-long">
                                    <h4 class="rawgrim-card-title">Long Rest Complete</h4>
                                    <p class="rawgrim-card-sub"><strong>${actorName}</strong> completes the ${restDurationLabel} and gains the benefits of a long rest.</p>
                                    <p class="rawgrim-card-note">${lifestyleText}</p>
                                </div>
                            `;
                            await ChatMessage.create({ content: chatContent, speaker: { alias: 'Laws of Rawgrim' } });
                        }
                    }

                    await actor.setFlag('rawgrim-toll-of-survival', 'bypassSustenance', true);
                    if (isLongRest) {
                        await actor.longRest({ dialog: false });
                    } else {
                        await actor.shortRest({ dialog: true });
                    }

                    setTimeout(async () => {
                        await actor.unsetFlag('rawgrim-toll-of-survival', 'bypassSustenance');
                    }, 1200);
                }
            }
        },
        default: "confirm"
    }, { width: 440, classes: ["rawgrim-dialog-window-large"] });

    dialogWindow.render(true);

    setTimeout(() => {
        const foodVal = document.getElementById('rg-food-val');
        const waterVal = document.getElementById('rg-water-val');
        const alertText = document.getElementById('rg-alert-text');
        const goldTaxDisplay = document.getElementById('rg-gold-tax-display');
        const lifestyleSelect = document.getElementById('rg-lifestyle-select');

        let selectedFood = 0;
        let selectedWater = 0;

        function dapatkanKelasWarna(nilai) {
            if (nilai === 0) return "rg-status-zero";
            if (nilai < requiredAmount) return "rg-status-min";
            return "rg-status-full";
        }

        function kalkulasiAturanVisual() {
            foodVal.className = "rawgrim-sustenance-count " + dapatkanKelasWarna(selectedFood);
            waterVal.className = "rawgrim-sustenance-count " + dapatkanKelasWarna(selectedWater);

            const minPorsi = Math.min(selectedFood, selectedWater);

            if (isLongRest && lifestyleSelect && lifestyleSelect.value !== "none") {
                const type = lifestyleSelect.value;
                let mult = type === "cheap" ? 0.5 : (type === "luxury" ? 2.0 : 1.0);
                let totalCost = (((baseRationPrice * requiredAmount) + (baseWaterPrice * requiredAmount)) * mult).toFixed(2);
                goldTaxDisplay.textContent = `Cost: ${totalCost} GP`;
                alertText.innerHTML = `<span class="rg-status-full"><i class="fas fa-check-circle"></i> Paid supplies cover this ${restDurationLabel}. No sustenance penalty.</span>`;
                return;
            }

            if (isLongRest) {
                const state = getLongRestSustenanceState(minPorsi);
                alertText.innerHTML = `<span class="${state.className}"><i class="fas fa-info-circle"></i> <strong>${state.label}:</strong> ${state.message}</span>`;
            } else {
                if (selectedFood >= 1 && selectedWater >= 1) {
                    alertText.innerHTML = `<span class="rg-status-full"><i class="fas fa-check"></i> Short rest sustenance secured for the 8-hour block.</span>`;
                } else {
                    alertText.innerHTML = `<span class="rg-status-zero"><i class="fas fa-exclamation-triangle"></i> A short rest needs 1 ration and 1 water. Missing either one gives +1 exhaustion.</span>`;
                }
            }
        }

        kalkulasiAturanVisual();

        document.getElementById('rg-food-plus')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (selectedFood < Math.min(physicalFoodCount, requiredAmount)) {
                selectedFood++;
                foodVal.textContent = selectedFood;
                kalkulasiAturanVisual();
            }
        });

        document.getElementById('rg-food-minus')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (selectedFood > 0) {
                selectedFood--;
                foodVal.textContent = selectedFood;
                kalkulasiAturanVisual();
            }
        });

        document.getElementById('rg-water-plus')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (selectedWater < Math.min(physicalWaterCount, requiredAmount)) {
                selectedWater++;
                waterVal.textContent = selectedWater;
                kalkulasiAturanVisual();
            }
        });

        document.getElementById('rg-water-minus')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (selectedWater > 0) {
                selectedWater--;
                waterVal.textContent = selectedWater;
                kalkulasiAturanVisual();
            }
        });

        lifestyleSelect?.addEventListener('change', (e) => {
            kalkulasiAturanVisual();
        });
    }, 150);
};
