document.addEventListener("DOMContentLoaded", () => {
  const btnGenerate = document.getElementById("btnGenerate");
  const btnReset = document.getElementById("btnReset");
  const btnResetResult = document.getElementById("btnResetResult");
  const btnPrint = document.getElementById("btnPrint");

  if (btnGenerate) btnGenerate.addEventListener("click", calculateConnectivity);
  if (btnReset) btnReset.addEventListener("click", resetConnectivity);
  if (btnResetResult) btnResetResult.addEventListener("click", resetConnectivity);
  if (btnPrint) btnPrint.addEventListener("click", () => window.print());
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseScore(value) {
  const scores = {
    vpn: 0,
    interconnect: 0,
    complexity: 0,
    resiliency: 0,
    maturity: 0
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

function getLevel(score, type) {
  if (type === "complexity") {
    if (score < 35) return "Low";
    if (score < 70) return "Moderate";
    return "High";
  }

  if (score < 35) return "Basic";
  if (score < 65) return "Developing";
  if (score < 85) return "Advanced";
  return "Enterprise-Grade";
}

function calculateConnectivity() {
  const form = document.getElementById("connectivityForm");
  const selects = form.querySelectorAll("select");
  const globalError = document.getElementById("globalError");

  let completed = true;
  let vpnRaw = 0;
  let interconnectRaw = 0;
  let complexityRaw = 0;
  let resiliencyRaw = 0;
  let maturityRaw = 0;

  selects.forEach(select => {
    if (select.value === "") {
      completed = false;
      select.classList.add("error-field");
    } else {
      select.classList.remove("error-field");
      const score = parseScore(select.value);
      vpnRaw += score.vpn;
      interconnectRaw += score.interconnect;
      complexityRaw += score.complexity;
      resiliencyRaw += score.resiliency;
      maturityRaw += score.maturity;
    }
  });

  if (!completed) {
    globalError.style.display = "block";
    window.scrollTo({ top: form.offsetTop - 70, behavior: "smooth" });
    return;
  }

  globalError.style.display = "none";

  const vpnFit = clamp(Math.round(((vpnRaw + 10) / 285) * 100), 0, 100);
  const interconnectFit = clamp(Math.round(((interconnectRaw + 10) / 385) * 100), 0, 100);
  const complexityScore = clamp(Math.round((complexityRaw / 280) * 100), 0, 100);
  const resiliencyScore = clamp(Math.round((resiliencyRaw / 280) * 100), 0, 100);
  const maturityScore = clamp(Math.round((maturityRaw / 275) * 100), 0, 100);

  const recommendedStrategy = determineStrategy(vpnFit, interconnectFit, complexityScore, resiliencyScore, maturityScore);
  const maturityLevel = getLevel(maturityScore);
  const complexityLevel = getLevel(complexityScore, "complexity");
  const resiliencyLevel = getLevel(resiliencyScore);

  let badgeBg = "";
  let badgeColor = "";
  let architecture = "";
  let meaning = "";
  let nextStep = "";

  if (recommendedStrategy === "HA VPN") {
    badgeBg = "rgba(16, 185, 129, 0.16)";
    badgeColor = "#10b981";
    architecture = "Simple HA VPN-based hybrid connectivity with Cloud Router and redundant VPN tunnels where availability is required.";
    meaning = "Your environment appears suitable for a practical VPN-led hybrid connectivity approach. This is appropriate when bandwidth demand is manageable, operational simplicity is important, and the organization is still developing its cloud networking maturity.";
    nextStep = "Run a hybrid connectivity workshop to validate VPN sizing, routing design, ISP redundancy, HA tunnel design, and operational ownership.";
  } else if (recommendedStrategy === "Partner Interconnect") {
    badgeBg = "rgba(59, 130, 246, 0.16)";
    badgeColor = "#60a5fa";
    architecture = "Partner Interconnect with redundant attachments, Cloud Router, and structured hybrid routing between on-premise networks and Google Cloud.";
    meaning = "Your environment shows a stronger need for predictable throughput, better download performance, lower latency exposure, and more resilient hybrid cloud connectivity than a simple internet-based VPN model can comfortably provide.";
    nextStep = "Assess partner availability, bandwidth requirement, traffic pattern, routing model, redundancy design, and commercial feasibility for Partner Interconnect.";
  } else if (recommendedStrategy === "Dedicated Interconnect") {
    badgeBg = "rgba(139, 92, 246, 0.16)";
    badgeColor = "#a78bfa";
    architecture = "Dedicated Interconnect or highly resilient interconnect architecture with redundant links, Cloud Router, and enterprise-grade routing governance.";
    meaning = "Your environment indicates high-scale hybrid connectivity needs, strong resiliency expectations, heavy data movement, or business-critical performance requirements. A dedicated connectivity model may be more suitable than shared or internet-based options.";
    nextStep = "Conduct a detailed network discovery and interconnect feasibility study covering bandwidth, colocation access, redundancy, routing, SLA expectations, and operational support.";
  } else {
    badgeBg = "rgba(245, 158, 11, 0.16)";
    badgeColor = "#f59e0b";
    architecture = "Phased hybrid connectivity strategy starting with HA VPN, followed by interconnect evaluation as traffic, resiliency, and cloud adoption grow.";
    meaning = "Your environment shows mixed signals. It may not require immediate interconnect adoption, but growing cloud usage, branch dependency, DR requirements, or download performance expectations should be planned carefully.";
    nextStep = "Start with a connectivity baseline assessment, validate current traffic patterns, and define a 6–12 month roadmap for hybrid connectivity evolution.";
  }

  const observations = buildObservations(vpnFit, interconnectFit, complexityScore, resiliencyScore, maturityScore, recommendedStrategy);

  document.getElementById("strategyTitle").textContent = recommendedStrategy;

  const badge = document.getElementById("statusBadge");
  badge.textContent = `${maturityLevel} Hybrid Maturity`;
  badge.style.background = badgeBg;
  badge.style.color = badgeColor;

  document.getElementById("strategySummary").textContent =
    `This environment shows ${maturityLevel.toLowerCase()} hybrid connectivity maturity, ${complexityLevel.toLowerCase()} operational complexity, and ${resiliencyLevel.toLowerCase()} resiliency requirement based on environment, traffic, download, cloud integration, operations, and availability inputs.`;

  document.getElementById("vpnPercent").textContent = vpnFit + "%";
  document.getElementById("interconnectPercent").textContent = interconnectFit + "%";
  document.getElementById("resiliencyPercent").textContent = resiliencyScore + "%";
  document.getElementById("complexityPercent").textContent = complexityScore + "%";

  document.getElementById("vpnBar").style.width = vpnFit + "%";
  document.getElementById("interconnectBar").style.width = interconnectFit + "%";
  document.getElementById("resiliencyBar").style.width = resiliencyScore + "%";
  document.getElementById("complexityBar").style.width = complexityScore + "%";

  document.getElementById("maturityText").textContent = `${maturityLevel} — The organization has a ${maturityLevel.toLowerCase()} level of readiness for hybrid cloud connectivity operations.`;
  document.getElementById("architectureText").textContent = architecture;
  document.getElementById("meaningText").textContent = meaning;
  document.getElementById("nextStepText").textContent = nextStep;

  const observationsList = document.getElementById("observationsList");
  observationsList.innerHTML = "";
  observations.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item;
    observationsList.appendChild(li);
  });

  document.getElementById("results").style.display = "block";

  window.scrollTo({
    top: document.getElementById("results").offsetTop - 90,
    behavior: "smooth"
  });
}

function determineStrategy(vpnFit, interconnectFit, complexityScore, resiliencyScore, maturityScore) {
  if (interconnectFit >= 78 && resiliencyScore >= 70 && maturityScore >= 65) {
    return "Dedicated Interconnect";
  }

  if (interconnectFit >= 62 && (resiliencyScore >= 55 || complexityScore >= 60)) {
    return "Partner Interconnect";
  }

  if (vpnFit >= interconnectFit && complexityScore < 65) {
    return "HA VPN";
  }

  return "Phased Hybrid Connectivity";
}

function buildObservations(vpnFit, interconnectFit, complexityScore, resiliencyScore, maturityScore, recommendedStrategy) {
  const observations = [];

  if (interconnectFit >= 60) {
    observations.push("The environment shows meaningful demand for predictable bandwidth, stable performance, or heavier cloud-to-on-premise data movement.");
  }

  if (vpnFit >= 60 && interconnectFit < 60) {
    observations.push("HA VPN may provide a practical starting point if bandwidth demand and latency sensitivity remain manageable.");
  }

  if (complexityScore >= 65) {
    observations.push("Hybrid network complexity is increasing, so routing governance, segmentation, and operational ownership should be clearly defined.");
  } else if (complexityScore < 35) {
    observations.push("Connectivity complexity appears relatively low, which makes a simpler hybrid architecture more realistic at this stage.");
  }

  if (resiliencyScore >= 70) {
    observations.push("High resiliency expectations indicate the need for redundant connectivity, failover planning, and clear recovery validation.");
  }

  if (maturityScore < 45 && recommendedStrategy !== "HA VPN") {
    observations.push("Operational maturity may need improvement before adopting a more complex interconnect-based architecture.");
  }

  if (recommendedStrategy === "Phased Hybrid Connectivity") {
    observations.push("A phased approach can reduce risk by starting with immediate connectivity needs while preparing for future interconnect adoption.");
  }

  if (observations.length < 3) {
    observations.push("Cloud connectivity design should be validated against real traffic volume, application dependency, and business continuity requirements.");
  }

  return observations;
}

function resetConnectivity() {
  const form = document.getElementById("connectivityForm");
  form.reset();

  const globalError = document.getElementById("globalError");
  globalError.style.display = "none";

  const selects = form.querySelectorAll("select");
  selects.forEach(select => select.classList.remove("error-field"));

  document.getElementById("strategyTitle").textContent = "Pending";
  document.getElementById("statusBadge").textContent = "Complete Advisor";
  document.getElementById("statusBadge").style.background = "rgba(148, 163, 184, 0.16)";
  document.getElementById("statusBadge").style.color = "#cbd5e1";
  document.getElementById("strategySummary").textContent = "Complete the advisor to generate hybrid connectivity guidance.";

  document.getElementById("vpnPercent").textContent = "0%";
  document.getElementById("interconnectPercent").textContent = "0%";
  document.getElementById("resiliencyPercent").textContent = "0%";
  document.getElementById("complexityPercent").textContent = "0%";

  document.getElementById("vpnBar").style.width = "0%";
  document.getElementById("interconnectBar").style.width = "0%";
  document.getElementById("resiliencyBar").style.width = "0%";
  document.getElementById("complexityBar").style.width = "0%";

  document.getElementById("maturityText").textContent = "";
  document.getElementById("architectureText").textContent = "";
  document.getElementById("meaningText").textContent = "";
  document.getElementById("nextStepText").textContent = "";
  document.getElementById("observationsList").innerHTML = "";

  document.getElementById("results").style.display = "none";

  window.scrollTo({
    top: document.getElementById("advisor").offsetTop - 90,
    behavior: "smooth"
  });
}
