// ==UserScript==
// @name         Shoptet Sklad → VšeBezLepku Expirace
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Synchronizuje stavy skladu do VšeBezLepku aplikace pro sledování trvanlivosti
// @author       VšeBezLepku
// @match        *://*.myshoptet.com/admin/sklad/*
// @match        *://*.shoptet.cz/admin/sklad/*
// @include      */admin/sklad/*
// @connect      vsebezlepku-orders.vercel.app
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    const APP_URL = 'https://vsebezlepku-orders.vercel.app';
    // For local testing, uncomment this:
    // const APP_URL = 'http://localhost:3000';

    let debounceTimer = null; // kept for potential future use

    console.log("VšeBezLepku Expirace: Script v1.0 spuštěn.");

    function processRows(force = false) {
        let selector = 'tr[data-lasteditedid]:not(.tm-exp-processed)';
        if (force) selector = 'tr[data-lasteditedid]';

        const rows = document.querySelectorAll(selector);

        if (rows.length === 0) {
            if (force) updateButtonStatus("Žádné produkty", false);
            return;
        }

        updateButtonStatus("Hledám produkty (>0 ks)...", true);

        const batchData = [];
        const rowsMap = new Map();
        let skippedCount = 0;

        rows.forEach((row) => {
            row.classList.add('tm-exp-processed');

            const codeCell = row.querySelector('td:nth-child(3) span');
            const stockInput = row.querySelector('input[name^="stock"]');

            const nameContainer = row.querySelector('.name-inner');
            const nameStrong = row.querySelector('.name-inner strong');
            const targetEl = nameStrong || nameContainer;

            if (codeCell && stockInput && targetEl) {
                const code = codeCell.innerText.trim();
                const stock = stockInput.value.trim();
                const stockNum = parseInt(stock, 10);

                if (code && !isNaN(stockNum) && stockNum > 0) {
                    let productName = "";
                    if (nameStrong) {
                        productName = nameStrong.innerText.trim();
                    } else if (nameContainer) {
                        productName = nameContainer.innerText.trim().split('\n')[0];
                    }

                    batchData.push({
                        code: code,
                        stock: stock,
                        name: productName
                    });

                    rowsMap.set(code, row);

                    if (force) {
                        const oldInfo = row.querySelector('.tm-vbl-info');
                        if (oldInfo) oldInfo.remove();
                    }
                } else {
                    skippedCount++;
                }
            }
        });

        if (batchData.length === 0) {
            updateButtonStatus("Hotovo (0ks vynecháno)", false);
            setTimeout(() => updateButtonStatus("🔄 Sync trvanlivosti", false), 2000);
            return;
        }

        updateButtonStatus(`Odesílám ${batchData.length} produktů...`, true);
        sendBatchToApp(batchData, rowsMap);
    }

    function sendBatchToApp(batchData, rowsMap) {
        GM_xmlhttpRequest({
            method: "POST",
            url: `${APP_URL}/api/stock`,
            data: JSON.stringify({ items: batchData }),
            headers: { "Content-Type": "application/json" },
            timeout: 30000,
            onload: function(response) {
                if (response.status === 200) {
                    try {
                        const responseMap = JSON.parse(response.responseText);

                        for (const [code, data] of Object.entries(responseMap)) {
                            const row = rowsMap.get(code);
                            if (row) {
                                const nameContainer = row.querySelector('.name-inner');
                                const nameStrong = row.querySelector('.name-inner strong');
                                displayExpirationInfo(data, nameStrong || nameContainer);
                            }
                        }
                        updateButtonStatus("✅ Hotovo", false);
                        setTimeout(() => updateButtonStatus("🔄 Sync trvanlivosti", false), 2000);
                    } catch (e) {
                        console.error("VšeBezLepku: Chyba JSON:", e);
                        updateButtonStatus("❌ Chyba dat", false);
                    }
                } else {
                    console.error("VšeBezLepku: HTTP chyba", response.status, response.responseText);
                    updateButtonStatus(`❌ Chyba ${response.status}`, false);
                }
            },
            onerror: function(err) {
                console.error("VšeBezLepku: Síťová chyba", err);
                updateButtonStatus("❌ Chyba sítě", false);
            }
        });
    }

    function displayExpirationInfo(data, element) {
        const parent = element.parentNode;
        const oldInfo = parent.querySelector('.tm-vbl-info');
        if (oldInfo) oldInfo.remove();

        if (!data.found || !data.earliest) return;

        const info = data.earliest;
        const expDate = new Date(info.date);
        const today = new Date();

        const diffTime = expDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const dateStr = expDate.toLocaleDateString('cs-CZ');

        const span = document.createElement('span');
        span.className = 'tm-vbl-info';
        span.style.fontWeight = 'bold';
        span.style.marginLeft = '8px';
        span.style.fontSize = '13px';

        let iconHtml = "";
        let textColor = "#333";

        if (diffDays <= 14) {
            textColor = "#d60000";
            iconHtml = " <span style='font-size:1.3em' title='Kritické!'>💀</span>";
        } else if (diffDays <= 30) {
            textColor = "#d60000";
            iconHtml = " <span style='color:#d60000; font-weight:900; font-size:1.3em'>❗</span>";
        } else if (diffDays <= 60) {
            textColor = "#e67e22";
            iconHtml = " <span style='color:#e67e22; font-weight:900; font-size:1.3em'>!</span>";
        } else {
            textColor = "#27ae60";
        }

        span.style.color = textColor;

        // Show total expirations summary
        const totalExpCount = data.expirations.reduce((sum, e) => sum + e.count, 0);
        const unassigned = data.totalCount - totalExpCount;

        let text = `${info.count} ks → ${dateStr}`;
        if (data.expirations.length > 1) {
            text += ` (+${data.expirations.length - 1} další)`;
        }
        if (unassigned > 0) {
            text += ` | ${unassigned} bez data`;
        }

        span.innerText = ` ${text}`;
        if (iconHtml) span.innerHTML += iconHtml;

        if (element.tagName === 'STRONG') element.after(span);
        else element.appendChild(span);
    }

    // --- UI ---
    function createRefreshButton() {
        if (document.getElementById('tm-vbl-btn')) return;

        const btn = document.createElement('div');
        btn.id = 'tm-vbl-btn';
        btn.innerText = '🔄 Sync trvanlivosti';

        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#007bff',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '5px',
            cursor: 'pointer',
            zIndex: '9999',
            boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
            fontWeight: 'bold',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px'
        });

        btn.onclick = () => { processRows(true); };
        document.body.appendChild(btn);
    }

    function updateButtonStatus(text, isLoading) {
        const btn = document.getElementById('tm-vbl-btn');
        if (btn) {
            btn.innerText = text;
            btn.style.backgroundColor = isLoading ? '#e67e22' : '#007bff';
        }
    }

    // Auto-create button when page loads, no auto-sync
    setTimeout(() => {
        createRefreshButton();
    }, 1500);

})();
