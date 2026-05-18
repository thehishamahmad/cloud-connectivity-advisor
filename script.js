document.addEventListener("DOMContentLoaded", () => {
  const btnGenerate = document.getElementById("btnGenerate");
  const btnReset = document.getElementById("btnReset");
  const btnResetResult = document.getElementById("btnResetResult");
  const btnPrint = document.getElementById("btnPrint");

  if (btnGenerate) btnGenerate.addEventListener("click", calculateRecommendation);
  if (btnReset) btnReset.addEventListener("click", resetAdvisor);
  if (btnResetResult) btnResetResult.addEventListener("click", resetAdvisor);
  if (btnPrint) btnPrint.addEventListener("click", () => window.print());
});

function parseScore(value) {
  const scores = {
    iap: 0,
    vpn: 0,
    ha: 0,
    interconnect: 0,
    complexity: 0,
    resiliency: 0,
    maturity: 0
  };

  if (!value) return scores;

  value.split(",").forEach(part => {
    const [key, rawValue] = part.split(":");
    if (key && rawValue && Object.prototype.hasOwnProperty.call(scores, key.trim())) {
      scores[key.trim()] = Number(rawValue);
    }
  });

  return scores;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalize(value, min, max) {
  return clamp(Math.round(((value - min) / (max - min)) * 100), 0, 100);
}

function calculateRecommendation() {
  const form = document.getElementById("advisorForm");
  const selects = form.querySelectorAll("select");
  const globalError = document.getElementById("globalError");

  let completed = true;
  const total = {
    iap: 0,
    vpn: 0,
    ha: 0,
    interconnect: 0,
    complexity: 0,
    resiliency: 0,
    maturity: 0
  };

  selects.forEach(select => {
    if (select.value === "") {
      completed = false;
      select.classList.add("error-field");
    } else {
      select.classList.remove("error-field");
      const score = parseScore(select.value);
      Object.keys(total).forEach(key => {
        total[key] += score[key];
      });
    }
  });

  if (!completed) {
    globalError.style.display = "block";
    window.scrollTo({ top: form.offsetTop - 80, behavior: "smooth" });
    return;
  }

  globalError.style.display = "none";

  const fit = {
    iap: normalize(total.iap, -150, 250),
    vpn: normalize(total.vpn, -40, 220),
    ha: normalize(total.ha, -90, 260),
    interconnect: normalize(total.interconnect, -150, 320),
    complexity: normalize(total.complexity, -40, 260),
    resiliency: normalize(total.resiliency, -40, 280),
    maturity: normalize(total.maturity, 0, 230)
  };

  const recommendation = determineRecommendation(fit, total);
  renderRecommendation(recommendation);
}

function determineRecommendation(fit, total) {
  const ranked = [
    { key: "iap", label: "IAP-Based Access", score: fit.iap },
    { key: "vpn", label: "Cloud VPN", score: fit.vpn },
    { key: "ha", label: "HA VPN", score: fit.ha },
    { key: "interconnect", label: "Partner / Dedicated Interconnect", score: fit.interconnect }
  ].sort((a, b) => b.score - a.score);

  let winner = ranked[0].key;

  // Guardrail: if the environment clearly needs high bandwidth or high resiliency,
  // avoid recommending basic access even if some answers are simple.
  if (fit.interconnect >= 65 && fit.interconnect >= fit.ha && fit.interconnect >= fit.vpn) {
    winner = "interconnect";
  } else if (fit.ha >= 62 && fit.resiliency >= 60 && fit.ha >= fit.vpn) {
    winner = "ha";
  } else if (fit.iap >= 65 && fit.vpn < 55 && fit.ha < 55 && fit.interconnect < 55) {
    winner = "iap";
  } else if (winner === "iap" && (fit.vpn >= 58 || fit.ha >= 58)) {
    winner = fit.ha > fit.vpn ? "ha" : "vpn";
  }

  const profile = getProfile(fit);

  const templates = {
    iap: {
      strategy: "IAP-Based Access",
      badge: "Basic Cloud Connectivity Profile",
      color: "#10b981",
      bg: "rgba(16, 185, 129, 0.16)",
      summary: "This environment does not appear to require continuous network-level connectivity. A simpler secure access model is likely sufficient.",
      why: "IAP-based access is recommended because the environment appears to have limited cloud traffic dependency, low download or upload requirements, and a stronger need for simplicity and cost control. This approach avoids unnecessary VPN tunnels, routing complexity, and additional network operations overhead.",
      observations: [
        "Continuous private network connectivity does not appear to be required for the current use case.",
        "A secure identity-based access model may be sufficient for administration or selected internal web applications.",
        "This approach helps reduce connectivity cost and avoids over-engineering the initial cloud adoption phase."
      ],
      architecture: "Use Identity-Aware Proxy with IAM-based access control for SSH, RDP, or selected internal web applications where suitable. Keep workloads private where possible and avoid exposing management interfaces publicly.",
      nextStep: "Validate which users, administrators, and applications require access before introducing VPN or dedicated network connectivity."
    },
    vpn: {
      strategy: "Cloud VPN",
      badge: "Basic Private Connectivity Profile",
      color: "#60a5fa",
      bg: "rgba(59, 130, 246, 0.16)",
      summary: "This environment appears suitable for basic site-to-site private connectivity without requiring high availability or dedicated bandwidth.",
      why: "Cloud VPN is recommended because the environment shows limited to moderate private application connectivity needs, manageable traffic volume, and cost-sensitive priorities. It provides private connectivity without the operational and commercial overhead of HA VPN or Interconnect.",
      observations: [
        "Basic private connectivity appears sufficient for the current traffic and resiliency profile.",
        "The environment does not yet show strong justification for dedicated connectivity.",
        "This approach should be reviewed again if DR replication, branch dependency, or traffic volume increases."
      ],
      architecture: "Use a standard site-to-site VPN design for limited hybrid application access, with clear routing, firewall rules, and monitoring. Upgrade to HA VPN only when resiliency becomes a business requirement.",
      nextStep: "Validate expected application traffic, routing scope, firewall requirements, and whether the business can accept non-HA connectivity."
    },
    ha: {
      strategy: "HA VPN",
      badge: "Resilient Connectivity Profile",
      color: "#a78bfa",
      bg: "rgba(167, 139, 250, 0.16)",
      summary: "This environment appears to require resilient private connectivity for more important workloads, branch access, or DR-related use cases.",
      why: "HA VPN is recommended because the environment shows stronger resiliency requirements, higher branch or workload dependency, and a need for more reliable private connectivity than a basic VPN design.",
      observations: [
        "Uninterrupted connectivity appears important to the business.",
        "Private connectivity is likely needed for continuous application access, DR planning, or branch integration.",
        "The environment should avoid relying on a single connectivity path for important workloads."
      ],
      architecture: "Use HA VPN with redundant tunnels, Cloud Router, dynamic routing where appropriate, and clear failover validation. Align the design with DR, branch access, and application dependency requirements.",
      nextStep: "Run a connectivity validation workshop to confirm resiliency expectations, routing design, firewall dependencies, and failover testing approach."
    },
    interconnect: {
      strategy: "Partner / Dedicated Interconnect",
      badge: "High-Performance Connectivity Profile",
      color: "#f59e0b",
      bg: "rgba(245, 158, 11, 0.16)",
      summary: "This environment appears to require predictable bandwidth, higher performance, or large-scale private connectivity for cloud adoption.",
      why: "Interconnect is recommended because the environment shows high download or data transfer expectations, stronger latency sensitivity, larger connectivity scale, or enterprise-level private connectivity requirements.",
      observations: [
        "Large data transfer or performance-sensitive workloads may not be ideal for basic internet-based connectivity.",
        "Predictable bandwidth and consistent performance appear important for this environment.",
        "Operational readiness and connectivity design should be reviewed before cloud migration begins."
      ],
      architecture: "Evaluate Partner Interconnect or Dedicated Interconnect with redundant connectivity, Cloud Router, network segmentation, and clear bandwidth planning. Consider HA VPN as an interim option if dedicated connectivity is not immediately available.",
      nextStep: "Conduct a network discovery and bandwidth planning session to validate traffic patterns, branch requirements, DR traffic, and interconnect feasibility."
    }
  };

  const result = templates[winner];
  result.profile = profile;
  result.fit = fit;
  return result;
}

function getProfile(fit) {
  const avg = Math.round((fit.complexity + fit.resiliency + fit.maturity) / 3);

  if (avg >= 75) return "Advanced Cloud Connectivity Readiness";
  if (avg >= 50) return "Developing Cloud Connectivity Readiness";
  return "Early Cloud Connectivity Readiness";
}

function renderRecommendation(result) {
  document.getElementById("strategyText").textContent = result.strategy;

  const badge = document.getElementById("profileBadge");
  badge.textContent = result.profile;
  badge.style.background = result.bg;
  badge.style.color = result.color;

  document.getElementById("summaryText").textContent = result.summary;
  document.getElementById("whyText").textContent = result.why;
  document.getElementById("architectureText").textContent = result.architecture;
  document.getElementById("nextStepText").textContent = result.nextStep;

  const list = document.getElementById("observationList");
  list.innerHTML = "";
  result.observations.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    list.appendChild(li);
  });

  document.getElementById("results").style.display = "block";
  window.scrollTo({ top: document.getElementById("results").offsetTop - 90, behavior: "smooth" });
}

function resetAdvisor() {
  const form = document.getElementById("advisorForm");
  form.reset();

  document.getElementById("globalError").style.display = "none";
  form.querySelectorAll("select").forEach(select => select.classList.remove("error-field"));

  document.getElementById("strategyText").textContent = "Pending";
  document.getElementById("profileBadge").textContent = "Pending";
  document.getElementById("profileBadge").style.background = "rgba(59, 130, 246, 0.16)";
  document.getElementById("profileBadge").style.color = "#60a5fa";
  document.getElementById("summaryText").textContent = "Complete the advisor to generate a recommendation.";
  document.getElementById("whyText").textContent = "";
  document.getElementById("observationList").innerHTML = "";
  document.getElementById("architectureText").textContent = "";
  document.getElementById("nextStepText").textContent = "";
  document.getElementById("results").style.display = "none";

  window.scrollTo({ top: document.getElementById("advisor").offsetTop - 90, behavior: "smooth" });
}
