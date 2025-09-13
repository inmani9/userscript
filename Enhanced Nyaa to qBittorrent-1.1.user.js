// ==UserScript==
// @name         Enhanced Nyaa to qBittorrent
// @namespace    https://violentmonkey.github.io/
// @version      1.1
// @description  Add torrents to qBittorrent with enhanced security, UI feedback and configuration
// @author       ashwnn (improved version)
// @match        https://nyaa.si/*
// @match        https://sukebei.nyaa.si/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @connect      *
// ==/UserScript==

(function () {
    'use strict';

    // Default configuration with settings stored securely
    let qBittorrentConfig = GM_getValue('qBittorrentConfig', {
        host: 'http://localhost:8080',
        username: '',
        password: '', // Don't store plain password in default config
        category: '',
        savePath: '',
        autoTMM: true,
        sequentialDownload: false,
        firstLastPiecePrio: false
    });

    // Status indicators
    let statusMessage = null;
    let statusTimeout = null;

    // Initialize
    createStyles();
    setupMenuCommands();
    refresh();

    // Add click listeners for both magnet links and .torrent download links
    document.addEventListener('click', async function (e) {
        // Handle magnet links
        if (e.target.tagName == 'A' && e.target.href.startsWith('magnet:')) {
            e.preventDefault();
            e.stopPropagation();
            const magnet = e.target.href;
            const torrentName = extractTorrentName(magnet);

            // Show loading status
            showStatus('Adding magnet...', 'loading');

            const result = await addMagnet(magnet);
            if (result.success) {
                showStatus(`✓ Added: ${torrentName}`, 'success');
            } else {
                showStatus(`✗ Failed: ${result.error}`, 'error');
            }
            return false;
        }

        // Handle .torrent download links
        if (e.target.classList.contains('fa-download')) {
            // Get the torrent URL
            const torrentUrl = e.target.parentNode.href;
            const rowElement = findParentRow(e.target);
            const torrentName = rowElement ? rowElement.querySelector('td:nth-child(2) a').textContent.trim() : 'Torrent';

            // Ask user if they want to add it directly to qBittorrent
            if (confirm(`Add "${torrentName}" directly to qBittorrent?`)) {
                e.preventDefault();
                e.stopPropagation();

                // Show loading status
                showStatus('Downloading torrent...', 'loading');

                // Download and add the torrent file
                const result = await downloadAndAddTorrent(torrentUrl, torrentName);
                if (result.success) {
                    showStatus(`✓ Added: ${torrentName}`, 'success');
                } else {
                    showStatus(`✗ Failed: ${result.error}`, 'error');
                }
                return false;
            }
        }
    });

    // Helper to find parent row of an element
    function findParentRow(element) {
        let current = element;
        while (current && current.tagName !== 'TR') {
            current = current.parentElement;
        }
        return current;
    }

    // Extract torrent name from magnet link
    function extractTorrentName(magnetLink) {
        const match = magnetLink.match(/dn=([^&]+)/);
        if (match && match[1]) {
            return decodeURIComponent(match[1]).replace(/\+/g, ' ');
        }
        return 'Unknown';
    }

    // Create status display styles
    function createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #qbit-status {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 10px 15px;
                border-radius: 5px;
                z-index: 9999;
                font-weight: bold;
                transition: opacity 0.3s;
                max-width: 80%;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            }
            #qbit-status.loading {
                background-color: #f8f9fa;
                color: #333;
                border-left: 4px solid #007bff;
            }
            #qbit-status.success {
                background-color: #d4edda;
                color: #155724;
                border-left: 4px solid #28a745;
            }
            #qbit-status.error {
                background-color: #f8d7da;
                color: #721c24;
                border-left: 4px solid #dc3545;
            }
            .nyaa-add-button {
                display: inline-block;
                margin-left: 5px;
                padding: 2px 6px;
                background: #337ab7;
                color: white;
                border-radius: 3px;
                font-size: 12px;
                cursor: pointer;
                vertical-align: middle;
            }
            .nyaa-add-button:hover {
                background: #286090;
            }
        `;
        document.head.appendChild(style);
    }

    // Show status message
    function showStatus(message, type) {
        if (!statusMessage) {
            statusMessage = document.createElement('div');
            statusMessage.id = 'qbit-status';
            document.body.appendChild(statusMessage);
        }

        // Clear existing timeout
        if (statusTimeout) {
            clearTimeout(statusTimeout);
        }

        statusMessage.textContent = message;
        statusMessage.className = type;

        // Auto-hide after delay (longer for errors)
        const delay = type === 'error' ? 5000 : 3000;
        statusTimeout = setTimeout(() => {
            statusMessage.style.opacity = '0';
            setTimeout(() => {
                if (statusMessage.parentNode) {
                    statusMessage.parentNode.removeChild(statusMessage);
                    statusMessage = null;
                }
            }, 300);
        }, delay);
    }

    // Setup menu commands
    function setupMenuCommands() {
        GM_registerMenuCommand("Configure qBittorrent Connection", configureConnection);
        GM_registerMenuCommand("Configure Download Options", configureDownloadOptions);
        GM_registerMenuCommand("Test Connection", testConnection);
    }

    // Configuration dialog
    function configureConnection() {
        const host = prompt("qBittorrent WebUI URL:", qBittorrentConfig.host);
        if (host === null) return;

        const username = prompt("Username:", qBittorrentConfig.username);
        if (username === null) return;

        const password = prompt("Password (leave empty to keep current):", "");

        qBittorrentConfig.host = host;
        qBittorrentConfig.username = username;
        if (password !== "") {
            qBittorrentConfig.password = password;
        }

        GM_setValue('qBittorrentConfig', qBittorrentConfig);

        // Clear the stored session ID to force re-authentication
        GM_setValue("SID", null);

        // Re-authenticate with new settings
        refresh().then(() => {
            testConnection();
        });
    }

    // Download options configuration
    function configureDownloadOptions() {
        const category = prompt("Default category (leave empty for none):", qBittorrentConfig.category);
        if (category === null) return;

        const savePath = prompt("Default save path (leave empty for qBittorrent default):", qBittorrentConfig.savePath);
        if (savePath === null) return;

        const autoTMM = confirm("Use Automatic Torrent Management?");

        const sequentialDownload = confirm("Enable Sequential Download?");

        const firstLastPiecePrio = confirm("Download first and last pieces first?");

        qBittorrentConfig.category = category;
        qBittorrentConfig.savePath = savePath;
        qBittorrentConfig.autoTMM = autoTMM;
        qBittorrentConfig.sequentialDownload = sequentialDownload;
        qBittorrentConfig.firstLastPiecePrio = firstLastPiecePrio;

        GM_setValue('qBittorrentConfig', qBittorrentConfig);
        showStatus("Download options saved!", "success");
    }

    // Test the connection
    async function testConnection() {
        showStatus("Testing connection...", "loading");

        try {
            const sid = await GM_getValue("SID");
            let isValid = false;

            if (sid) {
                isValid = await validate(sid);
            }

            if (!isValid) {
                const newSid = await authenticate();
                if (newSid) {
                    GM_setValue("SID", newSid);
                    showStatus("Connection successful!", "success");
                } else {
                    showStatus("Authentication failed. Check credentials.", "error");
                }
            } else {
                showStatus("Connection successful!", "success");
            }
        } catch (error) {
            showStatus(`Connection failed: ${error.message || 'Unknown error'}`, "error");
        }
    }

    // Promise wrapper for GM_xmlhttpRequest
    function GM_promise(options) {
        return new Promise((resolve, reject) => {
            options.onload = resolve;
            options.onerror = reject;
            options.ontimeout = () => reject(new Error('Request timed out'));
            options.timeout = 30000; // 30 second timeout
            GM_xmlhttpRequest(options);
        });
    }

    // Authenticate with qBittorrent
    async function authenticate() {
        try {
            let response = await GM_promise({
                method: 'POST',
                url: `${qBittorrentConfig.host}/api/v2/auth/login`,
                headers: {
                    'Referer': qBittorrentConfig.host,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: `username=${encodeURIComponent(qBittorrentConfig.username)}&password=${encodeURIComponent(qBittorrentConfig.password)}`
            });

            // Check for successful login
            if (response.responseText === 'Fails.') {
                console.error("Authentication failed: Invalid credentials");
                return null;
            }

            let sidMatch = response.responseHeaders.match(/SID=(.*?);/);
            let sid = sidMatch ? sidMatch[1] : null;

            if (!sid) {
                console.error("Failed to extract SID from response headers");
                return null;
            }

            console.log("Authenticated with qBittorrent");
            return sid;

        } catch (error) {
            console.error("Failed to authenticate with qBittorrent:", error);
            return null;
        }
    }

    // Refresh session
    async function refresh() {
        let sid = await GM_getValue("SID");

        if (!sid) {
            sid = await authenticate();
            if (sid) {
                GM_setValue("SID", sid);
            }
        } else {
            let isValid = await validate(sid);

            if (!isValid) {
                sid = await authenticate();
                GM_setValue("SID", sid);
            }
        }

        return sid != null;
    }

    // Validate session
    async function validate(SID) {
        try {
            let response = await GM_promise({
                method: 'GET',
                url: `${qBittorrentConfig.host}/api/v2/app/version`,
                headers: {
                    'Cookie': `SID=${SID}`
                }
            });

            if (response.status == 200) {
                return true;
            } else {
                console.error("SID is invalid");
                return false;
            }
        } catch (error) {
            console.error("Failed to validate SID:", error);
            return false;
        }
    }

    // Add magnet link to qBittorrent
    async function addMagnet(magnet) {
        await refresh();
        let sid = await GM_getValue("SID");

        if (!sid) {
            return {success: false, error: "Not authenticated"};
        }

        try {
            // Build the form data with advanced parameters
            let formData = `urls=${encodeURIComponent(magnet)}`;

            // Add optional parameters if they're set
            if (qBittorrentConfig.category) {
                formData += `&category=${encodeURIComponent(qBittorrentConfig.category)}`;
            }

            if (qBittorrentConfig.savePath) {
                formData += `&savepath=${encodeURIComponent(qBittorrentConfig.savePath)}`;
            }

            // Add boolean parameters
            formData += `&autoTMM=${qBittorrentConfig.autoTMM}`;
            formData += `&sequentialDownload=${qBittorrentConfig.sequentialDownload}`;
            formData += `&firstLastPiecePrio=${qBittorrentConfig.firstLastPiecePrio}`;

            let response = await GM_promise({
                method: 'POST',
                url: `${qBittorrentConfig.host}/api/v2/torrents/add`,
                headers: {
                    'Cookie': `SID=${sid}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: formData
            });

            // Check response
            if (response.responseText === "Ok.") {
                return {success: true};
            } else {
                return {success: false, error: response.responseText || "Unknown error"};
            }
        } catch (error) {
            console.error("Failed to add magnet to qBittorrent:", error);
            return {success: false, error: error.message || "Network error"};
        }
    }

    // Download and add .torrent file
    async function downloadAndAddTorrent(torrentUrl, torrentName) {
        await refresh();
        let sid = await GM_getValue("SID");

        if (!sid) {
            return {success: false, error: "Not authenticated"};
        }

        try {
            // Download the torrent file
            let torrentFileResponse = await GM_promise({
                method: 'GET',
                url: torrentUrl,
                responseType: 'blob'
            });

            // Convert blob to base64
            const blob = torrentFileResponse.response;
            const reader = new FileReader();

            const base64Data = await new Promise((resolve) => {
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(blob);
            });

            // Build form data for the request
            const formData = new FormData();
            formData.append('torrents', base64Data);

            // Add optional parameters
            if (qBittorrentConfig.category) {
                formData.append('category', qBittorrentConfig.category);
            }

            if (qBittorrentConfig.savePath) {
                formData.append('savepath', qBittorrentConfig.savePath);
            }

            // Add boolean parameters
            formData.append('autoTMM', qBittorrentConfig.autoTMM);
            formData.append('sequentialDownload', qBittorrentConfig.sequentialDownload);
            formData.append('firstLastPiecePrio', qBittorrentConfig.firstLastPiecePrio);

            // Send to qBittorrent
            let response = await GM_promise({
                method: 'POST',
                url: `${qBittorrentConfig.host}/api/v2/torrents/add`,
                headers: {
                    'Cookie': `SID=${sid}`
                },
                data: formData,
                binary: true
            });

            // Check response
            if (response.responseText === "Ok.") {
                return {success: true};
            } else {
                return {success: false, error: response.responseText || "Unknown error"};
            }
        } catch (error) {
            console.error("Failed to add torrent file to qBittorrent:", error);
            return {success: false, error: error.message || "Network error"};
        }
    }
})();