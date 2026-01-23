const title = document.getElementById("donor-title");
const message = document.getElementById("donor-message");
const amountOptions = document.getElementById("amount-options");
const categoryOptions = document.getElementById("category-options");
const customAmount = document.getElementById("custom-amount");
const tipToggle = document.getElementById("tip-toggle");
const payButton = document.getElementById("pay-button");
const successMessage = document.getElementById("success-message");

const amounts = [2, 5, 10];
const categories = [
  { label: "🍲 Food", value: "Food" },
  { label: "🧼 Hygiene", value: "Hygiene" },
  { label: "🚇 Transport", value: "Transport" },
  { label: "🧥 Clothing", value: "Clothing" },
  { label: "🔄 Flexible", value: "Flexible" }
];

let selectedAmount = amounts[1];
let selectedCategory = categories[0].value;
let badgeId = "";

const createSelectButtons = () => {
  amountOptions.innerHTML = "";
  amounts.forEach((amount) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "select-button";
    button.textContent = `$${amount}`;
    if (amount === selectedAmount) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      selectedAmount = amount;
      customAmount.value = "";
      updateActive(amountOptions, amount, "amount");
    });
    amountOptions.appendChild(button);
  });

  categoryOptions.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "select-button";
    button.textContent = category.label;
    if (category.value === selectedCategory) {
      button.classList.add("active");
    }
    button.addEventListener("click", () => {
      selectedCategory = category.value;
      updateActive(categoryOptions, category.value, "category");
    });
    categoryOptions.appendChild(button);
  });
};

const updateActive = (container, value, type) => {
  [...container.querySelectorAll("button")].forEach((button) => {
    const text = button.textContent;
    const matchesAmount = type === "amount" && text.includes(`$${value}`);
    const matchesCategory = type === "category" && text.includes(value);
    if (matchesAmount || matchesCategory) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
  });
};

const resolveBadge = () => {
  const pathParts = window.location.pathname.split("/");
  const idFromPath = pathParts[pathParts.length - 1];
  if (idFromPath && idFromPath !== "donate") {
    badgeId = idFromPath;
  }
};

const loadParticipant = async () => {
  resolveBadge();

  if (!badgeId || badgeId === "demo") {
    const response = await fetch("/api/participants");
    const participants = await response.json();
    if (participants.length) {
      badgeId = participants[0].badge_id;
    }
  }

  if (!badgeId) {
    title.textContent = "Participant not found";
    message.textContent = "Ask a shelter partner to set up a badge.";
    payButton.disabled = true;
    return;
  }

  const response = await fetch(`/api/participants/${badgeId}`);
  if (!response.ok) {
    title.textContent = "Participant not found";
    message.textContent = "Ask a shelter partner to set up a badge.";
    payButton.disabled = true;
    return;
  }

  const participant = await response.json();
  title.textContent = `Support ${participant.name} today`;
  message.textContent = participant.message || "Your support helps cover essential needs.";
};

customAmount.addEventListener("input", () => {
  if (customAmount.value) {
    selectedAmount = Number(customAmount.value);
    updateActive(amountOptions, -1, "amount");
  }
});

payButton.addEventListener("click", async () => {
  const amount = customAmount.value ? Number(customAmount.value) : selectedAmount;
  const tip = tipToggle.checked ? 0.5 : 0;

  const response = await fetch("/api/donations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      badgeId,
      amount,
      tip,
      category: selectedCategory
    })
  });

  if (response.ok) {
    const data = await response.json();
    successMessage.classList.remove("hidden");
    successMessage.textContent = `Thank you! ${data.total} confirmed. Receipt sent.`;
  } else {
    successMessage.classList.remove("hidden");
    successMessage.textContent = "Payment failed. Please try again.";
  }
});

createSelectButtons();
loadParticipant();
