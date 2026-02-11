// ==UserScript==
// @name         Shoptet LabelApp Integration
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Import orders from Shoptet to LabelApp
// @author       You
// @match        https://*.shoptet.cz/admin/prehled-objednavek/*
// @match        https://www.vsebezlepku.cz/admin/prehled-objednavek/*
// @grant        GM_xmlhttpRequest
// @connect      vsebezlepku-orders.vercel.app
// @connect      localhost
// @connect      vsebezlepku.cz
// ==/UserScript==

(function() {
    'use strict';

    const LABEL_APP_URL = 'https://vsebezlepku-orders.vercel.app';
    // For local testing, uncomment this:
    // const LABEL_APP_URL = 'http://localhost:3000';

    let isRunning = false;
    let shouldStop = false;

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
        .labelapp-btn.danger {
            background-color: #f44336;
        }
        .labelapp-btn.danger:hover {
            background-color: #d32f2f;
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
        <button id="labelapp-stop" class="labelapp-btn danger" style="display:none;">Stop</button>
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
    const stopBtn = document.getElementById('labelapp-stop');
    const updateBtn = document.getElementById('labelapp-update-btn');
    const updateContainer = document.getElementById('labelapp-update-container');
    const orderIdInput = document.getElementById('labelapp-order-id');
    const updateConfirmBtn = document.getElementById('labelapp-update-confirm');

    function setStatus(msg, isError = false) {
        statusEl.textContent = msg;
        statusEl.style.color = isError ? '#f44336' : '#666';
    }

    // Fetch order details from Shoptet order detail page
    async function fetchOrderDetails(orderId) {
        try {
            const response = await fetch(`/admin/objednavky-detail/?id=${orderId}`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const order = {
                orderNumber: '',
                totalPrice: '',
                items: []
            };

            // Find order number from the page
            const orderCodeEl = doc.querySelector('.orderCode, [class*="orderCode"], strong.code');
            if (orderCodeEl) {
                order.orderNumber = orderCodeEl.textContent.trim();
            }

            // Find total price
            const totalEl = doc.querySelector('.order-summary-total, .totalPrice');
            if (totalEl) {
                order.totalPrice = totalEl.textContent.trim();
            }

            // Find items from the products table - only rows that have a product link
            const itemRows = doc.querySelectorAll('table.checkbox-table tbody tr');
            itemRows.forEach(row => {
                // Check if this is a product row by looking for product detail link
                const codeCell = row.querySelector('td[data-testid="cellOrderItemCode"]');
                const productLink = codeCell ? codeCell.querySelector('a[href*="/admin/produkty-detail/"]') : null;
                
                // Skip non-product rows (shipping, payment methods, etc.)
                if (!productLink) {
                    return;
                }

                // Get product name from description cell
                const descrCell = row.querySelector('td[data-testid="cellOrderItemDescr"]');
                const nameLink = descrCell ? descrCell.querySelector('a.table__detailLink') : null;
                
                if (!nameLink) return;

                // Extract just the product name, excluding manufacturer info
                let productName = '';
                const nameNode = nameLink.childNodes[0];
                if (nameNode && nameNode.nodeType === Node.TEXT_NODE) {
                    productName = nameNode.textContent.trim();
                } else {
                    // Fallback: get text before <br> or <span>
                    productName = nameLink.innerHTML.split('<br')[0].split('<span')[0].trim();
                    // Clean up any HTML entities
                    const temp = document.createElement('div');
                    temp.innerHTML = productName;
                    productName = temp.textContent.trim();
                }

                if (!productName || productName.length < 3) return;

                // Get quantity
                const quantityCell = row.querySelector('td[data-testid="cellOrderItemAmount"]');
                let quantity = 1;
                if (quantityCell) {
                    const quantityText = quantityCell.textContent.trim();
                    const match = quantityText.match(/(\d+)/);
                    if (match) {
                        quantity = parseInt(match[1]) || 1;
                    }
                }

                // Get unit price
                const priceCell = row.querySelector('td[data-testid="cellOrderItemPrice"]');
                const unitPrice = priceCell ? priceCell.textContent.trim() : null;

                // Get product URL
                const productUrl = productLink.href || null;

                order.items.push({
                    productName,
                    quantity,
                    unitPrice,
                    productUrl
                });
            });

            return order;
        } catch (e) {
            console.error('Failed to fetch order details:', e);
            return null;
        }
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

    // Get all order IDs from the page
    function getOrderIdsFromPage() {
        const orderIds = [];
        const orderNumbers = [];
        
        // Find all order links and extract IDs
        document.querySelectorAll('a[href*="/admin/objednavky-detail/"]').forEach(link => {
            const match = link.href.match(/id=(\d+)/);
            if (match) {
                const id = match[1];
                // Find order number nearby
                const row = link.closest('tr');
                if (row) {
                    const strongEls = row.querySelectorAll('strong');
                    strongEls.forEach(el => {
                        const text = el.textContent.trim();
                        if (text.match(/^O\d{9,}$/)) {
                            if (!orderNumbers.includes(text)) {
                                orderIds.push({ id, orderNumber: text });
                                orderNumbers.push(text);
                            }
                        }
                    });
                }
            }
        });

        return orderIds;
    }

    // Get all orders from the page
    async function getAllOrders(existingOrderNumbers) {
        const orders = [];
        const orderInfos = getOrderIdsFromPage();

        setStatus(`Found ${orderInfos.length} orders on page, checking for new ones...`);

        // Filter to only new orders first
        const newOrderInfos = orderInfos.filter(o => !existingOrderNumbers.includes(o.orderNumber));
        
        if (newOrderInfos.length === 0) {
            return [];
        }

        setStatus(`Found ${newOrderInfos.length} new orders, fetching details...`);

        for (let i = 0; i < newOrderInfos.length; i++) {
            if (shouldStop) {
                setStatus('Stopped by user');
                break;
            }

            const info = newOrderInfos[i];
            setStatus(`Fetching ${i + 1}/${newOrderInfos.length}: ${info.orderNumber}...`);

            const order = await fetchOrderDetails(info.id);
            if (order && order.items.length > 0) {
                order.orderNumber = info.orderNumber; // Use the order number we found
                orders.push(order);
                console.log('Fetched order:', info.orderNumber, 'with', order.items.length, 'items');
            } else {
                console.log('Failed to fetch or parse order:', info.orderNumber);
            }

            // Small delay to avoid hammering the server
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return orders;
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

    // Stop button handler
    stopBtn.addEventListener('click', () => {
        shouldStop = true;
        setStatus('Stopping...');
    });

    // Add new orders button handler
    addBtn.addEventListener('click', async () => {
        if (isRunning) return;
        
        isRunning = true;
        shouldStop = false;
        addBtn.disabled = true;
        stopBtn.style.display = 'block';
        setStatus('Fetching existing orders from LabelApp...');

        try {
            // Get existing order numbers
            const existingOrderNumbers = await getExistingOrderNumbers();
            setStatus(`Found ${existingOrderNumbers.length} existing orders in LabelApp`);

            // Get all orders from page (only new ones)
            const newOrders = await getAllOrders(existingOrderNumbers);
            console.log('Orders to add:', newOrders.map(o => o.orderNumber));

            if (shouldStop) {
                addBtn.disabled = false;
                stopBtn.style.display = 'none';
                isRunning = false;
                return;
            }

            if (newOrders.length === 0) {
                setStatus('No new orders to add.');
                addBtn.disabled = false;
                stopBtn.style.display = 'none';
                isRunning = false;
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
        stopBtn.style.display = 'none';
        isRunning = false;
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
            // Find order ID from page
            const orderInfos = getOrderIdsFromPage();
            const info = orderInfos.find(o => o.orderNumber === orderNumber);

            if (!info) {
                setStatus(`Order ${orderNumber} not found on this page`, true);
                updateConfirmBtn.disabled = false;
                return;
            }

            setStatus(`Fetching order details...`);
            const order = await fetchOrderDetails(info.id);

            if (!order || order.items.length === 0) {
                setStatus(`Could not fetch order details`, true);
                updateConfirmBtn.disabled = false;
                return;
            }

            order.orderNumber = orderNumber;
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
