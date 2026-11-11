// ==UserScript==
// @name        Open link using dragging
// @encoding    utf-8
// @namespace   https://github.com/inmani9
// @downloadURL https://raw.githubusercontent.com/inmani9/userscript/main/drag_link.user.js
// @version     1.1.7
// @author      BJ
// @match        *://*/*
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
  let drag_indicator = null;
  let native_drag = false;

  function clear() {
    dragging = false;
    mouse_dragging = false;
    native_drag = false;
    found_img_url = null;
    found_link_url = null;
    selected_text = null;
    hide_drag_indicator();
  }

  document.addEventListener('dragstart', (e) => {
    if (!dragging) {
      find_element(e, true);
    }
    if (dragging) {
      set_native_drag_image(e);
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
    if (dragging && !native_drag) {
      if (is_action_distance(e)) {
        show_drag_indicator(e);
      } else {
        hide_drag_indicator();
      }
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

      if (tagName === 'A') {
        found_link_url = element.href;
      } else if (tagName === 'IMG') {
        found_img_url = element.src;
      } else if (tagName === 'VIDEO') {
        const src = element.src || (element.querySelector('source') && element.querySelector('source').src);
        console.debug(`[DR] LINK: ${src}`);
        if (src && src.startsWith('http')) {
          found_link_url = src;
          dragging = true;
          break;
        }
      }

      if (found_link_url || found_img_url) dragging = true;

      // 링크를 찾았으면 더 위로 올라가지 않고 종료
      if (found_link_url) break;
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

  function get_drag_label() {
    if (selected_text) return 'TEXT';
    if (found_img_url && found_link_url) return 'IMG + LINK';
    if (found_img_url) return 'IMG';
    if (found_link_url) return 'LINK';
    return null;
  }

  function create_drag_indicator() {
    if (drag_indicator) return drag_indicator;

    drag_indicator = document.createElement('div');
    drag_indicator.style.position = 'fixed';
    drag_indicator.style.zIndex = '2147483647';
    drag_indicator.style.display = 'none';
    drag_indicator.style.padding = '6px 10px';
    drag_indicator.style.border = '1px solid rgba(255,255,255,.4)';
    drag_indicator.style.borderRadius = '6px';
    drag_indicator.style.background = 'rgba(32,32,32,.92)';
    drag_indicator.style.color = '#fff';
    drag_indicator.style.font = 'bold 12px/1.2 sans-serif';
    drag_indicator.style.pointerEvents = 'none';
    drag_indicator.style.whiteSpace = 'nowrap';
    drag_indicator.style.boxShadow = '0 2px 8px rgba(0,0,0,.35)';
    document.body.appendChild(drag_indicator);
    return drag_indicator;
  }

  function show_drag_indicator(e) {
    const label = get_drag_label();
    if (!label) return;

    const indicator = create_drag_indicator();
    indicator.textContent = label;
    indicator.style.display = 'block';
    const rect = indicator.getBoundingClientRect();
    const left = Math.max(4, Math.min(e.clientX + 16, window.innerWidth - rect.width - 4));
    const top = Math.max(4, Math.min(e.clientY + 16, window.innerHeight - rect.height - 4));
    indicator.style.left = `${left}px`;
    indicator.style.top = `${top}px`;
  }

  function hide_drag_indicator() {
    if (drag_indicator) drag_indicator.style.display = 'none';
  }

  function is_action_distance(e) {
    return Math.abs(e.clientX - startX) > 40 || Math.abs(e.clientY - startY) > 40;
  }

  function set_native_drag_image(e) {
    if (!e.dataTransfer || typeof e.dataTransfer.setDragImage !== 'function') return;

    const label = get_drag_label();
    if (!label) return;

    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 36;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.fillStyle = 'rgba(32,32,32,.92)';
    context.strokeStyle = 'rgba(255,255,255,.65)';
    context.lineWidth = 1;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeRect(0.5, 0.5, 119, 35);
    context.fillStyle = '#fff';
    context.font = 'bold 12px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(label, 60, 18, 108);
    canvas.style.position = 'fixed';
    canvas.style.left = '0';
    canvas.style.top = '0';
    canvas.style.zIndex = '-1';
    canvas.style.pointerEvents = 'none';
    document.body.appendChild(canvas);
    try {
      e.dataTransfer.setDragImage(canvas, 10, 10);
    } finally {
      canvas.remove();
    }
    native_drag = true;
  }

  function do_action(e) {
    if (!dragging) return;
    dragging = false; // 중복 호출 차단

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    if (is_action_distance(e)) {
      let target_url = null;

      // 좌상단 영역만 이미지 우선, 그 외 방향은 링크 우선
      if (deltaX < 0 && deltaY < 0) {
        target_url = found_img_url || found_link_url;
      } else {
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
