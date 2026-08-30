const previousDronePilots = new Map();

function changedLeafPaths(value, prefix = "", output = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (prefix) output.push(prefix);
    return output;
  }
  const entries = Object.entries(value);
  if (!entries.length && prefix) output.push(prefix);
  for (const [key, child] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (key.includes(".")) changedLeafPaths(child, path, output);
    else changedLeafPaths(child, path, output);
  }
  return output;
}

export function updateTouchesPath(changes, watchedPath) {
  return changedLeafPaths(changes).some((path) => path === watchedPath || path.startsWith(`${watchedPath}.`));
}

function renderOpenActorSheet(actor) {
  const sheet = actor?.sheet;
  if (!sheet?.rendered || typeof sheet.render !== "function") return false;
  void sheet.render();
  return true;
}

export function refreshDependentSheets(actor, changes, {
  actors = globalThis.game?.actors,
  previousPilotId = null,
} = {}) {
  const dependentIds = new Set();
  if (actor?.type === "drone" && updateTouchesPath(changes, "system.crewMembers")) {
    if (previousPilotId) dependentIds.add(String(previousPilotId));
    const currentPilotId = actor.system?.crewMembers?.[0];
    if (currentPilotId) dependentIds.add(String(currentPilotId));
  }
  if ((actor?.type === "character" || actor?.type === "npc") && updateTouchesPath(changes, "system.access")) {
    for (const cyberdeckId of actor.system?.cyberdecks ?? []) dependentIds.add(String(cyberdeckId));
  }
  return Array.from(dependentIds).filter((id) => renderOpenActorSheet(actors?.get?.(id)));
}

export function registerLinkedSheetRefreshHooks(runtime = globalThis) {
  runtime.Hooks?.on?.("preUpdateActor", (actor, changes) => {
    if (runtime.game?.system?.id !== "swnr") return;
    if (actor?.type !== "drone" || !updateTouchesPath(changes, "system.crewMembers")) return;
    previousDronePilots.set(actor.uuid ?? actor.id, actor.system?.crewMembers?.[0] ?? null);
  });

  runtime.Hooks?.on?.("updateActor", (actor, changes) => {
    if (runtime.game?.system?.id !== "swnr") return;
    const key = actor?.uuid ?? actor?.id;
    const previousPilotId = previousDronePilots.get(key) ?? null;
    previousDronePilots.delete(key);
    refreshDependentSheets(actor, changes, { actors: runtime.game?.actors, previousPilotId });
  });
}
