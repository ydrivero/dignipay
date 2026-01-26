const title = document.getElementById("receipt-title");
const subtitle = document.getElementById("receipt-subtitle");
const receiptNumber = document.getElementById("receipt-number");
const receiptDonation = document.getElementById("receipt-donation");
const receiptTip = document.getElementById("receipt-tip");
const receiptCategory = document.getElementById("receipt-category");
const receiptDate = document.getElementById("receipt-date");
const receiptSponsor = document.getElementById("receipt-sponsor");
const receiptPdf = document.getElementById("receipt-pdf");

const currency = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD"
});

const loadReceipt = async () => {
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const receiptId = pathParts[1];
  if (!receiptId) {
    title.textContent = "Receipt not found";
    return;
  }

  const response = await fetch(`/receipt/${receiptId}`);
  if (!response.ok) {
    title.textContent = "Receipt not found";
    return;
  }

  const receipt = await response.json();
  subtitle.textContent = "Your contribution supports dignified giving.";
  receiptNumber.textContent = receipt.receiptNumber;
  receiptDonation.textContent = currency.format(receipt.donationAmountCents / 100);
  receiptTip.textContent = currency.format(receipt.tipCents / 100);
  receiptCategory.textContent = receipt.category;
  receiptDate.textContent = new Date(receipt.createdAt).toLocaleString();
  receiptSponsor.textContent = receipt.sponsorText;
  receiptPdf.href = `/receipt/${receipt.id}/pdf`;
};

loadReceipt();
