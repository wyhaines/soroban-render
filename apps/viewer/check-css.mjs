import WebSocket from 'ws';

const socket = new WebSocket('ws://localhost:9222/devtools/page/8C33D9574813FA4FE73C2CF0362AB7E8');

socket.on('open', () => {
  socket.send(JSON.stringify({
    id: 1,
    method: 'Page.navigate',
    params: { url: 'http://localhost:5173/soroban-render/#/b/0/t/0' }
  }));
});

let navigated = false;
socket.on('message', (data) => {
  const msg = JSON.parse(data);
  if (msg.id === 1 && !navigated) {
    navigated = true;
    setTimeout(() => {
      socket.send(JSON.stringify({
        id: 2,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            const renderView = document.querySelector(".soroban-render-view");
            const allStyles = document.querySelectorAll("style");
            let contractCSS = null;
            allStyles.forEach(s => {
              const content = s.textContent || "";
              if (content.includes(".reply") || content.includes("--primary")) {
                contractCSS = content.substring(0, 2000);
              }
            });
            JSON.stringify({
              renderViewClasses: renderView ? renderView.className : null,
              hasContractCSS: !!contractCSS,
              contractCSSPreview: contractCSS,
              htmlPreview: renderView ? renderView.innerHTML.substring(0, 3000) : null
            }, null, 2);
          `
        }
      }));
    }, 3000);
  }
  if (msg.id === 2 && msg.result && msg.result.result) {
    console.log(msg.result.result.value);
    socket.close();
    process.exit(0);
  }
});

setTimeout(() => process.exit(1), 10000);
