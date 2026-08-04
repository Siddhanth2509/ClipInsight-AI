// ClipInsight AI Chrome Extension Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log("✦ ClipInsight AI Extension service worker registered.");
  chrome.contextMenus.create({
    id: "clipinsight-analyze",
    title: "✦ Analyze Video with ClipInsight AI",
    contexts: ["page", "link", "video"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "clipinsight-analyze") {
    const targetUrl = info.linkUrl || info.srcUrl || info.pageUrl || tab?.url;
    if (targetUrl) {
      chrome.tabs.create({
        url: `http://localhost:3000?url=${encodeURIComponent(targetUrl)}`
      });
    }
  }
});
