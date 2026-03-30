import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";

let registered = false;

export function ensureDagreRegistered(): void {
  if (!registered) {
    cytoscape.use(dagre);
    registered = true;
  }
}
