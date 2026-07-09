const menuItems = [
  {
    name: "Classic Cheeseburger",
    description: "Angus beef patty, aged cheddar, lettuce, tomato, pickles, and our secret sauce on a brioche bun.",
    price: 12.99,
    category: "Burgers",
    badge: null,
  },
  {
    name: "Bacon BBQ Burger",
    description: "Smoky bacon, crispy onion rings, cheddar, and tangy BBQ sauce on a toasted sesame bun.",
    price: 14.99,
    category: "Burgers",
    badge: "Popular",
  },
  {
    name: "Mushroom Swiss Burger",
    description: "Sautéed cremini mushrooms, melted Swiss cheese, caramelized onions, and garlic aioli.",
    price: 13.99,
    category: "Burgers",
    badge: null,
  },
  {
    name: "Double Stack Burger",
    description: "Two beef patties, double American cheese, bacon, shredded lettuce, and special sauce.",
    price: 16.99,
    category: "Burgers",
    badge: "Spicy",
  },
  {
    name: "Veggie Burger",
    description: "House-made black bean patty, avocado, sprouts, tomato, and chipotle mayo on a whole wheat bun.",
    price: 11.99,
    category: "Burgers",
    badge: "Veggie",
  },
  {
    name: "Margherita",
    description: "San Marzano tomato sauce, fresh mozzarella, basil, and a drizzle of extra virgin olive oil.",
    price: 13.99,
    category: "Pizza",
    badge: null,
  },
  {
    name: "Pepperoni Classic",
    description: "Hand-tossed crust, mozzarella, and generous layers of crispy pepperoni cups.",
    price: 15.99,
    category: "Pizza",
    badge: "Popular",
  },
  {
    name: "Meat Lovers",
    description: "Pepperoni, Italian sausage, bacon, ham, and ground beef on a rich tomato base.",
    price: 18.99,
    category: "Pizza",
    badge: null,
  },
  {
    name: "BBQ Chicken",
    description: "Grilled chicken, red onion, cilantro, smoked gouda, and sweet BBQ sauce.",
    price: 16.99,
    category: "Pizza",
    badge: null,
  },
  {
    name: "Veggie Supreme",
    description: "Bell peppers, mushrooms, red onion, black olives, spinach, and roasted garlic.",
    price: 14.99,
    category: "Pizza",
    badge: "Veggie",
  },
];

const OLLAMA_URLS = [
  "http://127.0.0.1:11434/api/chat",
  "http://localhost:11434/api/chat",
];
const OLLAMA_MODEL = "llama3.2:latest";

function formatPrice(price) {
  return `$${price.toFixed(2)}`;
}

function badgeClass(badge) {
  if (!badge) return "";
  if (badge === "Veggie") return "veggie";
  if (badge === "Spicy") return "spicy";
  return "";
}

function renderCard(item) {
  const card = document.createElement("article");
  card.className = "menu-card";
  card.dataset.category = item.category;

  card.innerHTML = `
    <div class="card-top">
      <h3>${item.name}</h3>
      <span class="price">${formatPrice(item.price)}</span>
    </div>
    <p>${item.description}</p>
    ${item.badge ? `<span class="badge ${badgeClass(item.badge)}">${item.badge}</span>` : ""}
  `;

  return card;
}

function renderMenu() {
  const burgersGrid = document.getElementById("burgers-grid");
  const pizzaGrid = document.getElementById("pizza-grid");

  menuItems.forEach((item) => {
    const card = renderCard(item);
    if (item.category === "Burgers") {
      burgersGrid.appendChild(card);
    } else {
      pizzaGrid.appendChild(card);
    }
  });
}

function setupFilters() {
  const buttons = document.querySelectorAll(".filter-btn");
  const sections = document.querySelectorAll(".menu-section");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const category = btn.dataset.category;

      sections.forEach((section) => {
        if (category === "all" || section.dataset.section === category) {
          section.classList.remove("hidden");
        } else {
          section.classList.add("hidden");
        }
      });
    });
  });
}

function menuContext() {
  return menuItems
    .map((item) => `${item.name} (${item.category}) - ${formatPrice(item.price)}: ${item.description}`)
    .join("\n");
}

function appendMessage(role, text) {
  const chatLog = document.getElementById("chat-log");
  const message = document.createElement("div");
  const paragraph = document.createElement("p");

  message.className = `chat-message ${role}`;
  paragraph.textContent = text;
  message.appendChild(paragraph);
  chatLog.appendChild(message);
  chatLog.scrollTop = chatLog.scrollHeight;

  return message;
}

function setAssistantStatus(text, state = "ready") {
  const status = document.getElementById("ollama-status");
  const dot = document.querySelector(".status-dot");

  status.textContent = text;
  dot.dataset.state = state;
}

function buildMessages(question) {
  return [
    {
      role: "system",
      content: [
        "You are the customer assistant for Grill & Slice.",
        "Answer briefly and warmly using only this menu.",
        "Mention prices when recommending items.",
        "If asked for dietary advice, be helpful but avoid medical claims.",
        "",
        menuContext(),
      ].join("\n"),
    },
    {
      role: "user",
      content: question,
    },
  ];
}

async function askOllama(question) {
  let lastError;

  for (const url of OLLAMA_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
        },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: buildMessages(question),
          stream: false,
          options: {
            temperature: 0.4,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `Ollama returned ${response.status}.`);
      }

      return data.message?.content?.trim() || "I could not find a menu answer for that.";
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `The browser could not connect to Ollama at 127.0.0.1 or localhost. ${lastError?.message || ""}`.trim()
  );
}

function setupAssistant() {
  const form = document.getElementById("chat-form");
  const input = document.getElementById("customer-question");

  if (!form || !input) return;

  if (window.location.protocol === "file:") {
    setAssistantStatus("Serve this page from localhost to use Ollama", "error");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const question = input.value.trim();
    if (!question) return;

    input.value = "";
    input.disabled = true;
    appendMessage("customer", question);
    const pendingMessage = appendMessage("assistant pending", "Thinking...");
    setAssistantStatus("Asking Ollama...", "busy");

    try {
      if (window.location.protocol === "file:") {
        throw new Error("This page is opened as a file, and Ollama blocks that browser origin. Serve the site from http://localhost instead.");
      }

      const answer = await askOllama(question);
      pendingMessage.querySelector("p").textContent = answer;
      pendingMessage.classList.remove("pending");
      setAssistantStatus("Ollama ready on port 11434", "ready");
    } catch (error) {
      pendingMessage.querySelector("p").textContent =
        `${error.message} The site is configured to use ${OLLAMA_MODEL}.`;
      pendingMessage.classList.remove("pending");
      setAssistantStatus("Ollama unavailable", "error");
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
}

renderMenu();
setupFilters();
setupAssistant();
