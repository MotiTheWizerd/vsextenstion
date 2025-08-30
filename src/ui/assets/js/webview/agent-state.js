// Global agent working state (webview only)
// Provides: setWorking, isWorking, subscribe, unsubscribe
(function initAgentWorkGlobal() {
  if (typeof window === "undefined") return;
  if (window.AgentWork) return; // preserve existing

  let working = false;
  const subscribers = new Set();

  function notify() {
    try {
      document.documentElement?.toggleAttribute("data-agent-working", working);
    } catch (_) {}
    try {
      window.dispatchEvent(
        new CustomEvent("agent:working-changed", { detail: { working } }),
      );
    } catch (_) {}
    subscribers.forEach((fn) => {
      try {
        fn(working);
      } catch (e) {
        console.error("[AgentWork] subscriber error", e);
      }
    });
  }

  window.AgentWork = {
    setWorking(val) {
      const next = !!val;
      if (next === working) return;
      working = next;
      notify();
    },
    isWorking() {
      return !!working;
    },
    subscribe(fn) {
      if (typeof fn === "function") subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    unsubscribe(fn) {
      subscribers.delete(fn);
    },
  };
})();

