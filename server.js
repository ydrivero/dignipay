import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";
import tls from "tls";
import {
  getParticipants,
  getParticipantByBadge,
  addParticipant,
  addDonation,
  addReceipt,
  getReceiptById,
  addCommunityRedemption,
  getCommunityPool,
  getDonations,
  getStats
} from "./data.js";
import { buildSimplePdf } from "./pdf.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD"
});

const COMMUNITY_POOL_PERCENT = Number(process.env.COMMUNITY_POOL_PERCENT || 0.1);
const SPONSOR_ACKNOWLEDGEMENT =
  process.env.SPONSOR_ACKNOWLEDGEMENT ||
  "Supported by Montreal civic partners and community sponsors.";

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

const createStripeSession = async ({ amountCents, tipCents, badgeId, category, donorEmail }) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return { mode: "demo" };
  }

  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("success_url", `${process.env.APP_URL || "http://localhost:3000"}/donate/success?session_id={CHECKOUT_SESSION_ID}`);
  params.append("cancel_url", `${process.env.APP_URL || "http://localhost:3000"}/donate/cancel`);
  params.append("line_items[0][price_data][currency]", "cad");
  params.append("line_items[0][price_data][product_data][name]", "DigniPay Donation");
  params.append("line_items[0][price_data][unit_amount]", String(amountCents + tipCents));
  params.append("line_items[0][quantity]", "1");
  params.append("metadata[badgeId]", badgeId);
  params.append("metadata[category]", category);
  params.append("metadata[amountCents]", String(amountCents));
  params.append("metadata[tipCents]", String(tipCents));
  if (donorEmail) {
    params.append("customer_email", donorEmail);
    params.append("metadata[donorEmail]", donorEmail);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe error: ${errorText}`);
  }

  const data = await response.json();
  return { mode: "stripe", sessionId: data.id, url: data.url };
};

const retrieveStripeSession = async (sessionId) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    return null;
  }
  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${secretKey}` }
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Stripe error: ${errorText}`);
  }
  return response.json();
};

const getSmtpConfig = () => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    return null;
  }
  return {
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    user: SMTP_USER,
    pass: SMTP_PASS,
    secure: process.env.SMTP_SECURE === "true" || Number(SMTP_PORT) === 465
  };
};

const sendSmtpEmail = ({ to, subject, html }) =>
  new Promise((resolve, reject) => {
    const config = getSmtpConfig();
    if (!config || !to) {
      resolve(false);
      return;
    }

    const socket = config.secure
      ? tls.connect(config.port, config.host, { rejectUnauthorized: false })
      : net.connect(config.port, config.host);

    let buffer = "";
    const write = (line) => socket.write(`${line}\r\n`);
    const steps = [
      () => write(`EHLO dignipay.local`),
      () => write(`AUTH LOGIN`),
      () => write(Buffer.from(config.user).toString("base64")),
      () => write(Buffer.from(config.pass).toString("base64")),
      () => write(`MAIL FROM:<${process.env.RECEIPT_EMAIL_FROM || "receipts@dignipay.local"}>`),
      () => write(`RCPT TO:<${to}>`),
      () => write(`DATA`),
      () => {
        write(`Subject: ${subject}`);
        write(`To: ${to}`);
        write(`MIME-Version: 1.0`);
        write(`Content-Type: text/html; charset=UTF-8`);
        write(``);
        write(html.replace(/\n/g, "\r\n"));
        write(`.`);
      },
      () => write(`QUIT`)
    ];

    let stepIndex = 0;
    const advance = () => {
      if (stepIndex < steps.length) {
        steps[stepIndex]();
        stepIndex += 1;
      } else {
        socket.end();
        resolve(true);
      }
    };

    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      const lastLine = lines.filter(Boolean).pop() || "";
      if (!lastLine) {
        return;
      }
      const code = Number(lastLine.slice(0, 3));
      if (code >= 400) {
        socket.end();
        reject(new Error(`SMTP error: ${lastLine}`));
        return;
      }
      advance();
    });

    socket.on("error", (error) => {
      reject(error);
    });
  });

const sendReceiptEmail = async ({ to, receipt }) => {
  const config = getSmtpConfig();
  if (!config || !to) {
    return false;
  }

  const receiptUrl = `${process.env.APP_URL || "http://localhost:3000"}/receipt/${receipt.id}/view`;
  const pdfUrl = `${process.env.APP_URL || "http://localhost:3000"}/receipt/${receipt.id}/pdf`;

  const html = `
    <h2>Thank you for supporting DigniPay</h2>
    <p>Receipt number: <strong>${receipt.receiptNumber}</strong></p>
    <p>Donation amount: ${currency.format(receipt.donationAmountCents / 100)}</p>
    <p>Tip amount: ${currency.format(receipt.tipCents / 100)}</p>
    <p>Category: ${receipt.category}</p>
    <p>Date: ${new Date(receipt.createdAt).toLocaleString()}</p>
    <p>${receipt.sponsorText}</p>
    <p>View receipt: <a href="${receiptUrl}">${receiptUrl}</a></p>
    <p>Download PDF: <a href="${pdfUrl}">${pdfUrl}</a></p>
  `;

  await sendSmtpEmail({
    to,
    subject: `DigniPay Receipt ${receipt.receiptNumber}`,
    html
  });

  return true;
};

const buildReportPayload = () => {
  const participants = getParticipants();
  const donations = getDonations();
  const { balanceCents, redemptions } = getCommunityPool();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfThirtyDays = new Date(now);
  startOfThirtyDays.setDate(now.getDate() - 30);

  const inPeriod = donations.filter((donation) => {
    const date = new Date(donation.createdAt);
    return date >= startOfThirtyDays;
  });

  const inMonth = donations.filter((donation) => {
    const date = new Date(donation.createdAt);
    return date >= startOfMonth;
  });

  const activeParticipantIds = new Set(inPeriod.map((donation) => donation.participantId));

  const categories = ["Food", "Hygiene", "Transport", "Clothing", "Flexible"];
  const categoryTotals = categories.reduce((acc, category) => {
    acc[category] = inPeriod
      .filter((donation) => donation.category === category)
      .reduce((sum, donation) => sum + donation.amountCents, 0);
    return acc;
  }, {});

  const totalDonations = inPeriod.reduce((sum, donation) => sum + donation.amountCents, 0);
  const totalTips = inPeriod.reduce((sum, donation) => sum + donation.tipCents, 0);
  const tipRatio = totalDonations > 0 ? totalTips / totalDonations : 0;

  const boroughs = participants.reduce((acc, participant) => {
    const borough = participant.borough || participant.shelter || "Unspecified";
    if (!acc[borough]) {
      acc[borough] = {
        borough,
        participants: 0,
        activeParticipants: 0,
        totalDonationsCents: 0,
        categoryTotals: categories.reduce((catAcc, category) => {
          catAcc[category] = 0;
          return catAcc;
        }, {})
      };
    }
    acc[borough].participants += 1;
    if (activeParticipantIds.has(participant.id)) {
      acc[borough].activeParticipants += 1;
    }
    return acc;
  }, {});

  inPeriod.forEach((donation) => {
    const participant = participants.find((item) => item.id === donation.participantId);
    const borough = participant?.borough || participant?.shelter || "Unspecified";
    if (!boroughs[borough]) {
      return;
    }
    boroughs[borough].totalDonationsCents += donation.amountCents;
    boroughs[borough].categoryTotals[donation.category] += donation.amountCents;
  });

  const boroughRows = Object.values(boroughs).map((borough) => ({
    borough: borough.borough,
    participationRate:
      borough.participants > 0 ? borough.activeParticipants / borough.participants : 0,
    avgDonationPerParticipant:
      borough.activeParticipants > 0
        ? borough.totalDonationsCents / borough.activeParticipants
        : 0,
    categoryTotals: borough.categoryTotals,
    participants: borough.participants,
    activeParticipants: borough.activeParticipants
  }));

  const totalCommunityAllocation = inPeriod.reduce(
    (sum, donation) => sum + donation.communityAllocationCents,
    0
  );

  const totalRedemptions = redemptions.reduce((sum, redemption) => sum + redemption.amountCents, 0);

  return {
    period: {
      start: startOfThirtyDays.toISOString(),
      end: now.toISOString(),
      monthStart: startOfMonth.toISOString()
    },
    totals: {
      donationsCents: totalDonations,
      tipsCents: totalTips,
      activeParticipants: activeParticipantIds.size
    },
    categoryTotals,
    tipRatio,
    boroughs: boroughRows,
    communityPool: {
      allocationPercent: COMMUNITY_POOL_PERCENT,
      totalAllocatedCents: totalCommunityAllocation,
      balanceCents,
      totalRedemptionsCents: totalRedemptions
    },
    donationCount: inPeriod.length
  };
};

const reportToCsv = (report) => {
  const lines = [];
  lines.push("metric,value");
  lines.push(`total_donations_cents,${report.totals.donationsCents}`);
  lines.push(`total_tips_cents,${report.totals.tipsCents}`);
  lines.push(`active_participants,${report.totals.activeParticipants}`);
  lines.push(`tip_ratio,${report.tipRatio}`);
  lines.push(`community_pool_allocated_cents,${report.communityPool.totalAllocatedCents}`);
  lines.push(`community_pool_balance_cents,${report.communityPool.balanceCents}`);
  lines.push(`community_pool_redemptions_cents,${report.communityPool.totalRedemptionsCents}`);
  Object.entries(report.categoryTotals).forEach(([category, value]) => {
    lines.push(`category_${category.toLowerCase()}_cents,${value}`);
  });
  lines.push("borough,participants,active_participants,participation_rate,avg_donation_per_active,food_cents,hygiene_cents,transport_cents,clothing_cents,flexible_cents");
  report.boroughs.forEach((borough) => {
    lines.push(
      [
        borough.borough,
        borough.participants,
        borough.activeParticipants,
        borough.participationRate,
        borough.avgDonationPerParticipant,
        borough.categoryTotals.Food,
        borough.categoryTotals.Hygiene,
        borough.categoryTotals.Transport,
        borough.categoryTotals.Clothing,
        borough.categoryTotals.Flexible
      ].join(",")
    );
  });
  return lines.join("\n");
};

const buildReportPdf = (report) => {
  const lines = [
    `Reporting period: ${new Date(report.period.start).toLocaleDateString()} - ${new Date(
      report.period.end
    ).toLocaleDateString()}`,
    `Total donations: ${currency.format(report.totals.donationsCents / 100)}`,
    `Active participants: ${report.totals.activeParticipants}`,
    `Tip sustainability ratio: ${(report.tipRatio * 100).toFixed(1)}%`,
    "Category totals:"
  ];
  Object.entries(report.categoryTotals).forEach(([category, value]) => {
    lines.push(`  ${category}: ${currency.format(value / 100)}`);
  });
  lines.push("Borough participation:");
  report.boroughs.forEach((borough) => {
    lines.push(
      `  ${borough.borough}: ${(borough.participationRate * 100).toFixed(0)}% participation, avg ${currency.format(
        borough.avgDonationPerParticipant / 100
      )}`
    );
  });
  lines.push("Community pool:");
  lines.push(
    `  Allocated: ${currency.format(report.communityPool.totalAllocatedCents / 100)} (balance ${currency.format(
      report.communityPool.balanceCents / 100
    )})`
  );
  lines.push(
    `  Redemptions: ${currency.format(report.communityPool.totalRedemptionsCents / 100)}`
  );

  return buildSimplePdf({
    title: "DigniPay — City Impact Report",
    subtitle: `Period: ${new Date(report.period.start).toLocaleDateString()} - ${new Date(
      report.period.end
    ).toLocaleDateString()}`,
    lines,
    footer: "All data is anonymized and aggregated for public accountability."
  });
};

const buildReceiptPdf = (receipt) => {
  const lines = [
    `Receipt #: ${receipt.receiptNumber}`,
    `Donation: ${currency.format(receipt.donationAmountCents / 100)}`,
    `Tip: ${currency.format(receipt.tipCents / 100)}`,
    `Category: ${receipt.category}`,
    `Date: ${new Date(receipt.createdAt).toLocaleString()}`,
    receipt.sponsorText
  ];

  return buildSimplePdf({
    title: "DigniPay Receipt",
    subtitle: "Thank you for your support",
    lines,
    footer: "This receipt is provided for your records."
  });
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
      const { name, shelter, borough, message, priorities } = body;

      if (!name || !shelter) {
        sendJson(res, 400, { error: "Name and shelter are required." });
        return;
      }

      const participant = addParticipant({ name, shelter, borough, message, priorities });
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

  if (pathname === "/pay/create-session" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const { badgeId, amount, tip, category, donorEmail } = body;
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
      const session = await createStripeSession({
        amountCents,
        tipCents,
        badgeId,
        category,
        donorEmail
      });
      sendJson(res, 200, session);
      return;
    } catch (error) {
      sendJson(res, 500, { error: "Unable to create payment session." });
      return;
    }
  }

  if (pathname === "/pay/finalize" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const { badgeId, amount, tip, category, donorEmail, sessionId, mode } = body;

      const amountCents = Math.round(Number(amount) * 100);
      const tipCents = Math.round(Number(tip || 0) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        sendJson(res, 400, { error: "Invalid amount." });
        return;
      }

      if (mode === "stripe" && sessionId) {
        const session = await retrieveStripeSession(sessionId);
        if (!session || session.payment_status !== "paid") {
          sendJson(res, 400, { error: "Payment not confirmed." });
          return;
        }
      }

      const communityAllocationCents = Math.round(amountCents * COMMUNITY_POOL_PERCENT);
      const donation = addDonation({
        badgeId,
        amountCents,
        tipCents,
        category,
        communityAllocationCents,
        donorEmail
      });
      if (!donation) {
        sendJson(res, 404, { error: "Participant not found." });
        return;
      }

      const receipt = addReceipt({
        donationId: donation.id,
        donationAmountCents: amountCents,
        tipCents,
        category,
        sponsorText: SPONSOR_ACKNOWLEDGEMENT
      });

      try {
        const participant = getParticipants().find((item) => item.id === donation.participantId);
        await sendReceiptEmail({ to: donorEmail, receipt, donation, participant });
      } catch (error) {
        console.warn("Receipt email failed", error.message);
      }

      sendJson(res, 200, {
        ok: true,
        receiptNumber: receipt.receiptNumber,
        receiptId: receipt.id,
        receiptUrl: `/receipt/${receipt.id}/view`,
        receiptPdfUrl: `/receipt/${receipt.id}/pdf`,
        amount: currency.format(amountCents / 100),
        tip: currency.format(tipCents / 100),
        total: currency.format((amountCents + tipCents) / 100)
      });
      return;
    } catch (error) {
      sendJson(res, 400, { error: "Invalid request." });
      return;
    }
  }

  if (pathname === "/api/donations" && req.method === "POST") {
    sendJson(res, 410, { error: "Use /pay/create-session and /pay/finalize instead." });
    return;
  }

  if (pathname === "/api/donations" && req.method === "GET") {
    const donations = getDonations().map((donation) => {
      const participant = getParticipants().find((item) => item.id === donation.participantId);
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
      borough: participant.borough,
      balance: currency.format(participant.balanceCents / 100)
    }));
    sendJson(res, 200, wallets);
    return;
  }

  if (pathname === "/admin/reporting" && req.method === "GET") {
    const report = buildReportPayload();
    sendJson(res, 200, report);
    return;
  }

  if (pathname === "/admin/reporting.csv" && req.method === "GET") {
    const report = buildReportPayload();
    const csv = reportToCsv(report);
    res.writeHead(200, {
      "Content-Type": "text/csv",
      "Content-Disposition": "attachment; filename=city-impact-report.csv"
    });
    res.end(csv);
    return;
  }

  if (pathname === "/admin/reporting.pdf" && req.method === "GET") {
    const report = buildReportPayload();
    const pdfBuffer = buildReportPdf(report);
    res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=city-impact-report.pdf"
    });
    res.end(pdfBuffer);
    return;
  }

  if (pathname === "/admin/community-support" && req.method === "POST") {
    try {
      const body = await parseBody(req);
      const amountCents = Math.round(Number(body.amount || 0) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) {
        sendJson(res, 400, { error: "Invalid amount." });
        return;
      }
      const redemption = addCommunityRedemption({ amountCents, note: body.note });
      sendJson(res, 200, redemption);
      return;
    } catch (error) {
      sendJson(res, 400, { error: "Invalid request." });
      return;
    }
  }

  if (pathname.startsWith("/receipt/") && req.method === "GET") {
    const parts = pathname.split("/").filter(Boolean);
    const receiptId = parts[1];
    const action = parts[2];
    const receipt = getReceiptById(receiptId);
    if (!receipt) {
      sendJson(res, 404, { error: "Receipt not found." });
      return;
    }

    if (action === "pdf") {
      const pdfBuffer = buildReceiptPdf(receipt);
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=${receipt.receiptNumber}.pdf`
      });
      res.end(pdfBuffer);
      return;
    }

    if (action === "view") {
      sendFile(res, path.join(publicDir, "receipt.html"), "text/html");
      return;
    }

    sendJson(res, 200, receipt);
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

  if (pathname === "/admin/reporting-page") {
    sendFile(res, path.join(publicDir, "reporting.html"), "text/html");
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
