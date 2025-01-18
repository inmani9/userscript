// ==UserScript==
// @name         Open link using dragging
// @namespace    Violentmonkey Scripts
// @version      0.8
// @description  Open link based on drag direction
// @match        http://*/*
// @match        https://*/*
// @license      MIT
// @icon         https://cdn-icons-png.freepik.com/512/96/96958.png
// @downloadURL https://update.greasyfork.org/scripts/501187/Drag%20link%20to%20Copy.user.js
// @updateURL https://update.greasyfork.org/scripts/501187/Drag%20link%20to%20Copy.meta.js
// ==/UserScript==
https://www.youtube.com/watch?v=uIY1yb-lTYk&list=PLYKWtOaS8ucEzUX9NhOFqrJpZsJXxYhkE
(function() {https://www.youtube.com/watch?v=uIY1yb-lTYk&list=PLYKWtOaS8ucEzUX9NhOFqrJpZsJXxYhkE
  'use strict';
  let startX, startY, draggable = false;
  let found_link = null;
  let selected_text = null;
  let notificationTimeout;

  document.addEventListener('dragstart', (e) => { find_object(e); });
  document.addEventListener('mousedown', (e) => { if (e.button == 0) find_object(e); });

  document.addEventListener('dragleave', (e) => { draggable = false; });
  document.addEventListener('dragenter', (e) => { draggable = true; });

  document.addEventListener('dragend', (e) => { execute_command(e); });
  document.addEventListener('mouseup', (e) => { execute_command(e); });

  function find_object(e) {
    startX = e.clientX;
    startY = e.clientY;https://www.youtube.com/watch?v=FumHvm-nEP0&pp=ygUh7IOk7J2064udIOyVpOuTnCDrjZQg64uk7YGs64uI7Iqk
    let element = e.target;
    while (element && element !== document.body) {
      console.log("CURRENT TAG: "+element.tagName);
      if (element.tagName.toLowerCase() === 'a') {
        //showNotification('FOUND:'+element.href);
        console.log("FOUND LINK: " + element.href);
        found_link = element.href;
        draggable = true;
        break;
      }
      element = element.parentNode;
    }

    if (element && element === document.body) {
      console.log("NOT FOUND LINK");
      if (document.getSelection() && document.getSelection().toString().length > 0) {
        selected_text = document.getSelection().toString();
        console.log("SELECTION TEXT: " + selected_text);
        draggable = true;
      }
    }
  }

  function execute_command(e) {
    if (draggable) {
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
    draggable = false;
    found_link = null;
    selected_text = null;
  }

  function open_link(url) {
    if (url.length > 0) {
      window.open(url);
    }
  }

  function open_google(text) {
    const url = 'https://www.google.com/search?q='+ text + '&newwindow=1';
    window.open(url);
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
