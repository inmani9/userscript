// ==UserScript==
// @name         Open link using dragging
// @namespace    Violentmonkey Scripts
// @version      0.9
// @description  Open link based on drag direction
// @match        http://*/*
// @match        https://*/*
// @license      MIT
// @icon         https://cdn-icons-png.freepik.com/512/96/96958.png
// @downloadURL https://update.greasyfork.org/scripts/501187/Drag%20link%20to%20Copy.user.js
// @updateURL https://update.greasyfork.org/scripts/501187/Drag%20link%20to%20Copy.meta.js
// ==/UserScript==

(function() {
  'use strict';
  let startX, startY;
  let dragging = false;
  let found_link = null;
  let selected_text = null;
  let notificationTimeout;

  function clear() {
    dragging = false;
    found_link = null;
    selected_text = null;
  }

  document.addEventListener('dragstart', (e) => { find_element(e); });
  document.addEventListener('mousedown', (e) => { if (e.button == 0) find_element(e); });

  /*
  document.body.addEventListener('mousemove', (e) => {
    if (found_link)
      showNotification('Link: ' + found_link);
    else if (selected_text)
      showNotification('Google: ' + selected_text);
  });
  document.body.addEventListener('drag', (e) => {
    if (found_link)
      showNotification('Link: ' + found_link);
    else if (selected_text)
      showNotification('Google: ' + selected_text);
  });
  */

  document.addEventListener('dragend', (e) => {
    console.log('{MOUSE POSITION} X: ' + e.clientX + ', Y: ' + e.clientY);
    const drag_cancel = e.dataTransfer.mozUserCancelled === true;
    if (dragging && e.clientX > 0 && e.clientY > 0 && !drag_cancel) {
      do_action(e);
    }
    clear();
  });
  document.addEventListener('mouseup', (e) => {
    do_action(e);
    clear();
  });

  function find_link(e) {
    startX = e.clientX;
    startY = e.clientY;
    let element = e.target;
    while (element && element !== document.body) {
      console.log("CURRENT TAG: "+element.tagName);
      if (element.tagName.toLowerCase() === 'a') {
        found_link = element.href;
        showNotification('LINK: ' + found_link);
        dragging = true;
        element.dragStart(e.nativeEvent);
        break;
      }
      element = element.parentNode;
    }
  }

  function find_element(e) {
    startX = e.clientX;
    startY = e.clientY;
    let element = e.target;
    while (element && element !== document.body) {
      console.log("CURRENT TAG: "+element.tagName);
      if (element.tagName.toLowerCase() === 'a') {
        found_link = element.href;
        showNotification('LINK: ' + found_link);
        dragging = true;
        break;
      }
      element = element.parentNode;
    }

    if (element && element === document.body) {
      console.log("NOT FOUND LINK");
      if (document.getSelection() && document.getSelection().toString().length > 0) {
        selected_text = document.getSelection().toString();
        showNotification('Google: ' + selected_text);
        dragging = true;
      }
    }
  }

  function do_action(e) {
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    if (Math.abs(deltaX) > 60 || Math.abs(deltaY) > 60) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal movement
        if (found_link)
          open_link(found_link);
        else
          open_google(selected_text);
      } else {
        if (found_link)
          open_link(found_link);
        else
          open_google(selected_text);
      }
    }
  }

  function open_link(url) {
    if (url.length > 0) {
      window.open(url);
    }
  }

  function open_google(text) {
    if (text != null && text.length > 0) {
      const url = 'https://www.google.com/search?q='+ encodeURIComponent(text) + '&newwindow=1';
      window.open(url);
    }
  }

  function showNotification(message) {
    clearTimeout(notificationTimeout);
    let notification = document.getElementById('drag-copy-notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'drag-copy-notification';
      notification.style.cssText = `
          position: fixed;
          top: 40px;
          right: 10px;
          background-color: #1E90FF ;
          color: white;
          padding: 7px 12px 7px 12px;
          border-radius: 5px;
          z-index: 9999;
          font-family: Arial, sans-serif;
      `;
      document.body.appendChild(notification);
    }
    notification.textContent = message;
    notification.style.display = 'block';
    notificationTimeout = setTimeout(() => {
      notification.style.display = 'none';
    }, 2000);
  }
})();
