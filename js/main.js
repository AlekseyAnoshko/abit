import { initCurriculum } from "./curriculum.js";
import { partners } from "./data/partners.js";
import { programs } from "./data/programs.js";
import { faq } from "./data/faq.js";

function renderPartners() {
  const el = document.querySelector('[data-render="partners"]');
  if (!el) return;
  el.innerHTML = partners.map(p => `
    <div class="partner">
      <strong>${p.name}</strong>
      <span>${p.desc}</span>
    </div>
  `).join("");
}

function renderPrograms() {
  const el = document.querySelector('[data-render="programs"]');
  if (!el) return;
  el.innerHTML = programs.map(p => `
    <article class="card">
      <h3>${p.title}</h3>
      <p>${p.desc}</p>
      ${p.href ? `<a class="text-link" href="${p.href}">Подробнее и карта обучения →</a>` : ""}
    </article>
  `).join("");
}

function renderFaq() {
  const el = document.querySelector('[data-render="faq"]');
  if (!el) return;
  el.innerHTML = faq.map((item, i) => `
    <div class="faq-item" data-faq-index="${i}">
      <button class="faq-question" aria-expanded="false" aria-controls="faq-answer-${i}">
        <span>${item.q}</span>
        <span class="faq-icon" aria-hidden="true">+</span>
      </button>
      <div class="faq-answer" id="faq-answer-${i}">${item.a}</div>
    </div>
  `).join("");

  el.querySelectorAll(".faq-question").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".faq-item");
      const isOpen = item.classList.contains("open");
      item.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(!isOpen));
    });
  });
}

function initTheme() {
  const toggle = document.querySelector("[data-theme-toggle]");
  const root = document.documentElement;
  let theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  root.setAttribute("data-theme", theme);

  const setIcon = () => {
    toggle.innerHTML = theme === "dark"
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  };
  setIcon();

  toggle.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", theme);
    setIcon();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  renderPartners();
  renderPrograms();
  renderFaq();
  initCurriculum();
});
