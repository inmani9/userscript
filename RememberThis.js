// ==UserScript==
// @name         RememberTitles
// @version      1.2
// @description  Remember media titles and mark them
// @match        *://*/*
// @match        https://sukebei.nyaa.si/*
// @match        https://supjav.com/ja/*
// @match        https://missav.*/*
// @match        https://enterjoy.day/*
// @match        https://tcafe21.com/*
// @grant        GM_addStyle
// @grant        GM.setValue
// @grant        GM.getValue
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  const channel = new BroadcastChannel('RemT_WordSync');

  let fav_ver = 1; // 버전
  let fav_words = {}; // 단어모음
  let fav_element = null; // 선택된 노드

  const google_search='https://www.google.com/search?q='
  const jav_search='https://supjav.com/ja/?s=';

  const r_novel = /^[#+]*(?:[[(].*?[\])])*\s*((?:-[0-9]{1,9})*[「【0-9A-Za-z]*[가-힣]+[^@]*?)(?:@.*|v\.?\d+.*|(?:\d*[ 권화]?\s*[-~ㅡ_]\s*\d+[ 권화]?).*|완|완결|\(완\)|完)?$/;
  const r_av = /(?:(fc2)[ _-]?(?:ppv)?[ _-](\d+))|ppv[ _-](\d+)|(\d*[a-zA-Z]+\d*)[-_](\d+)/i;
  const r_oldav = /(\d+[_-]\d+)-(1pon|carib|10mu|paco)/i;
  const av_prefix = '(AV) ';

  const menu = [
    {'help': '검색', 'icon': 'search'},
    {'help': '복사', 'icon': 'copy'},
    {'help': '소유중', 'icon': 'check-lg', 'point': 2, 'color': '#305CDE'},
    {'help': '고민중', 'icon': 'question-lg', 'point': 1, 'color': '#5CDE30'},
  ];

  let hideTimer = null;
  let fav_menu = null;

  //------------------------------------

  function is_jav(name) {
    const r_jav = /[A-Z0-9]+-\d{3,8}$/;
    const old_prefix = ['1PON', '10MU', 'CARIB', 'PACO', 'HEYZO'];
    if (r_jav.test(name)) {
      return true;
    } else if (old_prefix.includes(name.substring(0, name.indexOf('-')))) {
      return true;
    }
    return false;
  }

  function createMenu() {
    if (!fav_menu) {
      fav_menu = document.createElement('div');
      fav_menu.id = 'custom-selection-popup';
      menu.forEach((item) => {
        let button = document.createElement('button');
        button.setAttribute('data-info', item.help);
        let icon = document.createElement('i');
        icon.className = `bi bi-${item.icon}`;
        button.appendChild(icon);
        if (item.help == '검색') {
          button.addEventListener('click', () => {
            //const name = button.getAttribute('data-value');
            const name = fav_menu.lastChild.innerText;
            if (name != null) {
              if (window.navigator.userAgent.includes('Firefox') || name.length < av_prefix.length || !name.startsWith(av_prefix)) {
                window.open(`${google_search}${encodeURIComponent(name)}`, '_blank');
              } else {
                window.open(`${jav_search}${encodeURIComponent(name.substring(av_prefix.length).replaceAll('-', '+'))}`, '_blank');
              }
            }
          });
        } else if (item.help == '복사') {
          button.addEventListener('click', async () => {
            const name = button.getAttribute('data-value');
            if (name != null) {
              await navigator.clipboard.writeText(name);
              hidePopup();
            }
          });
        } else if (item.point !== null) {
          button.addEventListener('click', () => {
            const name = button.getAttribute('data-value');
            if (name != null) {
              if (addWord(name, item.point)) {
                markAll();
              }
              hidePopup();
            }
          });
        } else {
          button.setAttribute('no-point', 'yes');
        }
        fav_menu.appendChild(button);
      });

      fav_menu.appendChild(document.createElement('div'));

      // title
      let title = document.createElement('span');
      title.id = 'RemT-Title';
      fav_menu.appendChild(title);

      document.body.appendChild(fav_menu);
      fav_menu.addEventListener('mouseover', () => {
        clearTimeout(hideTimer);
        fav_menu.classList.remove('hiding');
      });
      fav_menu.addEventListener('mouseleave', () => {
        hidePopup(500);
      });
    }
  }

  // 팝업 메뉴 CSS 스타일 추가
  GM_addStyle(`
    @import url("https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css");
    .fav-mark-icon {
      padding: 1px;
      margin-right: 3px;
      background-color: skyblue;
      color: white !important;
      border: 1px solid yellow;
    }
    #custom-selection-popup {
        display: none;
        position: absolute;
        z-index: 99999;
        padding: 2px;
        background-color: #fff;
        border: 1px solid #ccc;
        border-radius: 6px;
        box-shadow: 2px 2px 5px rgba(0,0,0,0.2);
        font-family: Arial, sans-serif;
        transition: opacity 0.2s ease-in-out;
        transition: left 0.4s;
        opacity: 1;
    }
    #custom-selection-popup.hiding {
        opacity: 0; /* 숨겨질 때 투명도 0으로 설정 */
    }
    #custom-selection-popup button {
      margin: 1px;
      padding: 0;
      border: 1px dotted #ccc;
      height: 28px;
      width: 28px;
      background-color: transparent;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
    }
    #custom-selection-popup div {
      border-left: 2px dashed cornflowerblue;
      height: 16px;
      margin: 0 5px 0 0;
      display: inline-block;
      vertical-align: middle;
    }
    #custom-selection-popup span {
      vertical-align: middle;
      margin: 0px 5px 0 0;
      text-decoration: underline wavy #ff3028;
      font-size: 1.1em;
    }
    #custom-selection-popup button i {
      font-size: 1em;
    }
    #custom-selection-popup button:before {
      content: attr(data-info);
      visibility: hidden;
      opacity: 0;
      width: max-content;
      background-color: black;
      color: #fff;
      text-align: center;
      border-radius: 5px;
      padding: 5px 5px;
      transition: opacity 0.3s ease-in-out;
      position: absolute;
      z-index: 1;
      left: 102%;
    }
    #custom-selection-popup button:hover {
      background-color: cornflowerblue;
    }
    #custom-selection-popup button:hover i {
      color: yellow;
    }
    #custom-selection-popup button:hover:before {
        opacity: 1;
        visibility: visible;
    }
  `);

  function isVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && element.checkVisibility();
  }

  function rtrim(str) {
    return str.replace(/[\s.+([]+$/g, '');
  }

  function collectText(element) {
    const decoTags = ['SPAN', 'B', 'I'];

    let text = '';
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        if (text.length == 0) {
          text += child.textContent.trimStart();
        } else {
          text += child.textContent;
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (isVisible(child) && decoTags.includes(child.tagName.toUpperCase()) && child.childElementCount == 0 && child.firstChild != null) {
          text += child.firstChild.textContent;
        }
      }
    }
    return rtrim(text);
  }

  function getName(element) {
    let content = collectText(element);
    //if (content.length > 0) { console.debug(element.childNodes); }
    const match = /\r|\n/.exec(content);
    if (match) {
      return null;
    }
    content = rtrim(content.replaceAll('+', ' '));
    if (content.length > 0) {
      //console.log(`[RemT] Text: "${content}"`);
      let match = r_av.exec(content);
      if (match !== null) {
        if (match[1]) { // FC2
          const name = `FC2-${match[2]}`;
          console.debug(`[RemT] TITLE: ${name} -> ${is_jav(name) ? 'AV' : 'Unknown'}`);
          return name;
        } else if (match[3]) { // PPV
          const name = `FC2-${match[3]}`;
          console.debug(`[RemT] TITLE: ${name} -> ${is_jav(name) ? 'AV' : 'Unknown'}`);
          return name;
        } else { // OTHERS
          const r_prefix = /[A-Z]+\d*/;
          const prefix = match[4].toUpperCase();
          if (r_prefix.test(prefix)) {
            const name = `${prefix}-${match[5]}`;
            console.debug(`[RemT] TITLE: ${name} -> ${is_jav(name) ? 'AV' : 'Unknown'}`);
            return name;
          }
        }
      }

      match = r_oldav.exec(content);
      if (match !== null) {
        const name = `${match[2]}-${match[1]}`;
        console.debug(`[RemT] TITLE: ${name} -> ${is_jav(name) ? 'AV' : 'Unknown'}`);
        return name;
      }

      match = r_novel.exec(content);
      if (match !== null) {
        const novel_title = rtrim(match[1]);
        console.debug(`[RemT] Extract: "${content}" ==> "${novel_title}"`);
        return novel_title;
      } else {
        console.debug(`[RemT] Extract: "${content}" ==> FAILED!`);
      }
    }
    return null;
  }

  function attachIcon(item, name) {
    let icon = document.createElement('i');
    icon.setAttribute('mark-title', name);
    icon.setAttribute('mark-point', item.point);
    icon.className = `fav-mark-icon bi bi-${item.icon}`;
    if (item.color != null) {
      icon.style.setProperty("background-color", item.color, "important");
    }
    return icon;
  }

  function changeIcon(icon, item) {
    icon.setAttribute('mark-point', item.point);
    icon.className = `fav-mark-icon bi bi-${item.icon}`;
    if (item.color != null) {
      icon.style.setProperty("background-color", item.color, "important");
    }
  }

  function hierachy(element) {
    let tags = null;
    while (element && element.tagName !== 'BODY') {
      if (tags) {
        tags = `${element.tagName} > ${tags}`;
      } else {
        tags = element.tagName;
      }
      element = element.parentNode;
    }

    console.log(`[RemT] Element Path: BODY > ${tags}`);
  }

  function sign(parent = document.body) {
    [...parent.children].forEach(element => {
      if (element.tagName) {
        const f_tags = ['A', 'H1', 'H2', 'H3'];
        //console.log(`${element.tagName} in ${f_tags} -> ${element.tagName in f_tags}, ${f_tags.includes(element.tagName)}`);
        if (f_tags.includes(element.tagName) && element.innerText.trim().length > 0) {
          const firstChild = element.firstChild;
          if (firstChild.nodeType == Node.ELEMENT_NODE && firstChild.getAttribute('mark-title') != null) {
            const name = firstChild.getAttribute('mark-title');
            const pt = fav_words[name];
            if (pt !== firstChild.getAttribute('mark-point')) {
              const item = menu.find(item => item.point === pt);
              changeIcon(firstChild, item);
            }
            return;
          } else {
            const name = getName(element);
            if (name != null) {
              const pt = fav_words[name];
              if (pt != null) {
                const item = menu.find(item => item.point === pt);
                const icon = attachIcon(item, name);
                console.log(`[RemT] Tagged: ${name}, ${pt}`);
                element.insertBefore(icon, firstChild);
                return;
              }
            }
          }
        } else if (element.tagName == 'ASIDE') {
          return;
        }
        sign(element);
      }
    });
  }

  function markAll() {
    let time1 = performance.now();
    sign();
    let time2 = performance.now();
    console.log(`[RemT] Marking: ${time2 - time1}ms`);
  }

  async function addWord(name, point) {
    console.log(`[RemT] add new word ("${name}", ${point})`);
    if (name) {
      fav_words[name] = point;
      await GM.setValue("fav_version", fav_ver);
      await GM.setValue("fav_words", JSON.stringify(fav_words));
      channel.postMessage({ type: 'UPDATE', words: fav_ver });
      return true;
    } else {
      return false;
    }
  }

  async function loadDic() {
    const json_ver = await GM.getValue("fav_version", 0);
    const json_words = await GM.getValue("fav_words");
    if (json_words !== null) {
      fav_words = JSON.parse(json_words);
      const n_words = Object.keys(fav_words).length;
      console.log(`[RemT] Stored Titles: ${n_words}`);
      if (n_words > 0) {
        markAll();
      }

      if (fav_ver > json_ver) {
        for(const key in fav_words) {
          fav_words[key] += 1;
        }
        console.log('[RemT] Migration Done');
        await GM.setValue("fav_version", fav_ver);
        await GM.setValue("fav_words", JSON.stringify(fav_words));
      }
    }
  }

  function showPopup(x, y, name) {
    clearTimeout(hideTimer);
    if (fav_menu !== null) {
      [...fav_menu.childNodes].forEach(
        (element) => {
          if (element.tagName === "BUTTON") {
            element.setAttribute('data-value', name);
          }
        });
      if (is_jav(name)) {
        fav_menu.lastChild.innerText = av_prefix + name;
      } else {
        fav_menu.lastChild.innerText = name;
      }
      fav_menu.classList.remove('hiding');
      fav_menu.style.left = `${x}px`;
      fav_menu.style.top = `${y}px`; // 선택된 텍스트 위에 표시
      fav_menu.style.display = 'block';
    } else {
      console.error('[RemT] Cannot show popup-menu');
    }
  }

  function hidePopup(delay = 0) {
    clearTimeout(hideTimer); // 기존 타이머 클리어
    fav_element = null;

    if (delay > 0) {
      // 지연 숨김 시작
      fav_menu.classList.add('hiding'); // 숨김 애니메이션 시작
      hideTimer = setTimeout(() => {
          fav_menu.style.display = 'none';
          fav_menu.classList.remove('hiding');
      }, delay);
    } else {
      // 즉시 숨김
      fav_menu.style.display = 'none';
      fav_menu.classList.remove('hiding');
    }
  }

  function filter(element) {
    const f_limits = ['ASIDE', 'SPAN'];
    const f_titles = ['H1', 'H2', 'H3'];
    if (f_titles.includes(element.tagName)) {
      while (element && element.tagName != 'BODY') {
        if (f_limits.includes(element.tagName)) {
          return false;
        }
        element = element.parentNode;
      }
      return true;
    }
    return false;
  }

  function computedWidth(element) {
    const range = document.createRange();
    range.selectNodeContents(element);
    return {
      textWidth: range.getBoundingClientRect().width,
      totalWidth: element.offsetWidth
    };
  }

  function start() {
    loadDic();
    createMenu();

    //setTimeout(start, 1000);
  }

  channel.onmessage = (event) => {
    if (event.data.type === 'UPDATE') {
      start();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    console.log('[RemT] PAGE LOADED!');
    start();
  });

  document.addEventListener('visibilitychange', () => {
    console.log('[RemT] PAGE CHANGE!');
    start();
  });

  window.addEventListener('pageshow', function(event) {
    if (event.persisted || performance.navigation.type === 2) {
      console.log('[RemT] HISTORY BACK!');
      start();
    }
  });

  document.addEventListener('mousemove', (event) => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const cursor_x = window.scrollX + event.clientX;
    const cursor_y = event.clientY;
    if (element != fav_element) {
      if (filter(element)) {
        fav_element = element;
        const name = getName(element);
        if (name) {
          const rect = element.getBoundingClientRect();
          const widths = computedWidth(element);
          console.log(`[RemT] ${widths.textWidth}px / ${widths.totalWidth} + left: ${rect.left}`);
          console.log(`[RemT] cursor x: ${cursor_x}, y : ${cursor_y}`);

          let popupX = window.scrollX + event.clientX;
          if (popupX > 20) {
            popupX = popupX - 20;
          }
          let popupY = rect.top + window.scrollY;
          hierachy(element);
          if (rect.height < 20) {
            showPopup(popupX, popupY - 44, name);
          } else {
            showPopup(popupX, popupY - 40, name);
          }
        } else {
          fav_element = null;
        }
      } else if (fav_element) {
          const rect = fav_element.getBoundingClientRect();
          if (event.clientY > window.scrollY + rect.top + rect.height + 16) {
              hidePopup(100);
          }
      }
    } else if (fav_element) {
      if (fav_menu.style && fav_menu.style.display === 'block') {
        const rect = fav_menu.getBoundingClientRect();
        if (cursor_x < rect.x || cursor_x > rect.left + rect.width) {
          fav_menu.style.left = `${cursor_x > 16 ? cursor_x - 16 : cursor_x}px`;
        }
      }
    }
  });

  document.addEventListener('mousedown', (event) => {
    if (fav_menu != null && !fav_menu.contains(event.target)) {
      hidePopup(100);
    }
  });

})();
