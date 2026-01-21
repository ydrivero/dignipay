import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, "data.json");

const makeId = (length = 10) => crypto.randomUUID().replace(/-/g, "").slice(0, length);

const seedData = () => {
  const now = new Date().toISOString();
  const participants = [
    {
      id: makeId(12),
      badgeId: makeId(10),
      name: "Alex",
      shelter: "Harborlight Shelter",
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
      message: "Focused on getting a secure ID and safer shelter.",
      priorities: ["Transport", "Flexible"],
      createdAt: now,
      balanceCents: 0
    }
  ];

  return { participants, donations: [] };
};

const readData = () => {
  if (!fs.existsSync(dataPath)) {
    const seed = seedData();
    fs.writeFileSync(dataPath, JSON.stringify(seed, null, 2));
    return seed;
  }

  const raw = fs.readFileSync(dataPath, "utf-8");
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

const addParticipant = ({ name, shelter, message, priorities }) => {
  const data = readData();
  const now = new Date().toISOString();
  const participant = {
    id: makeId(12),
    badgeId: makeId(10),
    name,
    shelter,
    message: message || "",
    priorities: priorities || [],
    createdAt: now,
    balanceCents: 0
  };
  data.participants.push(participant);
  writeData(data);
  return participant;
};

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
    createdAt: new Date().toISOString()
  };

  participant.balanceCents += amountCents;
  data.donations.push(donation);
  writeData(data);

  return donation;
};

const getDonations = () => {
  const data = readData();
  return [...data.donations].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
  getDonations,
  getStats
};
