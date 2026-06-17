// ==UserScript==
// @name         RememberTitles
// @version      1.4
// @description  Remember media titles and mark them
// @match        https://sukebei.nyaa.si/*
// @match        https://supjav.com/ja/*
// @include      /^https://missav\.[^/]*?/.*?$/
// @match        https://enterjoy.day/*
// @match        https://tcafe21.com/*
// @grant        GM_addStyle
// @grant        GM.setValue
// @grant        GM.getValue
// @grant        GM.xmlhttpRequest
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

  const r_novel = /^[#+]*(?:[[(]?.*?[\])])*\s*((?:-[0-9]{1,9})*[「【0-9A-Za-z]*[a-zA-Z가-힣]+[^@]*?)(?:[@ⓒ].*|v\.?\d+.*|(?:\d*[ 권화]?\s*[-~ㅡ_]\s*\d+[ 권화]?).*|완|완결|\(완\)|完)?$/;
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

  function get_file_list(element, name) {
    GM.xmlhttpRequest({
      method: "GET",
      url: `http://localhost:5000/search?q=${encodeURIComponent(name)}`,
      onload: function(response) {
        const data = JSON.parse(response.responseText);
        if (element != null) {
          // 1. 목록 컨테이너 생성
          const listContainer = document.createElement("ul");
          listContainer.style.border = "1px solid #ccc";
          listContainer.style.position = "block";
          listContainer.style.backgroundColor = "#ee3";
          listContainer.style.listStyle = "none";
          listContainer.style.padding = "4px";

          if (data.files.length > 0) {
            // 2. JSON 데이터로 리스트 아이템 생성
            data.files.forEach(item => {
              const li = document.createElement("li");
              li.textContent = item;
              li.style.padding = "0 8px 0 8px";
              listContainer.appendChild(li);
            });
          } else {
            const li = document.createElement("li");
            li.textContent = `(!) 파일 없음`;
            li.style.padding = "0 8px 0 8px";
            listContainer.appendChild(li);
          }

          // 3. 기준 요소 바로 아래에 삽입
          // 'afterend'는 타겟 요소의 바로 다음(아래)에 배치합니다.
          element.insertAdjacentElement('afterend', listContainer);
        }
      },
      onerror: function(err) {
        if (element != null) {
          const listContainer = document.createElement("ul");
          listContainer.style.border = "1px solid #ccc";
          listContainer.style.position = "block";
          listContainer.style.backgroundColor = "#ee3";
          listContainer.style.listStyle = "none";
          listContainer.style.padding = "4px";
          const li = document.createElement("li");
          li.textContent = `(!) 연결 실패: ${err}`;
          li.style.padding = "0 8px 0 8px";
          listContainer.appendChild(li);

          element.insertAdjacentElement('afterend', listContainer);
        }
      }
    });
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
            const name = fav_menu.lastChild.innerText;
            if (name != null) {
              get_file_list(fav_element, name)
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
        } else if (item.point !== undefined) {
          button.addEventListener('click', async () => {
            const name = button.getAttribute('data-value');
            if (name != null) {
              if (await addWord(name, item.point)) {
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
        transition: opacity 0.2s ease-in-out, left 0.4s;
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
    const newline = /\r|\n/.exec(content);
    if (newline) {
      return null;
    }
    content = rtrim(content.replaceAll('+', ' '));
    if (content.length > 0) {
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
      const f_tags = ['A', 'H1', 'H2', 'H3'];
      if (f_tags.includes(element.tagName) && element.innerText.trim().length > 0) {
        const firstChild = element.firstChild;
        if (firstChild.nodeType == Node.ELEMENT_NODE && firstChild.getAttribute('mark-title') != null) {
          const name = firstChild.getAttribute('mark-title');
          const pt = fav_words[name];
          if (pt !== parseInt(firstChild.getAttribute('mark-point'), 10)) {
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
    return range.getBoundingClientRect().width;
  }

  function start() {
    loadDic();
    createMenu();
  }

  channel.onmessage = (event) => {
    if (event.data.type === 'UPDATE') {
      start();
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    console.debug('[RemT] PAGE LOADED!');
    start();
  });

  document.addEventListener('visibilitychange', () => {
    console.debug('[RemT] PAGE CHANGE!');
    start();
  });

  window.addEventListener('pageshow', function(event) {
    if (event.persisted || performance.navigation.type === 2) {
      console.debug('[RemT] HISTORY BACK!');
      start();
    }
  });

  document.addEventListener('mousemove', (event) => {
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const cursor_x = window.scrollX + event.clientX;
    if (element != fav_element) {
      if (filter(element)) {
        fav_element = element;
        const name = getName(element);
        if (name) {
          const rect = element.getBoundingClientRect();
          const textWidth = computedWidth(element);
          console.debug(`[RemT] textWidth: ${textWidth}px, left: ${rect.left}, cursor x: ${cursor_x}`);

          if (event.clientX < rect.left || event.clientX > rect.left + textWidth) {
            fav_element = null;
            return;
          }

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
          if (event.clientY > rect.top + rect.height + 16) {
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
