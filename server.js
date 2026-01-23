import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  getParticipants,
  getParticipantByBadge,
  addParticipant,
  addDonation,
  getDonations,
  getStats
} from "./data.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD"
});

const parseBody = (req) =>
  new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });

const sendJson = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
};

const sendFile = (res, filePath, contentType) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
};

const mimeTypes = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png"
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (pathname === "/api/participants" && req.method === "GET") {
    const participants = getParticipants().map((participant) => ({
      ...participant,
      balance: currency.format(participant.balanceCents / 100)
    }));
    sendJson(res, 200, participants);
    return;
  }

  if (pathname === "/api/participants" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const { name, shelter, message, priorities } = body;

      if (!name || !shelter) {
        sendJson(res, 400, { error: "Name and shelter are required." });
        return;
      }

      const participant = addParticipant({ name, shelter, message, priorities });
      sendJson(res, 201, {
        ...participant,
        balance: currency.format(participant.balanceCents / 100)
      });
      return;
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON." });
      return;
    }
  }

  if (pathname.startsWith("/api/participants/") && req.method === "GET") {
    const badgeId = pathname.split("/").pop();
    const participant = getParticipantByBadge(badgeId);
    if (!participant) {
      sendJson(res, 404, { error: "Participant not found." });
      return;
    }
    sendJson(res, 200, {
      ...participant,
      balance: currency.format(participant.balanceCents / 100)
    });
    return;
  }

  if (pathname === "/api/donations" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const { badgeId, amount, tip, category } = body;

      if (!badgeId || !amount || !category) {
        sendJson(res, 400, { error: "Badge, amount, and category are required." });
        return;
      }

      const amountCents = Math.round(Number(amount) * 100);
      const tipCents = Math.round(Number(tip || 0) * 100);

      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        sendJson(res, 400, { error: "Invalid amount." });
        return;
      }

      const donation = addDonation({ badgeId, amountCents, tipCents, category });
      if (!donation) {
        sendJson(res, 404, { error: "Participant not found." });
        return;
      }

      sendJson(res, 200, {
        ok: true,
        amount: currency.format(amountCents / 100),
        tip: currency.format(tipCents / 100),
        total: currency.format((amountCents + tipCents) / 100)
      });
      return;
    } catch (error) {
      sendJson(res, 400, { error: "Invalid JSON." });
      return;
    }
  }

  if (pathname === "/api/donations" && req.method === "GET") {
    const donations = getDonations().map((donation) => {
      const participant = getParticipants().find(
        (item) => item.id === donation.participantId
      );
      return {
        ...donation,
        name: participant?.name ?? "Unknown",
        badge_id: participant?.badgeId ?? "-",
        amount: currency.format(donation.amountCents / 100),
        tip: currency.format(donation.tipCents / 100)
      };
    });
    sendJson(res, 200, donations);
    return;
  }

  if (pathname === "/api/stats" && req.method === "GET") {
    const stats = getStats();
    sendJson(res, 200, {
      participants: stats.participants,
      donations: stats.donations,
      total: currency.format(stats.totalCents / 100),
      tips: currency.format(stats.tipsCents / 100)
    });
    return;
  }

  if (pathname === "/api/wallets" && req.method === "GET") {
    const wallets = getParticipants().map((participant) => ({
      badge_id: participant.badgeId,
      name: participant.name,
      shelter: participant.shelter,
      balance: currency.format(participant.balanceCents / 100)
    }));
    sendJson(res, 200, wallets);
    return;
  }

  if (pathname.startsWith("/donate/")) {
    sendFile(res, path.join(publicDir, "donor.html"), "text/html");
    return;
  }

  if (pathname === "/admin") {
    sendFile(res, path.join(publicDir, "admin.html"), "text/html");
    return;
  }

  if (pathname === "/" || pathname === "") {
    sendFile(res, path.join(publicDir, "index.html"), "text/html");
    return;
  }

  const filePath = path.join(publicDir, pathname);
  const fileExt = path.extname(filePath);
  if (fs.existsSync(filePath) && mimeTypes[fileExt]) {
    sendFile(res, filePath, mimeTypes[fileExt]);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`DigniPay running at http://localhost:${port}`);
});
