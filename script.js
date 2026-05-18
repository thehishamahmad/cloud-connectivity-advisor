document.addEventListener("DOMContentLoaded", () => {
  const btnGenerate = document.getElementById("btnGenerate");
  const btnReset = document.getElementById("btnReset");
  const btnResetResult = document.getElementById("btnResetResult");
  const btnPrint = document.getElementById("btnPrint");

  if (btnGenerate) btnGenerate.addEventListener("click", calculateConnectivity);
  if (btnReset) btnReset.addEventListener("click", resetAdvisor);
  if (btnResetResult) btnResetResult.addEventListener("click", resetAdvisor);
  if (btnPrint) btnPrint.addEventListener("click", () => window.print());
});

function parseScore(value) {
  const scores = {
    iap: 0,
    vpn: 0,
    havpn: 0,
    interconnect: 0,
    complexity: 0,
    resiliency: 0,
    maturity: 0,
    cost: 0
  };

  if (!value) return scores;

  value.split(",").forEach(part => {
    const [key, rawValue] = part.split(":");
    if (key && rawValue !== undefined) {
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

function getLevel(score) {
  if (score >= 75) return "Enterprise-Grade Maturity";
  if (score >= 55) return "Advanced Hybrid Maturity";
  if (score >= 35) return "Developing Hybrid Maturity";
  return "Basic Connectivity Maturity";
}

function calculateConnectivity() {
  const form = document.getElementById("advisorForm");
  const selects = form.querySelectorAll("select");
  const globalError = document.getElementById("globalError");

  let completed = true;

  const raw = {
    iap: 0,
    vpn: 0,
    havpn: 0,
    interconnect: 0,
    complexity: 0,
    resiliency: 0,
    maturity: 0,
    cost: 0
  };

  selects.forEach(select => {
    if (select.value === "") {
      completed = false;
      select.classList.add("error-field");
    } else {
      select.classList.remove("error-field");
      const score = parseScore(select.value);
      Object.keys(raw).forEach(key => raw[key] += score[key]);
    }
  });

  if (!completed) {
    globalError.style.display = "block";
    window.scrollTo({ top: form.offsetTop - 70, behavior: "smooth" });
    return;
  }

  globalError.style.display = "none";

  const fit = {
    iap: normalize(raw.iap, -160, 295),
    vpn: normalize(raw.vpn, -70, 245),
    havpn: normalize(raw.havpn, -140, 280),
    interconnect: normalize(raw.interconnect, -260, 365),
    complexity: normalize(raw.complexity, -80, 295),
    resiliency: normalize(raw.resiliency, -75, 295),
    maturity: normalize(raw.maturity, 0, 205),
    cost: normalize(raw.cost, -105, 220)
  };

  const result = determineRecommendation(fit, raw);

  updateResults(result);
}

function determineRecommendation(fit, raw) {
  const options = [
    { key: "iap", label: "IAP-Based Access", score: fit.iap },
    { key: "vpn", label: "Cloud VPN", score: fit.vpn },
    { key: "havpn", label: "HA VPN", score: fit.havpn },
    { key: "interconnect", label: "Interconnect", score: fit.interconnect }
  ];

  options.sort((a, b) => b.score - a.score);
  const winner = options[0].key;

  const overallMaturity = clamp(Math.round((fit.maturity * 0.35) + (fit.resiliency * 0.25) + (fit.complexity * 0.20) + ((100 - fit.cost) * 0.20)), 0, 100);
  const maturityLabel = getLevel(overallMaturity);

  if (winner === "iap") {
    return {
      strategy: "IAP-Based Access",
      badge: maturityLabel,
      badgeBg: "rgba(16, 185, 129, 0.16)",
      badgeColor: "#10b981",
      summary: "This environment does not appear to require continuous network-level hybrid connectivity. A simpler identity-based secure access model is likely sufficient.",
      why: "IAP-based access is recommended because the environment appears to need secure access for administrators or selected internal web applications, without continuous private app-to-app connectivity. This avoids unnecessary VPN tunnels, routing complexity, and additional network operations overhead.",
      observations: buildObservations("iap", fit, raw),
      architecture: "Use Identity-Aware Proxy with IAM-based access control for SSH, RDP, or selected internal web applications. For user-facing internal web apps, consider HTTPS Load Balancing with IAP protection. Keep workloads private where possible and avoid exposing management interfaces publicly.",
      nextStep: "Validate whether the requirement is admin access, internal web app access, or continuous private application traffic. If it is only admin or selected internal web access, test IAP before considering VPN connectivity."
    };
  }

  if (winner === "vpn") {
    return {
      strategy: "Cloud VPN",
      badge: maturityLabel,
      badgeBg: "rgba(59, 130, 246, 0.16)",
      badgeColor: "#60a5fa",
      summary: "This environment appears suitable for basic site-to-site hybrid connectivity without requiring high availability or dedicated bandwidth.",
      why: "Cloud VPN is recommended because the environment shows limited to moderate application connectivity needs, manageable traffic volume, and cost-sensitive priorities. It provides private connectivity without the operational and commercial overhead of HA VPN or Interconnect.",
      observations: buildObservations("vpn", fit, raw),
      architecture: "Use a standard site-to-site VPN design for limited hybrid application access, with clear routing, firewall rules, and monitoring. Upgrade to HA VPN only when resiliency becomes a business requirement.",
      nextStep: "Confirm required subnets, application flows, firewall rules, and routing ownership. Then validate VPN throughput expectations with the customer network team."
    };
  }

  if (winner === "havpn") {
    return {
      strategy: "HA VPN",
      badge: maturityLabel,
      badgeBg: "rgba(139, 92, 246, 0.16)",
      badgeColor: "#a78bfa",
      summary: "This environment shows business or operational requirements that justify resilient hybrid connectivity.",
      why: "HA VPN is recommended because the environment shows stronger resiliency expectations, branch or application dependency, DR considerations, or failover requirements. This provides a more reliable hybrid connectivity model than basic VPN while avoiding the cost of dedicated connectivity.",
      observations: buildObservations("havpn", fit, raw),
      architecture: "Use HA VPN with redundant tunnels, Cloud Router, dynamic routing, and documented failover behavior. Consider hub-and-spoke design if multiple branches or shared services are involved.",
      nextStep: "Run a connectivity design workshop to confirm BGP readiness, routing domains, failover requirements, and DR traffic expectations."
    };
  }

  return {
    strategy: "Interconnect",
    badge: maturityLabel,
    badgeBg: "rgba(245, 158, 11, 0.16)",
    badgeColor: "#f59e0b",
    summary: "This environment appears to require predictable throughput, lower latency, or enterprise-scale hybrid connectivity.",
    why: "Interconnect is recommended because the environment shows higher bandwidth demand, stronger latency sensitivity, heavier data transfer requirements, or enterprise-scale hybrid integration needs. This is more suitable when internet-based connectivity may become inconsistent or insufficient.",
    observations: buildObservations("interconnect", fit, raw),
    architecture: "Evaluate Partner Interconnect or Dedicated Interconnect with redundant connectivity, Cloud Router, appropriate VLAN attachments, and a scalable hub-and-spoke cloud network design.",
    nextStep: "Validate bandwidth requirement, data movement pattern, branch dependency, service provider availability, redundancy model, and commercial impact before finalizing the connectivity design."
  };
}

function buildObservations(strategy, fit) {
  const observations = [];

  if (strategy === "iap") {
    observations.push("Continuous private network connectivity does not appear to be required for the current use case.");
    observations.push("This approach minimizes connectivity cost and avoids unnecessary tunnel or routing management.");
    observations.push("Best suited for secure admin access or selected internal web application access, rather than continuous application-to-application hybrid traffic.");
  }

  if (strategy === "vpn") {
    observations.push("Basic hybrid connectivity appears sufficient for the current traffic and resiliency profile.");
    observations.push("Cost control appears more important than advanced resiliency or dedicated throughput.");
    observations.push("This approach should be reviewed again if DR replication, branch dependency, or traffic volume increases.");
  }

  if (strategy === "havpn") {
    observations.push("The environment shows meaningful resiliency or failover requirements.");
    observations.push("Hybrid application access or DR dependency may require redundant tunnel design.");
    observations.push("Cloud Router and dynamic routing should be considered to simplify failover operations.");
  }

  if (strategy === "interconnect") {
    observations.push("The environment may require predictable throughput or lower latency than internet-based connectivity can provide.");
    observations.push("Large data transfer or branch dependency can justify dedicated connectivity evaluation.");
    observations.push("Commercial impact and service provider availability should be validated early.");
  }

  if (fit.complexity >= 65) observations.push("Hybrid architecture complexity is relatively high and should be designed with clear routing and segmentation boundaries.");
  if (fit.resiliency >= 65) observations.push("Availability and failover expectations are significant and should be validated before production rollout.");
  if (fit.cost >= 70) observations.push("Cost sensitivity is high; avoid over-engineering the connectivity design unless business criticality requires it.");

  return observations;
}

function updateResults(result) {
  document.getElementById("strategyText").textContent = result.strategy;

  const badge = document.getElementById("maturityBadge");
  badge.textContent = result.badge;
  badge.style.background = result.badgeBg;
  badge.style.color = result.badgeColor;

  document.getElementById("summaryText").textContent = result.summary;
  document.getElementById("whyText").textContent = result.why;
  document.getElementById("architectureText").textContent = result.architecture;
  document.getElementById("nextStepText").textContent = result.nextStep;

  const observationsList = document.getElementById("observationsList");
  observationsList.innerHTML = "";
  result.observations.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    observationsList.appendChild(li);
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
  document.getElementById("maturityBadge").textContent = "Not Generated";
  document.getElementById("summaryText").textContent = "Complete the advisor to generate a recommendation.";
  document.getElementById("whyText").textContent = "";
  document.getElementById("observationsList").innerHTML = "";
  document.getElementById("architectureText").textContent = "";
  document.getElementById("nextStepText").textContent = "";
  document.getElementById("results").style.display = "none";

  window.scrollTo({ top: document.getElementById("advisor").offsetTop - 90, behavior: "smooth" });
}
