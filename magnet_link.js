// ==UserScript==
// @name       	Magnet link for transmission
// @encoding    utf-8
// @namespace   https://github.com/inmani9
// @downloadURL https://raw.githubusercontent.com/inmani9/userscript/main/magnet_link.js
// @match       https://gog-games.com/
// @match       https://torrent*/*
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @grant       GM_getValue
// @grant       GM_setValue
// @version     1.02
// @author      BJ
// @description     show button of magnet link for transmission
// @description:ko  마그넷 링크를 트랜스미션에 연결하는 버튼을 생성
// ==/UserScript==

GM_addStyle(`
.magnet-btn {
  background-color:#49afcd;
  background-image:-webkit-linear-gradient(top,#5bc0de,#2f96b4);
  border-color:#2f96b4 #2f96b4 #1f6377;
  color:#fff;
  text-shadow:0 -1px 0 rgba(0,0,0,.25);
  padding: 2px 6px;
  font-size:11px;
  line-height:14px;
  border: 1px solid #ccc;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.2),0 1px 2px rgba(0,0,0,.05);
  text-align:center;
  font-weight:400;
  font-family:Helvetica Neue,Helvetica,Arial,sans-serif;
}

.magnet-btn-success {
  background-color: #5bb75b;
  background-image: -moz-linear-gradient(top, #62c462, #51a351);
  background-image: -ms-linear-gradient(top, #62c462, #51a351);
  background-image: -webkit-gradient(linear, 0 0, 0 100%, from(#62c462), to(#51a351));
  background-image: -webkit-linear-gradient(top, #62c462, #51a351);
  background-image: -o-linear-gradient(top, #62c462, #51a351);
  background-image: linear-gradient(top, #62c462, #51a351);
  background-repeat: repeat-x;
  filter: progid:DXImageTransform.Microsoft.gradient(startColorstr='#62c462', endColorstr='#51a351', GradientType=0);
  border-color: #51a351 #51a351 #387038;
  border-color: rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.25);
  *background-color: #51a351;
  filter: progid:DXImageTransform.Microsoft.gradient(enabled = false);
}

.magnet-btn-error {
	background-color: #fa113d;
  background-image: -moz-linear-gradient(top, #62c462, #51a351);
  background-image: -ms-linear-gradient(top, #62c462, #51a351);
  background-image: -webkit-gradient(linear, 0 0, 0 100%, from(#62c462), to(#51a351));
  background-image: -webkit-linear-gradient(top, #62c462, #51a351);
  background-image: -o-linear-gradient(top, #62c462, #51a351);
  background-image: linear-gradient(top, #62c462, #51a351);
  background-repeat: repeat-x;
  filter: progid:DXImageTransform.Microsoft.gradient(startColorstr='#62c462', endColorstr='#51a351', GradientType=0);
  border-color: #51a351 #51a351 #387038;
  border-color: rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.1) rgba(0, 0, 0, 0.25);
  *background-color: #51a351;
  filter: progid:DXImageTransform.Microsoft.gradient(enabled = false);
}
`);

const host_url = "http://192.168.0.11:9091/transmission/rpc";
const authorization = "Basic " + btoa("admin:admin");
let magnets = [];

const http = {
  Get: "GET",
  Post: "POST"
};

const Transmission = {
  Okay: 0,
  Failed: 1,
  Duplicated: 2,
};

function connect(http_method, data) {
  let session_id = GM_getValue("Transmission_Session_Id", "");

  return new Promise((resolve) => {
    GM_xmlhttpRequest({
      method: http_method,
      url: host_url,
      data: JSON.stringify(data),
      headers: {
        "Content-Types": "application/json",
        "Authorization": authorization,
        "X-Transmission-Session-Id": session_id
      },
      onload: resolve
    });
  });
}

async function sendToTransmission(method, arguments) {
  const response = await connect(http.Post, {
    method: method,
    arguments: arguments
  });
  //console.log("[MAGNET-LINK] response -> " + response.status + ':' + response.responseText);

  if (response.status === 200) {
    if (response.responseText.indexOf("\"torrent-duplicate\"") > 0) {
      return Transmission.Duplicated;
    }
    return Transmission.Okay;
  }
  return Transmission.Failed;
}

function addTransmissionCaller(element) {
  element.addEventListener("click", async function() {
    const magnet = this.getAttribute("data-magnet");
    console.log("[MAGNET-LINK] sending to transmission server: " + magnet);
    let response = await sendToTransmission("torrent-add", {
      filename: magnet
    });
    switch (response) {
      case Transmission.Okay:
        element.classList.add("magnet-btn-success");
        element.innerText = "SENT";
        break;
      case Transmission.Duplicated:
        element.classList.add("magnet-btn-success");
        element.innerText = "DUPLICATED REQUEST";
        break;
      default:
        element.classList.add("magnet-btn-error");
        element.innerText = "ERROR";
    }
  });
}

function createMagnetButton(magnet) {
  let button = document.createElement("button");
  button.id = "magnet-button";
  button.classList.add("magnet-btn");
  button.type = "button";
  button.setAttribute("data-magnet", magnet);
  button.innerText = "MAGNET";

  const magnet_id = /magnet:\?xt=urn:\w+:(\w{20,50})/g;
  button.title = "MAGNET: " + magnet_id.exec(magnet)[1];
  addTransmissionCaller(button);
  return button;
}

function replaceTextMagnet(body) {
  //const regex = /magnet:\?xt=urn:\w+:\w{20,50}/g;
  const regex = /magnet:\?xt=urn:\w+:\w{20,50}(?:&[a-z]+=[\w.\-%]+)*/g;

  let txtWalker = document.createTreeWalker(
    body,
    NodeFilter.SHOW_TEXT, {
      acceptNode: function(node) {
        //-- Skip whitespace-only nodes
        if (node.nodeValue.trim() !== 0) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      }
    },
    false
  );

  let txtNode = null;
  while ((txtNode = txtWalker.nextNode()) !== null) {
    let oldTxt = txtNode.nodeValue;
    let match = regex.exec(oldTxt);

    if (match !== null) {
      let magnet = match[0];
      console.log("[MAGNET-LINK] found: " + magnet);
      txtNode.nodeValue = oldTxt.substring(0, match.index) + oldTxt.substring(regex.lastIndex);
      txtNode.parentNode.insertBefore(createMagnetButton(magnet), txtNode);
    }
  }
}

/*
function getMagnetLinks() {
  magnets.length = 0;
  for (let idx = 0; idx < 10; ++idx) {
    const frames = document.getElementsByName("frmmagnet" + idx);
    if (frames.length > 0) {
      for (let i = 0; i < frames.length; ++i) {
        const inputs = frames[i].parentNode.getElementsByTagName("input");
        for (let j = 0; j < inputs.length; ++j) {
          const input = inputs[j];
          if (input.type === "button") {
            const click_text = input.getAttribute("onclick");
            if (click_text !== null && click_text.indexOf("Magnet") > 0) {
              const regex = /\('([a-z0-9A-Z]+)'\)/i;
              const match = regex.exec(click_text);
              if (match !== null) {
                const magnet = match[1].toUpperCase();
                console.log("[MAGNET-LINK] found: " + magnet);
                magnets.push(magnet);
                let button = createMagnetButton("magnet:?xt=urn:btih:" + magnet);
                input.replaceWith(button);
              }
            }
          }
        }
      }
      continue;
    }
    break;
  }
}
*/
function getMagnetLinks() {
  magnets.length = 0;
  const regex = /(?:magnet:\?xt=urn:btih:)((?:[a-z0-9A-Z])+)['"<>]/;
  const elements = document.body.getElementsByTagName("a");
  [...document.body.getElementsByTagName("a"), ...document.body.getElementsByTagName("input")].forEach(
    (element) => {
      const html = element.outerHTML;
      var pos = 0;
      while ((pos = html.indexOf("magnet", pos)) > 0) {
        const piece = html.substr(pos, 100);
        const match = regex.exec(piece);
        //console.log("[MAGNET-LINK] found 'magnet' keyword at position: " + pos + "in html");
        if (match !== null) {
          const magnet = match[1].toUpperCase();
          console.log("[MAGNET-LINK] found magnet: " + magnet);
          magnets.push(magnet);
          let button = createMagnetButton("magnet:?xt=urn:btih:" + magnet);
          element.replaceWith(button);
        }
        pos = pos + 1;
      }
    }
  );
}

(function() {
  let session_id = GM_getValue("Transmission_Session_Id", "");
  GM_xmlhttpRequest({
    method: http.Post,
    url: host_url,
    data: "",
    headers: {
      "Content-Types": "application/json",
      "Authorization": authorization,
      "X-Transmission-Session-Id": session_id
    },
    onerror: function (response) {
      if (response.status === 409) {
        const session_regex = /X-Transmission-Session-Id:\s+([0-9a-zA-Z]+)/i;
        let match = session_regex.exec(response.responseText);
        if (match !== null) {
          session_id = match[1];
          console.log("[MAGNET-LINK] X-Transmission-Session-Id: " + session_id);
          GM_setValue("Transmission_Session_Id", session_id);
        }
      }
      else {
        console.log("[MAGNET-LINK] transmission server status -> " + response.status + ":" + response.responseText);
      }
    }
  });

  console.log("[MAGNET-LINK] look-up");
  getMagnetLinks();
  [...document.getElementsByClassName("view-content")].forEach(
    (element) => {
      replaceTextMagnet(element);
    }
  );
})();
