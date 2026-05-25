// ==UserScript==
// @name         Allegro Sync - Ultimate (v5.2)
// @namespace    http://tampermonkey.net/
// @version      5.2
// @match        https://salescenter.allegro.com/my-assortment*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
  "use strict";
  var WEB_APP_URL =
    "https://script.google.com/macros/s/AKfycbxsC3R2zl8Gj3xjHPzBaiilIA6get2YebUqhJKfuSnKXApwMDPB8NMhr1JEk4ZgdA/exec";

  var sleep = function (ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  };
  var clean = function (str) {
    if (!str) return "";
    return String(str)
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()
      .trim();
  };

  var isRunning = false;

  async function performAction(row, novyPocet, kod) {
    if (!isRunning) return;

    // --- LOGIKA PRO UKONČENÍ (POKUD JE 0 A MÉNĚ) ---
    if (novyPocet <= 0) {
      console.log(
        "%c🛑 UKONČUJI NABÍDKU: " + kod + " (počet 0)",
        "color: #e74c3c; font-weight: bold;",
      );
      var closeBtn = row.querySelector('button[data-cy="close-offer-btn"]');

      if (closeBtn) {
        closeBtn.click();
        await sleep(2000);

        var confirmBtn = Array.from(document.querySelectorAll("button")).find(
          function (b) {
            var txt = b.innerText.toLowerCase();
            return (
              (txt.includes("ukončit") || txt.includes("zakończ")) &&
              b.offsetParent !== null
            );
          },
        );

        if (confirmBtn && isRunning) {
          confirmBtn.click();
          console.log("%c✅ NABÍDKA UKONČENA: " + kod, "color: #e74c3c;");
          await sleep(4000);
        }
      } else {
        console.error("❌ Tlačítko pro ukončení nenalezeno u " + kod);
      }
      return; // Konec, nejdeme do editace kusů
    }

    // --- LOGIKA PRO ÚPRAVU POČTU (POKUD JE VÍCE NEŽ 0) ---
    var editBtn = row.querySelector(
      'td[data-testid*="column-2"] button[data-testid="edit-price"]',
    );

    if (!editBtn) {
      console.error(
        "%c❌ Tlačítko pro úpravu KUSŮ nenalezeno u " + kod,
        "color: red;",
      );
      return;
    }

    console.log("%c🚀 Otevírám editaci kusů pro " + kod, "color: cyan;");
    editBtn.click();
    await sleep(2500);

    var input = document.querySelector("#fixed-value-input");
    if (input && isRunning) {
      var radio = document.querySelector('input[name="changeType"]');
      if (radio) {
        radio.click();
        await sleep(600);
      }

      input.value = novyPocet;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(1000);

      var saveBtn = Array.from(document.querySelectorAll("button")).find(
        function (b) {
          var txt = b.innerText.toLowerCase();
          return (
            (txt === "uložit" || txt === "zapisz") && b.offsetParent !== null
          );
        },
      );

      if (saveBtn && isRunning) {
        saveBtn.click();
        console.log(
          "%c✅ HOTOVO: " + kod + " nastaveno na " + novyPocet + " ks",
          "color: #2ecc71; font-weight: bold;",
        );
        await sleep(4500);
      }
    }
  }

  var processOffers = function () {
    if (isRunning) return;
    isRunning = true;

    var startBtn = document.getElementById("allegro-sync-btn");
    var stopBtn = document.getElementById("allegro-stop-btn");
    startBtn.disabled = true;
    startBtn.style.background = "#7f8c8d";
    stopBtn.style.display = "block";

    console.clear();
    console.log(
      "%c--- START SYNCHRONIZACE v5.2 ---",
      "color: orange; font-weight: bold; font-size: 14px;",
    );

    GM_xmlhttpRequest({
      method: "GET",
      url: WEB_APP_URL,
      onload: async function (res) {
        var sheetData = JSON.parse(res.responseText);
        var itemsMap = new Map();
        sheetData.forEach(function (item) {
          itemsMap.set(clean(item.kod), {
            original: item.kod,
            nazev: item["Název"] || item.nazev || item.name || "",
            pocet: item.pocet,
          });
        });

        var processedCodes = new Set();
        var lastY = -1;
        var unchangedScrollCount = 0;

        while (isRunning) {
          var rows = document.querySelectorAll("tr[data-cy], tr.msts_hk");

          for (var i = 0; i < rows.length; i++) {
            if (!isRunning) break;
            var row = rows[i];
            var spans = Array.from(row.querySelectorAll("span"));
            var refLabel = spans.find(function (el) {
              return el.textContent.includes("referenční číslo:");
            });

            if (refLabel && refLabel.nextElementSibling) {
              var rawKod = refLabel.nextElementSibling.textContent.trim();
              var cleanedKod = clean(rawKod);

              if (!row.dataset.logged) {
                row.dataset.logged = "true";
              }

              if (itemsMap.has(cleanedKod) && !processedCodes.has(cleanedKod)) {
                var data = itemsMap.get(cleanedKod);
                var novyPocet = data.pocet - 3;

                var stockEl = row.querySelector('[data-testid="stock"]');
                var stavajiciPocet = parseInt(
                  stockEl ? stockEl.textContent : "-1",
                );
                var jeAktivni = row.innerText.toLowerCase().includes("aktivní");

                if (jeAktivni) {
                  if (novyPocet !== stavajiciPocet || novyPocet <= 0) {
                    console.log(
                      "%c🎯 SHODA: " +
                        rawKod +
                        " (Změna: " +
                        stavajiciPocet +
                        " -> " +
                        novyPocet +
                        ")",
                      "background: #27ae60; color: white; padding: 2px;",
                    );
                    row.style.outline = "4px solid #2ecc71";
                    await performAction(row, novyPocet, rawKod);
                  } else {
                    console.log(
                      "%cℹ️ OK: " +
                        rawKod +
                        " (Stav " +
                        stavajiciPocet +
                        " ks souhlasí)",
                      "color: #95a5a6;",
                    );
                  }
                  processedCodes.add(cleanedKod);
                }
              }
            }
          }

          if (processedCodes.size >= itemsMap.size) break;

          lastY = window.scrollY;
          window.scrollBy(0, 750);
          console.log(
            "%cSkenuji dál... nalezeno " +
              processedCodes.size +
              " z " +
              itemsMap.size,
            "color: #3498db;",
          );
          await sleep(1800);

          if (window.scrollY === lastY) {
            unchangedScrollCount++;
            if (unchangedScrollCount > 4) break;
          } else {
            unchangedScrollCount = 0;
          }
        }

        // Log products from sheet not found on Allegro (with >= 4 pieces)
        var notFound = [];
        itemsMap.forEach(function (data, cleanedKod) {
          if (!processedCodes.has(cleanedKod) && data.pocet >= 4) {
            notFound.push(data);
          }
        });

        if (notFound.length > 0) {
          console.log(
            "%c--- PRODUKTY Z SHEETU NENALEZENÉ NA ALLEGRU (≥4 ks) ---",
            "color: #e74c3c; font-weight: bold; font-size: 13px;",
          );
          notFound.forEach(function (item) {
            console.log(
              "%c📦 " +
                item.original +
                " | " +
                item.nazev +
                " | " +
                item.pocet +
                " ks",
              "color: #e67e22; font-weight: bold;",
            );
          });
          console.log(
            "%cCelkem nenalezeno: " + notFound.length + " produktů",
            "color: #e74c3c;",
          );
        }

        isRunning = false;
        startBtn.disabled = false;
        startBtn.style.background = "#e67e22";
        stopBtn.style.display = "none";
        alert(
          "Synchronizace hotova! Nalezeno: " +
            processedCodes.size +
            "/" +
            itemsMap.size +
            (notFound.length > 0
              ? "\nNenalezeno (≥4ks): " + notFound.length
              : ""),
        );
      },
    });
  };

  // UI Tlačítka
  var btn = document.createElement("button");
  btn.id = "allegro-sync-btn";
  btn.innerHTML = "🚀 Sync Allegro (v5.2)";
  btn.style =
    "position:fixed; bottom:20px; right:20px; z-index:99999; padding:15px; background:#e67e22; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;";
  btn.onclick = processOffers;
  document.body.appendChild(btn);

  var stopBtn = document.createElement("button");
  stopBtn.id = "allegro-stop-btn";
  stopBtn.innerHTML = "🛑 STOP";
  stopBtn.style =
    "position:fixed; bottom:80px; right:20px; z-index:99999; padding:15px; background:#c0392b; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer; display:none;";
  stopBtn.onclick = function () {
    isRunning = false;
  };
  document.body.appendChild(stopBtn);
})();
