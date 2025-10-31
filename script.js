// Placeholder for optional header dropdown logic.
document.addEventListener("DOMContentLoaded", () => {
  const dropdown = document.getElementById("userDropdown");
  if (!dropdown) return;

  const content = dropdown.querySelector(".dropdown-content");
  let hideTimer = null;

  dropdown.addEventListener("mouseenter", () => {
    clearTimeout(hideTimer);
    content?.classList.add("show");
  });

  dropdown.addEventListener("mouseleave", () => {
    hideTimer = window.setTimeout(() => {
      content?.classList.remove("show");
    }, 200);
  });
});
