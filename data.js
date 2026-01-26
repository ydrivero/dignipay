import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "data.json");

const makeId = (length = 10) => crypto.randomUUID().replace(/-/g, "").slice(0, length);

const ensureDefaults = (data) => {
  return {
    participants: data.participants ?? [],
    donations: data.donations ?? [],
    receipts: data.receipts ?? [],
    communityPoolBalanceCents: data.communityPoolBalanceCents ?? 0,
    communityPoolRedemptions: data.communityPoolRedemptions ?? []
  };
};

const seedData = () => {
  const now = new Date().toISOString();
  const participants = [
    {
      id: makeId(12),
      badgeId: makeId(10),
      name: "Alex",
      shelter: "Harborlight Shelter",
      borough: "Ville-Marie",
      message: "Saving for winter boots and transit to job interviews.",
      priorities: ["Clothing", "Transport", "Food"],
      createdAt: now,
      balanceCents: 0
    },
    {
      id: makeId(12),
      badgeId: makeId(10),
      name: "Maya",
      shelter: "St. Laurent Outreach",
      borough: "Saint-Laurent",
      message: "Working toward stability. Hygiene and food go a long way.",
      priorities: ["Hygiene", "Food", "Flexible"],
      createdAt: now,
      balanceCents: 0
    },
    {
      id: makeId(12),
      badgeId: makeId(10),
      name: "Jordan",
      shelter: "Downtown Care",
      borough: "Le Plateau-Mont-Royal",
      message: "Focused on getting a secure ID and safer shelter.",
      priorities: ["Transport", "Flexible"],
      createdAt: now,
      balanceCents: 0
    }
  ];

  return ensureDefaults({ participants, donations: [] });
  return { participants, donations: [] };
};

const readData = () => {
  if (!fs.existsSync(dataPath)) {
    const seed = seedData();
    fs.writeFileSync(dataPath, JSON.stringify(seed, null, 2));
    return seed;
  }

  const raw = fs.readFileSync(dataPath, "utf-8");
  return ensureDefaults(JSON.parse(raw));
  return JSON.parse(raw);
};

const writeData = (data) => {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
};

const getParticipants = () => {
  const data = readData();
  return [...data.participants].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const getParticipantByBadge = (badgeId) => {
  const data = readData();
  return data.participants.find((participant) => participant.badgeId === badgeId);
};

const addParticipant = ({ name, shelter, borough, message, priorities }) => {
const addParticipant = ({ name, shelter, message, priorities }) => {
  const data = readData();
  const now = new Date().toISOString();
  const participant = {
    id: makeId(12),
    badgeId: makeId(10),
    name,
    shelter,
    borough: borough || "Unspecified",
    message: message || "",
    priorities: priorities || [],
    createdAt: now,
    balanceCents: 0
  };
  data.participants.push(participant);
  writeData(data);
  return participant;
};

const addDonation = ({
  badgeId,
  amountCents,
  tipCents,
  category,
  communityAllocationCents,
  donorEmail
}) => {
const addDonation = ({ badgeId, amountCents, tipCents, category }) => {
  const data = readData();
  const participant = data.participants.find((item) => item.badgeId === badgeId);
  if (!participant) {
    return null;
  }

  const donation = {
    id: makeId(12),
    participantId: participant.id,
    amountCents,
    tipCents,
    category,
    communityAllocationCents,
    donorEmail: donorEmail || "",
    createdAt: new Date().toISOString()
  };

  participant.balanceCents += amountCents - communityAllocationCents;
  data.communityPoolBalanceCents += communityAllocationCents;
    createdAt: new Date().toISOString()
  };

  participant.balanceCents += amountCents;
  data.donations.push(donation);
  writeData(data);

  return donation;
};

const addReceipt = ({ donationId, donationAmountCents, tipCents, category, sponsorText }) => {
  const data = readData();
  const receipt = {
    id: makeId(12),
    receiptNumber: `DP-${new Date().getFullYear()}-${makeId(6).toUpperCase()}`,
    donationId,
    donationAmountCents,
    tipCents,
    category,
    sponsorText: sponsorText || "",
    createdAt: new Date().toISOString()
  };
  data.receipts.push(receipt);
  writeData(data);
  return receipt;
};

const getReceiptById = (id) => {
  const data = readData();
  return data.receipts.find((receipt) => receipt.id === id);
};

const addCommunityRedemption = ({ amountCents, note }) => {
  const data = readData();
  const redemption = {
    id: makeId(10),
    amountCents,
    note: note || "Community support redemption",
    createdAt: new Date().toISOString()
  };
  data.communityPoolBalanceCents = Math.max(0, data.communityPoolBalanceCents - amountCents);
  data.communityPoolRedemptions.push(redemption);
  writeData(data);
  return redemption;
};

const getDonations = () => {
  const data = readData();
  return [...data.donations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const getCommunityPool = () => {
  const data = readData();
  return {
    balanceCents: data.communityPoolBalanceCents,
    redemptions: [...data.communityPoolRedemptions]
  };
};

const getStats = () => {
  const data = readData();
  const totalCents = data.donations.reduce((sum, donation) => sum + donation.amountCents, 0);
  const tipsCents = data.donations.reduce((sum, donation) => sum + donation.tipCents, 0);
  return {
    participants: data.participants.length,
    donations: data.donations.length,
    totalCents,
    tipsCents
  };
};

export {
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
};
