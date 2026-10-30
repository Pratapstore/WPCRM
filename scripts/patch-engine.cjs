const fs = require('fs');

let content = fs.readFileSync('src/lib/flows/engine.ts', 'utf8');
content = content.replace(/\r\n/g, '\n');

// 1. Update findEntryFlow
const target1 = `    if (flow.trigger_type === "keyword") {
      const cfg = flow.trigger_config as KeywordTriggerConfig;
      const keywords =
        Array.isArray(cfg?.keywords) && cfg.keywords.length > 0
          ? cfg.keywords
          : [flow.name.toLowerCase().trim()];
      if (
        candidates.some((text) =>
          matchesKeywordTrigger(text, { ...cfg, keywords }),
        )
      ) {
        return flow;
      }`;

const replace1 = `    if (flow.trigger_type === "keyword") {
      const cfg = flow.trigger_config as KeywordTriggerConfig;
      const rawKeywords =
        Array.isArray(cfg?.keywords) && cfg.keywords.length > 0
          ? cfg.keywords
          : [flow.name.toLowerCase().trim()];
      const isMainFlow = flow.name.toLowerCase().includes("main");
      const defaultMainKeywords = [
        "hi", "hello", "hey", "namaste", "namaskar", "menu", "main menu", "mainmenu", "main", "start", "start menu", "order", "order now", "catalog", "products", "shop", "pratap"
      ];
      const keywords = isMainFlow
        ? Array.from(new Set([...rawKeywords, ...defaultMainKeywords]))
        : rawKeywords;
      if (
        candidates.some((text) =>
          matchesKeywordTrigger(text, { ...cfg, keywords }),
        )
      ) {
        return flow;
      }`;

if (!content.includes(target1)) {
  console.error("target1 NOT found!");
} else {
  content = content.replace(target1, replace1);
  console.log("target1 replaced successfully!");
}

// 2. Update handleReplyForActiveRun to add Global Navigation & Friendly Greetings
const target2 = `  const currentNode = nodes.get(run.current_node_key!)!;

  // Two ways a reply can advance:`;

const replace2 = `  const currentNode = nodes.get(run.current_node_key!)!;

  const rawInboundText = (message.kind === "text" ? message.text : message.reply_title || "").toLowerCase().trim();

  // A. Global Menu Navigation ("menu", "main menu", "start", "restart", "home", "cancel"):
  // If customer at ANY stage wants to go back to the main menu, return directly to the flow's entry node!
  const isGlobalMenuCommand = [
    "menu", "main menu", "mainmenu", "start menu", "home", "restart", "reset", "cancel"
  ].includes(rawInboundText);

  if (isGlobalMenuCommand && flow.entry_node_id && nodes.has(flow.entry_node_id)) {
    run.reprompt_count = 0;
    const outcome = await advanceFromNodeKey(db, run, flow.entry_node_id, nodes);
    return { consumed: true, flow_run_id: run.id, outcome: outcome.outcome };
  }

  // B. Friendly Greeting at Entry/Main Node ("hi", "hello", "hey", "namaste"):
  // If customer greets the bot while on the main menu, re-send the menu without counting fallback strikes!
  const isGreeting = ["hi", "hello", "hey", "namaste", "namaskar"].includes(rawInboundText);
  if (isGreeting && (currentNode.node_key === flow.entry_node_id || currentNode.node_key.includes("main"))) {
    run.reprompt_count = 0;
    try {
      if (currentNode.node_type === "send_list") {
        await sendListAndSuspend(db, run, currentNode);
      } else if (currentNode.node_type === "send_buttons") {
        await sendButtonsAndSuspend(db, run, currentNode);
      }
    } catch (e) {
      console.warn("[engine] error re-sending menu on greeting:", e);
    }
    return { consumed: true, flow_run_id: run.id, outcome: "advanced" };
  }

  // Two ways a reply can advance:`;

if (!content.includes(target2)) {
  console.error("target2 NOT found!");
} else {
  content = content.replace(target2, replace2);
  console.log("target2 replaced successfully!");
}

fs.writeFileSync('src/lib/flows/engine.ts', content, 'utf8');
console.log("Saved patched engine.ts!");
