// ==UserScript==
// @name         Shoptet LabelApp Integration
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Import orders from Shoptet to LabelApp
// @author       You
// @match        https://*.shoptet.cz/admin/prehled-objednavek/*
// @match        https://www.vsebezlepku.cz/admin/prehled-objednavek/*
// @grant        GM_xmlhttpRequest
// @connect      vsebezlepku-orders.vercel.app
// @connect      localhost
// ==/UserScript==

(function() {
    'use strict';

    const LABEL_APP_URL = 'https://vsebezlepku-orders.vercel.app';
    // For local testing, uncomment this:
    // const LABEL_APP_URL = 'http://localhost:3000';

    // Add custom styles
    const style = document.createElement('style');
    style.textContent = `
        .labelapp-btn {
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin: 5px;
        }
        .labelapp-btn:hover {
            background-color: #45a049;
        }
        .labelapp-btn.secondary {
            background-color: #2196F3;
        }
        .labelapp-btn.secondary:hover {
            background-color: #1976D2;
        }
        .labelapp-btn:disabled {
            background-color: #cccccc;
            cursor: not-allowed;
        }
        .labelapp-container {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            display: flex;
            flex-direction: column;
            gap: 10px;
        }
        .labelapp-status {
            font-size: 12px;
            color: #666;
            max-width: 300px;
        }
        .labelapp-input-container {
            display: none;
            flex-direction: column;
            gap: 5px;
        }
        .labelapp-input-container.visible {
            display: flex;
        }
        .labelapp-input {
            padding: 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }
    `;
    document.head.appendChild(style);

    // Create UI container
    const container = document.createElement('div');
    container.className = 'labelapp-container';
    container.innerHTML = `
        <button id="labelapp-add" class="labelapp-btn">Add into LabelApp</button>
        <button id="labelapp-update-btn" class="labelapp-btn secondary">Update order in LabelApp</button>
        <div id="labelapp-update-container" class="labelapp-input-container">
            <input type="text" id="labelapp-order-id" class="labelapp-input" placeholder="Order ID (e.g., O202500300)">
            <button id="labelapp-update-confirm" class="labelapp-btn secondary">Update</button>
        </div>
        <div id="labelapp-status" class="labelapp-status"></div>
    `;
    document.body.appendChild(container);

    const statusEl = document.getElementById('labelapp-status');
    const addBtn = document.getElementById('labelapp-add');
    const updateBtn = document.getElementById('labelapp-update-btn');
    const updateContainer = document.getElementById('labelapp-update-container');
    const orderIdInput = document.getElementById('labelapp-order-id');
    const updateConfirmBtn = document.getElementById('labelapp-update-confirm');

    function setStatus(msg, isError = false) {
        statusEl.textContent = msg;
        statusEl.style.color = isError ? '#f44336' : '#666';
    }

    // Parse order data from the preview popup
    function parseOrderFromPreview(previewEl) {
        const order = {
            orderNumber: '',
            totalPrice: '',
            items: []
        };

        // Get order number
        const orderNumEl = previewEl.querySelector('.preview-item-number');
        if (orderNumEl) {
            order.orderNumber = orderNumEl.textContent.trim();
        }

        // Parse items from table
        const rows = previewEl.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const productLink = row.querySelector('td a.table__detailLink');
            const quantityCell = row.querySelector('td.table__cell--number');
            const priceCell = row.querySelector('td.table__cell--pricePrimary');

            if (productLink) {
                const productName = productLink.textContent.trim().replace(/\s+/g, ' ').replace(/<br\s*\/?>/gi, '').trim();
                const quantity = quantityCell ? parseInt(quantityCell.textContent.replace(/\D/g, '')) || 1 : 1;
                const unitPrice = priceCell ? priceCell.textContent.trim() : null;
                const productUrl = productLink.href || null;

                if (productName) {
                    order.items.push({
                        productName,
                        quantity,
                        unitPrice,
                        productUrl
                    });
                }
            }
        });

        return order;
    }

    // Get all orders from the page by triggering hover on each row
    async function getAllOrders() {
        const orders = [];
        const orderRows = document.querySelectorAll('table.checkbox-table tbody tr');

        setStatus(`Found ${orderRows.length} order rows, scanning...`);

        for (let i = 0; i < orderRows.length; i++) {
            const row = orderRows[i];

            // Trigger mouseenter to show preview
            const event = new MouseEvent('mouseenter', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            row.dispatchEvent(event);

            // Wait for preview to appear
            await new Promise(resolve => setTimeout(resolve, 300));

            // Find the preview popup
            const preview = document.getElementById('item-preview');
            if (preview && preview.style.display !== 'none') {
                const order = parseOrderFromPreview(preview);
                if (order.orderNumber && order.items.length > 0) {
                    orders.push(order);
                }
            }

            // Hide preview
            const leaveEvent = new MouseEvent('mouseleave', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            row.dispatchEvent(leaveEvent);

            setStatus(`Scanned ${i + 1}/${orderRows.length} orders...`);
        }

        return orders;
    }

    // Get single order by triggering hover
    async function getOrderByNumber(orderNumber) {
        const orderRows = document.querySelectorAll('table.checkbox-table tbody tr');

        for (const row of orderRows) {
            // Check if this row contains the order number
            if (row.textContent.includes(orderNumber)) {
                // Trigger mouseenter
                const event = new MouseEvent('mouseenter', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                row.dispatchEvent(event);

                await new Promise(resolve => setTimeout(resolve, 300));

                const preview = document.getElementById('item-preview');
                if (preview) {
                    const order = parseOrderFromPreview(preview);

                    // Hide preview
                    const leaveEvent = new MouseEvent('mouseleave', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    row.dispatchEvent(leaveEvent);

                    if (order.orderNumber === orderNumber) {
                        return order;
                    }
                }
            }
        }

        return null;
    }

    // Fetch existing order numbers from LabelApp
    async function getExistingOrderNumbers() {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `${LABEL_APP_URL}/api/orders/shoptet`,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data.orderNumbers || []);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Send orders to LabelApp
    async function sendOrdersToLabelApp(orders) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `${LABEL_APP_URL}/api/orders/shoptet`,
                headers: {
                    'Content-Type': 'application/json'
                },
                data: JSON.stringify({ orders }),
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        resolve(data);
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: function(error) {
                    reject(error);
                }
            });
        });
    }

    // Add new orders button handler
    addBtn.addEventListener('click', async () => {
        addBtn.disabled = true;
        setStatus('Fetching existing orders from LabelApp...');

        try {
            // Get existing order numbers
            const existingOrderNumbers = await getExistingOrderNumbers();
            setStatus(`Found ${existingOrderNumbers.length} existing orders in LabelApp`);

            // Get all orders from page
            const allOrders = await getAllOrders();
            setStatus(`Scanned ${allOrders.length} orders from Shoptet`);

            // Filter out existing orders
            const newOrders = allOrders.filter(o => !existingOrderNumbers.includes(o.orderNumber));

            if (newOrders.length === 0) {
                setStatus('No new orders to add. All orders already exist in LabelApp.');
                addBtn.disabled = false;
                return;
            }

            setStatus(`Sending ${newOrders.length} new orders to LabelApp...`);

            // Send to LabelApp
            const result = await sendOrdersToLabelApp(newOrders);

            if (result.created > 0 || result.updated > 0) {
                setStatus(`Success! Created: ${result.created}, Updated: ${result.updated}`);
            } else if (result.errors && result.errors.length > 0) {
                setStatus(`Errors: ${result.errors.join(', ')}`, true);
            } else {
                setStatus('No orders were processed.');
            }

        } catch (error) {
            console.error('LabelApp error:', error);
            setStatus(`Error: ${error.message || 'Unknown error'}`, true);
        }

        addBtn.disabled = false;
    });

    // Toggle update input container
    updateBtn.addEventListener('click', () => {
        updateContainer.classList.toggle('visible');
        if (updateContainer.classList.contains('visible')) {
            orderIdInput.focus();
        }
    });

    // Update single order button handler
    updateConfirmBtn.addEventListener('click', async () => {
        const orderNumber = orderIdInput.value.trim();
        if (!orderNumber) {
            setStatus('Please enter an order ID', true);
            return;
        }

        updateConfirmBtn.disabled = true;
        setStatus(`Looking for order ${orderNumber}...`);

        try {
            const order = await getOrderByNumber(orderNumber);

            if (!order) {
                setStatus(`Order ${orderNumber} not found on this page`, true);
                updateConfirmBtn.disabled = false;
                return;
            }

            setStatus(`Found order with ${order.items.length} items. Updating...`);

            const result = await sendOrdersToLabelApp([order]);

            if (result.created > 0) {
                setStatus(`Order ${orderNumber} created in LabelApp`);
            } else if (result.updated > 0) {
                setStatus(`Order ${orderNumber} updated in LabelApp`);
            } else if (result.errors && result.errors.length > 0) {
                setStatus(`Error: ${result.errors.join(', ')}`, true);
            }

            orderIdInput.value = '';
            updateContainer.classList.remove('visible');

        } catch (error) {
            console.error('LabelApp error:', error);
            setStatus(`Error: ${error.message || 'Unknown error'}`, true);
        }

        updateConfirmBtn.disabled = false;
    });

    // Enter key handler for input
    orderIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            updateConfirmBtn.click();
        }
    });

    setStatus('LabelApp Integration ready');
})();
