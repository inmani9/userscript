// ==UserScript==
// @name         RememberTitles
// @version      1.6
// @description  Remember media titles and mark them
// @match        https://sukebei.nyaa.si/*
// @match        https://supjav.com/ja/*
// @include      /^https://missav\.[^/]*?/.*?$/
// @match        https://enterjoy.day/*
// @match        https://tcafe21.com/*
// @match        https://chating.wiki/*
// @match        https://lamu.club/bbs/*
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

  const r_novel = /^[#+]*(?:완\)|완결\)|[[(].*?[\])])?\s*((?:-[0-9]{1,9})*[「【0-9A-Za-z]*[a-zA-Z가-힣]+[^@]*?)(?:[@ⓒ].*|v\.?\d+.*|(?:\d*[ 권화]?\s*[-~ㅡ_]\s*\d+[ 권화]?).*|완|완결|\(완\)|完)?$/;
  const r_av = /(?:(fc2)[ _-]?(?:ppv)?[ _-](\d+))|ppv[ _-](\d+)|(\d*[a-zA-Z]+\d*)[-_](\d+)/i;
  const r_oldav = /(\d+[_-]\d+)-(1pon|carib|10mu|paco)/i;
  const av_prefix = '(AV) ';

  const menu = [
    {'help': '검색', 'icon': 'search'},
    {'help': '복사', 'icon': 'copy'},
    {'help': '소유중', 'icon': 'check-lg', 'point': 2, 'color': '#305CDE'},
    {'help': '고민중', 'icon': 'question-lg', 'point': 1, 'color': '#5CDE30'},
    //{'help': '삭제', 'icon': 'remove'},
    //{'help': '싫어요', 'icon': 'bad', 'point': 0, 'color': '#DE305C'},
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
    var listContainer = null;
    if (element != null) {
      // 1. 목록 컨테이너 생성
      listContainer = document.createElement("ul");
      listContainer.style.border = "1px solid #ccc";
      listContainer.style.position = "block";
      listContainer.style.backgroundColor = "#ee3";
      listContainer.style.listStyle = "none";
      listContainer.style.padding = "4px";
    }

    GM.xmlhttpRequest({
      method: "GET",
      timeout: 2000,
      url: `http://localhost:5000/search?q=${encodeURIComponent(name)}`,
      onload: function(response) {
        const data = JSON.parse(response.responseText);
        if (listContainer != null) {
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
        if (listContainer != null) {
          const li = document.createElement("li");
          li.textContent = `(!) 연결 실패: ${err}`;
          li.style.padding = "0 8px 0 8px";
          listContainer.appendChild(li);

          element.insertAdjacentElement('afterend', listContainer);
        }
      },
      ontimeout: function() {
        if (listContainer != null) {
          const li = document.createElement("li");
          li.textContent = `(!) 연결 실패: 시간 초과`;
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
        // 인라인 SVG 아이콘 삽입
        let icon = document.createElement('span');
        icon.className = 'menu-svg-icon';
        if (_iconSVG[item.icon]) {
          icon.innerHTML = _iconSVG[item.icon];
          const svg = icon.querySelector('svg');
          if (svg) svg.setAttribute('fill', 'currentColor');
        } else {
          icon.textContent = item.icon || '?';
        }
        // unified styling handled by CSS
        // tag which icon this is for CSS targeting
        icon.dataset.icon = item.icon;
        icon.style.display = 'inline-flex';
        icon.style.alignItems = 'center';
        icon.style.justifyContent = 'center';
        icon.style.width = '16px';
        icon.style.height = '16px';
        icon.style.margin = '0';
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
        } else if (item.help == '삭제') {
          button.addEventListener('click', async () => {
            const name = button.getAttribute('data-value');
            if (name != null) {
              if (fav_words[name] != null) {
                delete fav_words[name];
                await GM.setValue("fav_words", JSON.stringify(fav_words));
                channel.postMessage({ type: 'UPDATE', words: fav_ver });
                markAll();
              }
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
  // 외부 CDN을 불러오지 못하는 사이트가 있어, 아이콘을 인라인 SVG로 대체합니다.
  GM_addStyle(`
    .fav-mark-icon {
      padding: 2px;
      margin-right: 6px;
      background: rgba(255,255,255,0.95);
      color: #222 !important;
      border: 1px solid rgba(0,0,0,0.18);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.12);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      width: 22px;
      height: 22px;
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
    #custom-selection-popup button svg {
      width: 16px;
      height: 16px;
      display: block;
    }
    /* unify menu icon container style */
    #custom-selection-popup button span.menu-svg-icon {
      background: rgba(255,255,255,0.95);
      color: #222;
      border: 1px solid rgba(0,0,0,0.12);
      box-shadow: 0 0 0 2px rgba(255,255,255,0.18), 0 1px 2px rgba(0,0,0,0.08);
      width: 22px;
      height: 22px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      padding: 0;
    }
    /* accent backgrounds for specific icons */
    #custom-selection-popup button span.menu-svg-icon[data-icon="check-lg"],
    .fav-mark-icon[data-icon="check-lg"] {
      background: #305CDE;
      color: #fff !important;
      border-color: rgba(0,0,0,0.16);
    }
    #custom-selection-popup button span.menu-svg-icon[data-icon="question-lg"],
    .fav-mark-icon[data-icon="question-lg"] {
      background: #5CDE30;
      color: #fff !important;
      border-color: rgba(0,0,0,0.12);
    }
    #custom-selection-popup button span.menu-svg-icon[data-icon="bad"],
    .fav-mark-icon[data-icon="bad"] {
      background: #DE305C;
      color: #fff !important;
      border-color: rgba(0,0,0,0.12);
    }
    #custom-selection-popup button span.menu-svg-icon[data-icon="remove"],
    .fav-mark-icon[data-icon="remove"] {
      background: #e6e6e6;
      color: #222 !important;
      border-color: rgba(0,0,0,0.12);
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

  // 인라인 SVG 아이콘 모음 (필요한 아이콘만 정의)
  const _iconSVG = {
    'search': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M11.742 10.344a6 6 0 1 0-1.397 1.398l3.85 3.85 1.397-1.397-3.85-3.85zM6.5 11a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/></svg>',
    'copy': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M10 1.5H4a1 1 0 0 0-1 1V12h1V2.5h6V1.5zM9 0H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2z"/></svg>',
    'check-lg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M13.485 1.929a1 1 0 0 1 0 1.414L7 9.828 4.515 7.343a1 1 0 1 1 1.414-1.414L7 7.999l5.071-5.07a1 1 0 0 1 1.414 0z"/></svg>',
    'question-lg': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 4a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm.93 6.588c-.28.345-.72.612-1.43.612-.85 0-1.37-.44-1.37-1.02 0-.63.46-.98 1.06-1.35.6-.37 1.01-.66 1.01-1.42 0-.8-.64-1.27-1.45-1.27-.79 0-1.4.45-1.5 1.09l-.98-.22c.15-1.03 1.08-2.01 2.55-2.01 1.58 0 2.83.86 2.83 2.39 0 1.07-.58 1.66-1.12 1.99-.36.22-.64.31-.2.97z"/></svg>',
    'remove': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M5.5 5.5v7a.5.5 0 0 0 1 0v-7a.5.5 0 0 0-1 0zM8 5.5v7a.5.5 0 0 0 1 0v-7a.5.5 0 0 0-1 0zM10.5 5.5v7a.5.5 0 0 0 1 0v-7a.5.5 0 0 0-1 0z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 1 1 0-2h3.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1H14.5a1 1 0 0 1 1 1zM5.118 4L5 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L10.882 4H5.118z"/></svg>',
    'bad': '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="currentColor"><path d="M6.956 1.745C7.021.81 7.908.5 8.6.9L13 3.5c.6.4.6 1.2.3 1.9l-2.5 4a2 2 0 0 1-1.6 1H8v4.5a1.5 1.5 0 0 1-1.5 1.5H6a1 1 0 0 1-1-1V6.5L2.03 6.11A1 1 0 0 1 1 5.14L1.3 3.5A1 1 0 0 1 2.3 2.7L6.956 1.745z"/></svg>'
  };

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
    const wrapper = document.createElement('span');
    wrapper.setAttribute('mark-title', name);
    wrapper.setAttribute('mark-point', item.point);
    wrapper.dataset.icon = item.icon;
    wrapper.className = 'fav-mark-icon';
    // insert inline SVG if available
    if (_iconSVG[item.icon]) {
      wrapper.innerHTML = _iconSVG[item.icon];
    } else {
      wrapper.textContent = item.icon || '?';
    }
    if (item.color != null) {
      // color handled via CSS; ignore per-item color
    }
    // ensure svg uses currentColor so color can be controlled
    const svg = wrapper.querySelector('svg');
    if (svg) svg.setAttribute('fill', 'currentColor');
    return wrapper;
  }

  function changeIcon(icon, item) {
    icon.setAttribute('mark-point', item.point);
    // replace svg or text
    if (_iconSVG[item.icon]) {
      icon.innerHTML = _iconSVG[item.icon];
    } else {
      icon.textContent = item.icon || '?';
    }
    // ensure data-icon is set so CSS can target it
    try { icon.dataset.icon = item.icon; } catch(e) {}
    const svg = icon.querySelector('svg');
    if (svg) svg.setAttribute('fill', 'currentColor');
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
      const f_tags = ['A', 'H1', 'H2', 'H3', 'STRONG'];
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

  // Dynamic update helper: observe DOM changes and rerun marking (debounced)
  (function() {
    let moTimer = null;
    const mo = new MutationObserver(() => {
      clearTimeout(moTimer);
      moTimer = setTimeout(() => {
        try { markAll(); } catch(e){ console.error('[RemT] markAll err', e); }
      }, 200);
    });
    function ensureObserver() {
      try {
        if (document.body) {
          mo.observe(document.body, { childList: true, subtree: true });
        } else {
          window.addEventListener('load', () => {
            mo.observe(document.body, { childList: true, subtree: true });
          }, { once: true });
        }
      } catch(e) { console.error('[RemT] observer err', e); }
    }
    // Run a safe mark after load and when fonts are ready
    window.addEventListener('load', () => { setTimeout(markAll, 300); });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => setTimeout(markAll, 50)).catch(()=>{});
    }
    ensureObserver();
  })();

})();
