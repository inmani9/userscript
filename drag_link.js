// ==UserScript==
// @name        Open link using dragging
// @encoding    utf-8
// @namespace   https://github.com/inmani9
// @downloadURL https://raw.githubusercontent.com/inmani9/userscript/main/drag_link.js
// @match       http://*/*
// @match       https://*/*
// @version     1.00
// @author      BJ
// @description     Open link based on drag direction
// @description:ko  링크를 드래그해서 오픈하는 스크립트
// ==/UserScript==

(function() {
  'use strict';
  let startX, startY, draggable = false;
  let found_link = '';
  let notificationTimeout;

  document.addEventListener('dragstart', (e) => { find_object(e); });
  document.addEventListener('mousedown', (e) => { find_object(e); });

  document.addEventListener('mousemove', () => {
    if (found_link.length > 0)
      draggable = true;
    else
      draggable = false;
  });

  document.addEventListener('dragend', (e) => { execute_command(e); });
  document.addEventListener('mouseup', (e) => { execute_command(e); });

  function find_object(e) {
    startX = e.clientX;
    startY = e.clientY;
    let element = e.target;
    while (element && element !== document.body) {
      console.log("LINK:"+element.outerHTML);
      if (element.tagName.toLowerCase() === 'a') {
        //showNotification('FOUND:'+element.href);
        console.log("FOUND LINK: " + element.href);
        found_link = element.href;
        draggable = true;
        break;
      }
      element = element.parentNode;
    }
  }

  function execute_command(e) {
    if (draggable) {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      if (Math.abs(deltaX) > 60 || Math.abs(deltaY) > 60) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          // Horizontal movement
          if (deltaX > 0) {
            open_link(found_link);
          } else {
            open_link(found_link);
          }
        } else {
          if (deltaY > 0) {
            open_link(found_link);
          } else {
            open_link(found_link);
          }
        }
      }
    }
    draggable = false;
    found_link = '';
  }

  function open_link(url) {
    //const url = GM.getValue('found_link', '');
    showNotification('Open: ' + url);
    if (url.length > 0) {
      window.open(url);
      //showNotification('MOUSE UP:'+url);
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
