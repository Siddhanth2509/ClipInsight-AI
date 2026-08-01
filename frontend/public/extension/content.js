// ClipInsight AI Browser Extension Content Injector
(function() {
  console.log("✦ ClipInsight AI Extension active");

  function injectAnalyzeButton() {
    if (document.getElementById("clipinsight-btn")) return;

    const btn = document.createElement("button");
    btn.id = "clipinsight-btn";
    btn.innerHTML = "✦ Analyze in ClipInsight";
    btn.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 999999;
      background: linear-gradient(135deg, #7C5CFC 0%, #3DD9FF 100%);
      color: #fff;
      font-family: system-ui, sans-serif;
      font-weight: 600;
      font-size: 14px;
      padding: 12px 20px;
      border-radius: 9999px;
      border: none;
      box-shadow: 0 10px 30px rgba(124,92,252,0.4);
      cursor: pointer;
      transition: transform 0.2s;
    `;

    btn.addEventListener("mouseenter", () => btn.style.transform = "scale(1.05)");
    btn.addEventListener("mouseleave", () => btn.style.transform = "scale(1)");
    btn.addEventListener("click", () => {
      const currentUrl = window.location.href;
      window.open(`http://localhost:3000?url=${encodeURIComponent(currentUrl)}`, "_blank");
    });

    document.body.appendChild(btn);
  }

  setTimeout(injectAnalyzeButton, 1500);
})();
