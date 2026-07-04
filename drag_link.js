// ==UserScript==
// @name        Open link using dragging
// @encoding    utf-8
// @namespace   https://github.com/inmani9
// @downloadURL https://raw.githubusercontent.com/inmani9/userscript/main/drag_link.js
// @version     1.1
// @author      BJ
// @description     Open link based on drag
// @description:ko  드래그하는 링크를 새 탭으로 여는 스트립트
// @grant       GM_openInTab
// ==/UserScript==

(function() {
  'use strict';
  let startX, startY;
  let dragging = false;
  let mouse_dragging = false; // mousemove 기반 드래그 감지 중
  let found_img_url = null;
  let found_link_url = null;
  let selected_text = null;

  function clear() {
    dragging = false;
    mouse_dragging = false;
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
      if (!dragging) {
        // dragstart가 억제될 수 있는 요소(VIDEO 등)를 위해
        // mousedown 시점에 찾지 못했더라도 mousemove로 재시도
        mouse_dragging = true;
      }
    }
  });
  document.addEventListener('mousemove', (e) => {
    if (mouse_dragging && !dragging) {
      // dragstart가 억제된 요소(VIDEO 등)를 위해 mousemove에서 재탐색 (한 번만)
      mouse_dragging = false;
      find_element_at(e.target, true);
    }
  });
  document.addEventListener('drop', (e) => { if (dragging) clear(); });
  document.addEventListener('dragend', (e) => {
    mouse_dragging = false;
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
    mouse_dragging = false;
    if (dragging) {
      do_action(e);
    } else {
      clear();
    }
  });

  function find_element(e, selection) {
    startX = e.clientX;
    startY = e.clientY;
    find_element_at(e.target, selection);
  }

  function find_element_at(target, selection) {
    let element = target;
    found_img_url = null;
    found_link_url = null;
    while (element && element !== document.body && element.tagName) {
      const tagName = element.tagName.toUpperCase();
      console.log(`[DR] CURRENT TAG: ${element.tagName}`);
      if (tagName === 'A') {
        found_link_url = element.href;
        console.debug(`[DR] LINK: ${found_link_url}`);
        dragging = true;
        break;
      } else if (tagName === 'IMG') {
        if (element.src) {
          const ext = /(?:\.([^.]+))?$/.exec(element.src)[1];
          if (ext && ["JPG", "JPEG", "GIF", "PNG", "BMP"].includes(ext.toUpperCase())) {
            found_img_url = element.src;
            console.debug(`[DR] IMG: ${found_img_url}`);
            dragging = true;
            break;
          } else if (element.dataset && element.dataset.canonicalSrc) {
            found_link_url = element.dataset.canonicalSrc;
            console.debug(`[DR] LINK: ${found_link_url}`);
            dragging = true;
            break;
          } else {
            console.debug(`[DR] LINK: unknown image file`);
          }
        } else {
          console.debug(`[DR] LINK: no source image`);
        }
      } else if (tagName === 'VIDEO') {
        const src = element.src || (element.querySelector('source') && element.querySelector('source').src);
        console.debug(`[DR] LINK: ${src}`);
        if (src && src.startsWith('http')) {
          found_link_url = src;
          dragging = true;
          break;
        }
      }
      element = element.parentNode;
    }

    if (!found_link_url && selection) {
      const sel = document.getSelection();
      if (sel && sel.toString().length > 0) {
        selected_text = sel.toString();
        dragging = true;
      } else {
        console.log("NOT FOUND LINK");
      }
    }
  }

  function do_action(e) {
    if (!dragging) return;
    dragging = false; // 중복 호출 차단

    const deltaX = e.clientX - startX;
  
    if (Math.abs(deltaX) > 40) {
      let target_url = null;
      
      // 왼쪽 드래그 (deltaX < 0): 이미지 우선
      if (deltaX < 0) {
        target_url = found_img_url || found_link_url;
      } 
      // 오른쪽 드래그 (deltaX > 0): 링크 우선
      else {
        target_url = found_link_url || found_img_url;
      }

      if (target_url) {
        open_link(target_url);
      } else if (selected_text) {
        open_google(selected_text);
      }
    }
    clear();
  }

  function open_link(url) {
    if (url && url.startsWith('http')) {
      GM_openInTab(url, { active: true, insert: true, setParent: true });
    }
  }

  function open_google(text) {
    if (text) {
      const url = text.startsWith('http') ? text : 'https://www.google.com/search?q=' + encodeURIComponent(text);
      GM_openInTab(url, { active: true });
    }
  }
})();
