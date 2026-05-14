// ==UserScript==
// @name        Open link using dragging
// @encoding    utf-8
// @namespace   https://github.com/inmani9
// @downloadURL https://raw.githubusercontent.com/inmani9/userscript/main/drag_link.js
// @version     0.97
// @author      BJ
// @description     Open link based on drag
// @description:ko  드래그하는 링크를 새 탭으로 여는 스트립트
// @grant       GM_openInTab
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

  document.addEventListener('dragstart', (e) => {
    if (!dragging) {
      find_element(e, true);
    }
  });
  document.addEventListener('mousedown', (e) => {
    if (e.button == 0) {
      find_element(e, false);
    }
  });

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

  document.addEventListener('drop', (e) => { if (dragging) clear(); });
  document.addEventListener('dragend', (e) => {
    if (dragging) {
      const drag_cancel = e.dataTransfer.mozUserCancelled === true;
      if (e.clientX > 0 && e.clientY > 0 && !drag_cancel) {
        do_action(e);
      } else {
        clear();
      }
    }
  });
  document.addEventListener('mouseup', (e) => {
    if (dragging) {
      do_action(e);
    }
  });


  function find_element(e, selection) {
    startX = e.clientX;
    startY = e.clientY;
    let element = e.target;
    let imgsrc = null;
    while (element && element !== document.body && element.tagName) {
      console.log("CURRENT TAG: "+element.tagName);
      let tagName = element.tagName.toUpperCase();
      if (tagName === 'A') {
        found_link = element.href;
        //showNotification('LINK: ' + found_link);
        dragging = true;
        break;
      } else if (tagName === 'IMG') {
        imgsrc = element;
        dragging = true;
        break;
      } else if (tagName == 'VIDEO') {
        found_link = element.src || (element.querySelector('source') && element.querySelector('source').src);
        if (found_link) {
          dagging = true;
          break;
        }
      }
      element = element.parentNode;
    }

    if (!found_link) {
      if (imgsrc) {
        var ext_re = /(?:\.([^.]+))?$/;
        var ext = ext_re.exec(imgsrc.src)[1];
        if (ext && ext.toUpperCase() in ["JPG", "JPEG", "GIF", "PNG", "BMP"]) {
          found_link = imgsrc.src;
          dragging = true;
        } else if (imgsrc.dataset && imgsrc.dataset.canonicalSrc) {
          found_link = imgsrc.dataset.canonicalSrc;
          dragging = true;
        } else {
          console.log(imgsrc);
        }
      } else if (selection && document.getSelection() && document.getSelection().toString().length > 0) {
        selected_text = document.getSelection().toString();
        //showNotification('Google: ' + selected_text);
        dragging = true;
      } else {
        console.log("NOT FOUND LINK");
      }
    }
  }

  function do_action(e) {
    if (!dragging) return; // 이미 처리가 끝났다면 중단

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;
    if (Math.abs(deltaX) > 40 || Math.abs(deltaY) > 40) {
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
    clear();
  }

  function open_link(url) {
    if (url && url.startsWith('http')) {
      GM_openInTab(url, { active: true, insert: true, setParent: true});
    }
  }

  function open_google(text) {
    if (text) {
      const url = text.startsWith('http') ? text : 'https://www.google.com/search?q=' + encodeURIComponent(text);
      // GM_openInTab을 사용하는 것이 팝업 차단 회피에 더 유리함
      GM_openInTab(url, { active: true });
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
