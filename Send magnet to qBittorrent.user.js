// ==UserScript==
// @name       	Magnet link for transmission
// @encoding    utf-8
// @namespace   https://github.com/inmani9
// @downloadURL https://raw.githubusercontent.com/inmani9/userscript/main/magnet_link.js
// @match       https://nyaa.si/*
// @match       https://sukebei.nyaa.si/*
// @grant       GM_getValue
// @grant       GM_setValue
// @connect     *
// @version     1.0
// @author      BJ
// @description     send magnet to qBittorrent WEB
// @description:ko  마그넷 링크를 qBittorrent 웹서버로 보낸다
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

    // Add click listeners for both magnet links and .torrent download links
    document.addEventListener('click', async function (e) {
        // Handle magnet links
        if (e.target.tagName == 'A' && e.target.href.startsWith('magnet:')) {
            e.preventDefault();
            e.stopPropagation();
            const magnet = e.target.href;

            // Show loading status
            showStatus('Adding magnet...', 'loading');

            addMagnet(magnet)
            return false;
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

    function extractHash(magnetLink) {
        const match = magnetLink.match(/btih\:([a-zA-Z0-9]+)/);
        if (match && match[1]) {
            return match[1];
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

    // Setup menu commands
    function setupMenuCommands() {
        GM_registerMenuCommand("Configure qBittorrent Connection", configureConnection);
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

    async function connect(magnet) {
        let response = await fetch(`${qBittorrentConfig.host}/api/v2/auth/login`, {
            method: 'POST',
            headers: {
                'Referer': 'http://localhost:8080',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                username: qBittorrentConfig.username,
                password: qBittorrentConfig.password
            }),
        });
        if (!response.ok) {
            return {success: false, mesage: 'failed to login'};
        }

        const hash = extractHash(magnet);
        //console.log(`[qBittorrent] magnet hash: ${hash}`);
        response = await fetch(`${qBittorrentConfig.host}/api/v2/torrents/properties`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `hash=${hash}`
        });
        if (response.ok) {
            return {success: false, message: 'already existed torrent magnet'};
        } else {
            return {success: true};
        }
    }

    async function addMagnet(magnet) {
        let response = await connect(magnet);
        if (response.success) {
            fetch(`${qBittorrentConfig.host}/api/v2/torrents/add`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: `urls=${encodeURIComponent(magnet)}`
            })
            .then(response => {
                if (response.ok) {
                    const title = extractTorrentName(magnet);
                    showStatus(`✓ Added: ${title}`, 'success');
                } else {
                    showStatus(`✗ Failed: ${response.responseText}`, 'error');
                    console.error('[qBittorrent] failed to add: ' + response.responseText);
                }
            })
            .catch(error => {
                showStatus(`✗ Failed: ${error.mesage}`, 'error');
                console.error('[qBittorrent] failed to add: ' + error.message);
            });
        } else {
            showStatus(`✗ Failed: ${response.message}`, 'error');
        }
    }

})();