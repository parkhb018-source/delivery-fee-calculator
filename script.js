// ===== 플랫폼별 기본 수수료율 (수수료가 바뀌면 이 값만 고치면 됨) =====
// 배민1플러스·쿠팡이츠 상생요금제는 매출 상위 비율에 따라 2.0~7.8%로 차등 적용됨.
// 여기서는 "매출 상위 35%·신규 사장님" 구간(가장 흔한 기본 구간) 기준값을 사용.
// 부가세 10%는 별도로 붙으므로 실제 청구액은 아래 수수료율보다 조금 더 높을 수 있음.
const PLATFORM_RATES = {
  baemin:       { name: "배민",     brokerage: 7.8, payment: 3.0 },
  coupangeats:  { name: "쿠팡이츠", brokerage: 7.8, payment: 3.0 },
  yogiyo:       { name: "요기요",   brokerage: 9.7, payment: 3.0 },
  custom:       { name: "직접입력", brokerage: 0,   payment: 0   },
};

// ===== 숫자 입력 콤마 처리 =====
function toNumber(str) {
  const cleaned = String(str).replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function formatComma(str) {
  const cleaned = String(str).replace(/[^0-9]/g, "");
  if (cleaned === "") return "";
  return Number(cleaned).toLocaleString("ko-KR");
}

function bindCommaInput(input) {
  input.addEventListener("input", () => {
    const cursorFromEnd = input.value.length - input.selectionStart;
    input.value = formatComma(input.value);
    const pos = input.value.length - cursorFromEnd;
    input.setSelectionRange(pos, pos);
  });
}

document.querySelectorAll('#single-price, #single-cost, #single-delivery, #single-box, #single-wrap, #compare-price, #compare-cost, #compare-delivery, #compare-box, #compare-wrap, #reverse-cost, #reverse-box, #reverse-wrap, #reverse-delivery')
  .forEach(bindCommaInput);

// 화면에 보이는 금액은 항상 이 규칙으로 반올림됨 — 동점 판정 등 다른 곳에서도
// "화면에 보이는 값이 같은지"를 확인할 때는 이 함수를 기준으로 삼아야 함
function roundWon(n) {
  return Math.round(n);
}

function formatWon(n) {
  return roundWon(n).toLocaleString("ko-KR") + "원";
}

function getNum(id) {
  return toNumber(document.getElementById(id).value);
}

// 보이기/숨기기를 반복하는 토글 버튼(고급 옵션, 차감 내역 등) 공용 처리
// 버튼 클릭 없이 코드에서 직접 열어야 하는 경우(예: "직접입력" 선택 시)를 위해 open()도 함께 제공
function setupToggle(button, panel, openLabel, closeLabel) {
  function open() {
    panel.removeAttribute("hidden");
    button.textContent = closeLabel;
  }
  function close() {
    panel.setAttribute("hidden", "");
    button.textContent = openLabel;
  }
  button.addEventListener("click", () => {
    if (panel.hasAttribute("hidden")) open(); else close();
  });
  return { open, close };
}

// 입력값 비우기 + 플랫폼 선택 해제 + 결과 숨기기를 반복하는 초기화 버튼 공용 처리
function setupReset(button, { fields, platformPrefix, resultId }) {
  button.addEventListener("click", () => {
    fields.forEach(id => document.getElementById(id).value = "");
    if (platformPrefix) {
      document.querySelectorAll(`.platform-buttons[data-target="${platformPrefix}"] .platform-btn`)
        .forEach(b => b.classList.remove("active"));
    }
    document.getElementById(resultId).setAttribute("hidden", "");
  });
}

// ===== 탭 전환 =====
const tabButtons = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");
const platformCards = document.querySelectorAll(".platform-card");
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
    tabPanels.forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

// ===== 고급 옵션(수수료율) 토글 =====
// targetPrefix("single"/"reverse")별 토글 컨트롤러를 저장해 두면, 플랫폼 버튼처럼
// 다른 곳에서도 버튼 클릭을 흉내내지 않고 바로 panel.open()을 호출할 수 있음
const advancedToggles = {};
document.querySelectorAll(".advanced-toggle").forEach(toggle => {
  const panel = document.getElementById(`${toggle.dataset.target}-advanced`);
  advancedToggles[toggle.dataset.target] = setupToggle(toggle, panel, "수수료율 직접 수정 ▾", "수수료율 직접 수정 ▴");
});

// ===== 플랫폼 선택 버튼 =====
function setupPlatformButtons(targetPrefix) {
  const group = document.querySelector(`.platform-buttons[data-target="${targetPrefix}"]`);
  if (!group) return;
  const buttons = group.querySelectorAll(".platform-btn");
  const advancedToggle = advancedToggles[targetPrefix];
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const rates = PLATFORM_RATES[btn.dataset.platform];
      const brokerageInput = document.getElementById(`${targetPrefix}-rate-brokerage`);
      const paymentInput = document.getElementById(`${targetPrefix}-rate-payment`);
      if (brokerageInput) brokerageInput.value = rates.brokerage;
      if (paymentInput) paymentInput.value = rates.payment;

      // "직접입력"은 값을 눈으로 봐야 의미가 있으므로 수수료율 패널을 바로 펼쳐줌
      if (btn.dataset.platform === "custom" && advancedToggle) {
        advancedToggle.open();
        if (brokerageInput) brokerageInput.focus();
      }
    });
  });
}
setupPlatformButtons("single");
setupPlatformButtons("reverse");

// ===== 핵심 계산 함수 =====
function calcNet({ price, cost, delivery, box, wrap, brokerageRate, paymentRate }) {
  const brokerageFee = price * (brokerageRate / 100);
  const paymentFee = price * (paymentRate / 100);
  const totalDeduction = brokerageFee + paymentFee + delivery + box + wrap + cost;
  const net = price - totalDeduction;
  const rate = price > 0 ? (net / price) * 100 : 0;
  return { brokerageFee, paymentFee, net, rate };
}

// ========== 1단계: 단일 계산기 ==========
setupToggle(
  document.getElementById("single-details-toggle"),
  document.getElementById("single-breakdown"),
  "차감 내역 자세히 보기 ▾",
  "차감 내역 접기 ▴"
);

document.getElementById("single-calc-btn").addEventListener("click", () => {
  const price = getNum("single-price");
  const cost = getNum("single-cost");
  const delivery = getNum("single-delivery");
  const box = getNum("single-box");
  const wrap = getNum("single-wrap");
  const brokerageRate = getNum("single-rate-brokerage");
  const paymentRate = getNum("single-rate-payment");

  if (price <= 0) {
    alert("메뉴 판매가를 입력해 주세요.");
    return;
  }

  const { brokerageFee, paymentFee, net, rate } = calcNet({ price, cost, delivery, box, wrap, brokerageRate, paymentRate });

  document.getElementById("single-net-amount").textContent = formatWon(net);
  document.getElementById("single-net-rate").textContent = `순이익률 ${rate.toFixed(1)}%`;

  const breakdown = document.getElementById("single-breakdown");
  breakdown.innerHTML = `
    <li><span>판매가</span><span>${formatWon(price)}</span></li>
    <li><span>중개수수료</span><span class="negative">-${formatWon(brokerageFee)}</span></li>
    <li><span>결제수수료</span><span class="negative">-${formatWon(paymentFee)}</span></li>
    <li><span>배달비</span><span class="negative">-${formatWon(delivery)}</span></li>
    <li><span>용기값</span><span class="negative">-${formatWon(box)}</span></li>
    <li><span>포장비</span><span class="negative">-${formatWon(wrap)}</span></li>
    <li><span>음식원가</span><span class="negative">-${formatWon(cost)}</span></li>
    <li class="total"><span>남는 돈</span><span>${formatWon(net)}</span></li>
  `;

  document.getElementById("single-result").removeAttribute("hidden");
});

setupReset(document.getElementById("single-reset-btn"), {
  fields: ["single-price", "single-cost", "single-delivery", "single-box", "single-wrap", "single-rate-brokerage", "single-rate-payment"],
  platformPrefix: "single",
  resultId: "single-result",
});

// ========== 2단계: 플랫폼 비교 ==========
document.getElementById("compare-calc-btn").addEventListener("click", () => {
  const price = getNum("compare-price");
  const cost = getNum("compare-cost");
  const delivery = getNum("compare-delivery");
  const box = getNum("compare-box");
  const wrap = getNum("compare-wrap");

  if (price <= 0) {
    alert("메뉴 판매가를 입력해 주세요.");
    return;
  }

  const results = {};
  ["baemin", "coupangeats", "yogiyo"].forEach(key => {
    const rates = PLATFORM_RATES[key];
    results[key] = calcNet({
      price, cost, delivery, box, wrap,
      brokerageRate: rates.brokerage,
      paymentRate: rates.payment,
    });
  });

  // 화면에 보이는 반올림 금액 기준으로 동점 여부를 판단
  const maxNet = Math.max(...Object.values(results).map(r => roundWon(r.net)));
  const winnerKeys = Object.keys(results).filter(key => roundWon(results[key].net) === maxNet);
  const badgeLabel = winnerKeys.length > 1 ? "이득" : "가장 이득!";

  platformCards.forEach(card => {
    const key = card.dataset.platform;
    const r = results[key];
    card.querySelector(".pc-amount").textContent = formatWon(r.net);
    card.querySelector(".pc-rate").textContent = `순이익률 ${r.rate.toFixed(1)}%`;
    const badge = card.querySelector(".best-badge");
    if (winnerKeys.includes(key)) {
      card.classList.add("best");
      badge.textContent = badgeLabel;
      badge.removeAttribute("hidden");
    } else {
      card.classList.remove("best");
      badge.setAttribute("hidden", "");
    }
  });

  document.getElementById("compare-result").removeAttribute("hidden");
});

setupReset(document.getElementById("compare-reset-btn"), {
  fields: ["compare-price", "compare-cost", "compare-delivery", "compare-box", "compare-wrap"],
  resultId: "compare-result",
});

// ========== 3단계: 역산 계산기 ==========
document.getElementById("reverse-calc-btn").addEventListener("click", () => {
  const cost = getNum("reverse-cost");
  const box = getNum("reverse-box");
  const wrap = getNum("reverse-wrap");
  const delivery = getNum("reverse-delivery");
  const targetRatio = getNum("reverse-target-ratio");
  const brokerageRate = getNum("reverse-rate-brokerage");
  const paymentRate = getNum("reverse-rate-payment");

  if (targetRatio <= 0 || targetRatio >= 100) {
    alert("목표 원가율은 0~100% 사이로 입력해 주세요.");
    return;
  }

  // 목표 원가율 = 음식 원가 ÷ 판매가 이 되도록 판매가를 역산
  const rawPrice = cost / (targetRatio / 100);
  const price = Math.round(rawPrice / 100) * 100;

  const { net, rate } = calcNet({ price, cost, delivery, box, wrap, brokerageRate, paymentRate });

  document.getElementById("reverse-price").textContent = formatWon(price);
  document.getElementById("reverse-rate-info").textContent = `실제로 남는 돈 ${formatWon(net)} (순이익률 ${rate.toFixed(1)}%)`;

  document.getElementById("reverse-result").removeAttribute("hidden");
});

setupReset(document.getElementById("reverse-reset-btn"), {
  fields: ["reverse-cost", "reverse-box", "reverse-wrap", "reverse-delivery", "reverse-target-ratio", "reverse-rate-brokerage", "reverse-rate-payment"],
  platformPrefix: "reverse",
  resultId: "reverse-result",
});
