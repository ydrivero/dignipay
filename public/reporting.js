const reportStats = document.getElementById("report-stats");
const categoryTable = document.querySelector("#category-table tbody");
const boroughTable = document.querySelector("#borough-table tbody");
const refreshButton = document.getElementById("refresh-report");
const redemptionForm = document.getElementById("redemption-form");
const redemptionStatus = document.getElementById("redemption-status");
const communityBalance = document.getElementById("community-balance");
const communityRedemptions = document.getElementById("community-redemptions");

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD"
});

const loadReport = async () => {
  const response = await fetch("/admin/reporting");
  const report = await response.json();

  reportStats.innerHTML = "";
  const stats = [
    {
      label: "Total donations (30 days)",
      value: currency.format(report.totals.donationsCents / 100)
    },
    {
      label: "Active participants",
      value: report.totals.activeParticipants
    },
    {
      label: "Tip sustainability ratio",
      value: `${(report.tipRatio * 100).toFixed(1)}%`
    },
    {
      label: "Community pool allocated",
      value: currency.format(report.communityPool.totalAllocatedCents / 100)
    }
  ];

  stats.forEach((item) => {
    const div = document.createElement("div");
    div.className = "stat";
    div.innerHTML = `<h3>${item.value}</h3><p class="notice">${item.label}</p>`;
    reportStats.appendChild(div);
  });

  categoryTable.innerHTML = "";
  Object.entries(report.categoryTotals).forEach(([category, total]) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${category}</td><td>${currency.format(total / 100)}</td>`;
    categoryTable.appendChild(row);
  });

  boroughTable.innerHTML = "";
  report.boroughs.forEach((borough) => {
    const topCategory = Object.entries(borough.categoryTotals).sort((a, b) => b[1] - a[1])[0];
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${borough.borough}</td>
      <td>${borough.participants}</td>
      <td>${(borough.participationRate * 100).toFixed(0)}%</td>
      <td>${currency.format(borough.avgDonationPerParticipant / 100)}</td>
      <td>${topCategory ? topCategory[0] : "-"}</td>
    `;
    boroughTable.appendChild(row);
  });

  communityBalance.textContent = `Balance: ${currency.format(
    report.communityPool.balanceCents / 100
  )}`;
  communityRedemptions.textContent = `Redemptions: ${currency.format(
    report.communityPool.totalRedemptionsCents / 100
  )}`;
};

refreshButton.addEventListener("click", loadReport);

redemptionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(redemptionForm);
  const payload = {
    amount: formData.get("amount"),
    note: formData.get("note")
  };

  const response = await fetch("/admin/community-support", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (response.ok) {
    redemptionStatus.classList.remove("hidden");
    redemptionStatus.textContent = "Redemption recorded.";
    redemptionForm.reset();
    await loadReport();
  } else {
    redemptionStatus.classList.remove("hidden");
    redemptionStatus.textContent = "Unable to record redemption.";
  }
});

loadReport();
