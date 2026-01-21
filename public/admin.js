const statsEl = document.getElementById("stats");
const participantsTable = document.querySelector("#participants-table tbody");
const donationsTable = document.querySelector("#donations-table tbody");
const form = document.getElementById("participant-form");
const formSuccess = document.getElementById("form-success");
const badgePreview = document.getElementById("badge-preview");
const qrContainer = document.getElementById("qr");
const badgeLink = document.getElementById("badge-link");

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD"
});

const categories = ["Food", "Hygiene", "Transport", "Clothing", "Flexible"];

const loadStats = async () => {
  const response = await fetch("/api/stats");
  const stats = await response.json();

  statsEl.innerHTML = "";
  const items = [
    { label: "Participants", value: stats.participants },
    { label: "Donations", value: stats.donations },
    { label: "Total given", value: stats.total },
    { label: "Donor tips", value: stats.tips }
  ];

  items.forEach((item) => {
    const div = document.createElement("div");
    div.className = "stat";
    div.innerHTML = `<h3>${item.value}</h3><p class="notice">${item.label}</p>`;
    statsEl.appendChild(div);
  });
};

const renderParticipants = async () => {
  const response = await fetch("/api/participants");
  const participants = await response.json();
  participantsTable.innerHTML = "";

  participants.forEach((participant) => {
    const row = document.createElement("tr");
    const priorities = participant.priorities.length
      ? participant.priorities.join(", ")
      : "Flexible";
    const badgeUrl = `${window.location.origin}/donate/${participant.badge_id}`;

    row.innerHTML = `
      <td>${participant.name}</td>
      <td>${participant.shelter}</td>
      <td>${priorities}</td>
      <td>${participant.balance}</td>
      <td>
        <button class="button secondary" data-badge="${participant.badge_id}">
          View Badge
        </button>
      </td>
    `;
    participantsTable.appendChild(row);

    row.querySelector("button").addEventListener("click", () => {
      renderBadge(participant, badgeUrl);
    });
  });

  if (participants.length) {
    const first = participants[0];
    renderBadge(first, `${window.location.origin}/donate/${first.badge_id}`);
  }
};

const renderBadge = (participant, badgeUrl) => {
  qrContainer.innerHTML = "";
  QRCode.toCanvas(badgeUrl, { width: 160, margin: 1 }, (error, canvas) => {
    if (!error) {
      qrContainer.appendChild(canvas);
    }
  });

  badgeLink.textContent = badgeUrl;
  badgePreview.querySelector("h3").textContent = `Badge for ${participant.name}`;
};

const renderDonations = async () => {
  const response = await fetch("/api/donations");
  const donations = await response.json();
  donationsTable.innerHTML = "";

  donations.forEach((donation) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${donation.name}</td>
      <td>${donation.badge_id}</td>
      <td>${donation.category}</td>
      <td>${donation.amount}</td>
      <td>${donation.tip}</td>
      <td>${new Date(donation.created_at).toLocaleString()}</td>
    `;
    donationsTable.appendChild(row);
  });
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const prioritiesInput = formData.get("priorities");
  const priorities = prioritiesInput
    ? prioritiesInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];

  const payload = {
    name: formData.get("name"),
    shelter: formData.get("shelter"),
    message: formData.get("message"),
    priorities: priorities.length ? priorities : categories
  };

  const response = await fetch("/api/participants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    const data = await response.json();
    form.reset();
    formSuccess.classList.remove("hidden");
    formSuccess.textContent = `Badge created for ${data.name}.`;
    await loadStats();
    await renderParticipants();
  } else {
    formSuccess.classList.remove("hidden");
    formSuccess.textContent = "Please enter name and shelter.";
  }
});

const init = async () => {
  await loadStats();
  await renderParticipants();
  await renderDonations();
};

init();
