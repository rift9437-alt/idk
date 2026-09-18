// server.js — Box Tag multiplayer server
const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);

// Serve static files from the project root (index.html etc.)
app.use(express.static(path.join(__dirname)));

// WebSocket server — handle all upgrade requests
const wss = new WebSocketServer({ server });

// ---- Game state ----
const players = new Map(); // ws -> player object
let itHolder = null;

function broadcast(msg, except) {
  const data = JSON.stringify(msg);
  for (const [ws] of players) {
    if (ws !== except && ws.readyState === 1) {
      ws.send(data);
    }
  }
}

function electIt() {
  if (itHolder !== null) return;
  const ids = Array.from(players.values())
    .map((p) => p.id)
    .sort();
  if (ids.length > 0) {
    itHolder = ids[0];
    const holder = Array.from(players.values()).find((p) => p.id === itHolder);
    if (holder) holder.it = true;
    broadcast({ type: "tagged", newIt: itHolder });
  }
}

wss.on("connection", (ws) => {
  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === "join") {
      const player = {
        id: msg.id,
        name: msg.name || "Player",
        color: msg.color || "#5eb1ff",
        x: msg.x || 80,
        y: msg.y || 100,
        it: false,
        cls: msg.cls || "speedster",
        immuneUntil: 0,
        phaseUntil: 0,
        glideUntil: 0,
      };
      players.set(ws, player);

      // Send existing players to the newcomer
      for (const [otherWs, other] of players) {
        if (otherWs !== ws) {
          ws.send(
            JSON.stringify({
              type: "presence",
              id: other.id,
              x: other.x,
              y: other.y,
              name: other.name,
              color: other.color,
              it: other.it,
              cls: other.cls,
              immuneUntil: other.immuneUntil,
              phaseUntil: other.phaseUntil,
              glideUntil: other.glideUntil,
            })
          );
        }
      }

      // Elect "it" if needed, or tell newcomer who is it
      if (itHolder === null) {
        electIt();
      } else {
        ws.send(JSON.stringify({ type: "tagged", newIt: itHolder }));
      }

      // Broadcast newcomer's presence to everyone else
      broadcast(
        {
          type: "presence",
          id: player.id,
          x: player.x,
          y: player.y,
          name: player.name,
          color: player.color,
          it: player.it,
          cls: player.cls,
          immuneUntil: 0,
          phaseUntil: 0,
          glideUntil: 0,
        },
        ws
      );
    } else if (msg.type === "presence") {
      const player = players.get(ws);
      if (!player) return;
      player.x = msg.x;
      player.y = msg.y;
      player.cls = msg.cls;
      player.immuneUntil = msg.immuneUntil || 0;
      player.phaseUntil = msg.phaseUntil || 0;
      player.glideUntil = msg.glideUntil || 0;
      broadcast(msg, ws); // relay to others
    } else if (msg.type === "tag") {
      const player = players.get(ws);
      if (!player || !player.it) return;
      const target = Array.from(players.values()).find(
        (p) => p.id === msg.targetId
      );
      if (!target) return;
      if (target.immuneUntil && Date.now() < target.immuneUntil) return;
      player.it = false;
      target.it = true;
      itHolder = target.id;
      broadcast({
        type: "tagged",
        newIt: target.id,
        taggerId: player.id,
        tagX: msg.tagX,
        tagY: msg.tagY,
      });
    } else if (msg.type === "vfx") {
      // Relay VFX events to other clients
      broadcast(msg, ws);
    }
  });

  ws.on("close", () => {
    const player = players.get(ws);
    if (!player) return;
    players.delete(ws);
    broadcast({ type: "leave", id: player.id });
    if (itHolder === player.id) {
      itHolder = null;
      electIt();
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`Box Tag server running on port ${PORT}`)
);
