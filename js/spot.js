(function () {
  var holding = false;
  var following = false;
  var pointerId = null;
  var moved = false;
  var swallowClick = false;
  var lastX = 0;
  var lastY = 0;
  var BEAM_LIFT = 168;
  var LENS_GAP = 62;

  var bar = document.createElement("div");
  bar.className = "inventory";
  bar.innerHTML =
    '<p class="inventory-label">Inventory</p>' +
    '<button type="button" class="torch-slot" id="torch-slot" aria-label="Flashlight. Click to carry it over the words."></button>';
  document.body.appendChild(bar);

  var torch = document.createElement("div");
  torch.className = "torch is-docked";
  torch.id = "torch";
  torch.setAttribute("aria-hidden", "true");
  torch.innerHTML = '<span class="torch-lens"></span><span class="torch-grip"></span>';
  document.body.appendChild(torch);

  var beam = document.createElement("div");
  beam.className = "torch-beam";
  beam.id = "torch-beam";
  document.body.appendChild(beam);

  var slot = bar.querySelector("#torch-slot");

  function beamRadius() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue("--beam");
    var size = parseFloat(raw) * parseFloat(getComputedStyle(document.documentElement).fontSize);
    return size || 90;
  }

  function clearSpots() {
    document.querySelectorAll(".spot").forEach(function (spot) {
      spot.classList.remove("is-lit");
      spot.style.setProperty("--spot-x", "-20rem");
      spot.style.setProperty("--spot-y", "-20rem");
    });
  }

  function paintSpots(x, y) {
    var radius = beamRadius();
    document.querySelectorAll(".spot").forEach(function (spot) {
      var rect = spot.getBoundingClientRect();
      var near = x >= rect.left - radius && x <= rect.right + radius &&
        y >= rect.top - radius && y <= rect.bottom + radius;
      if (!near) {
        spot.classList.remove("is-lit");
        spot.style.setProperty("--spot-x", "-20rem");
        spot.style.setProperty("--spot-y", "-20rem");
        return;
      }
      spot.classList.add("is-lit");
      spot.style.setProperty("--spot-x", (x - rect.left) + "px");
      spot.style.setProperty("--spot-y", (y - rect.top) + "px");
    });
  }

  function placeTorch(beamX, beamY, lensY) {
    torch.style.left = beamX + "px";
    torch.style.top = (lensY - 13) + "px";
    beam.style.left = beamX + "px";
    beam.style.top = beamY + "px";
  }

  function dock() {
    var rect = slot.getBoundingClientRect();
    var x = rect.left + rect.width / 2;
    var y = rect.top + rect.height / 2;
    holding = false;
    following = false;
    pointerId = null;
    torch.classList.add("is-docked");
    torch.classList.remove("is-held");
    beam.classList.remove("is-on");
    document.body.classList.remove("is-holding");
    placeTorch(x, y, y + 13);
    clearSpots();
  }

  function hold(x, y) {
    lastX = x;
    lastY = y;
    var beamY = Math.max(52, y - BEAM_LIFT);
    var beamX = Math.min(window.innerWidth - 18, Math.max(18, x));
    torch.classList.remove("is-docked");
    torch.classList.add("is-held");
    beam.classList.add("is-on");
    document.body.classList.add("is-holding");
    placeTorch(beamX, beamY, beamY + LENS_GAP);
    paintSpots(beamX, beamY);
  }

  slot.addEventListener("pointerdown", function (event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    event.preventDefault();
    if (event.pointerType === "mouse") {
      following = true;
      moved = false;
      hold(event.clientX, event.clientY);
      return;
    }
    holding = true;
    moved = false;
    pointerId = event.pointerId;
    try { slot.setPointerCapture(event.pointerId); } catch (err) { /* synthetic pointers */ }
    hold(event.clientX, event.clientY);
  });

  window.addEventListener("pointermove", function (event) {
    if (following && event.pointerType === "mouse") {
      hold(event.clientX, event.clientY);
      return;
    }
    if (!holding || event.pointerId !== pointerId) return;
    if (Math.abs(event.movementX) + Math.abs(event.movementY) > 0) moved = true;
    hold(event.clientX, event.clientY);
  });

  window.addEventListener("pointerdown", function (event) {
    if (!following || event.pointerType !== "mouse" || event.button !== 0) return;
    swallowClick = true;
    event.preventDefault();
    event.stopPropagation();
    dock();
  }, true);

  window.addEventListener("click", function (event) {
    if (!swallowClick) return;
    swallowClick = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);

  function drop(event) {
    if (following) return;
    if (!holding || (event && event.pointerId !== pointerId)) return;
    if (slot.hasPointerCapture && event && slot.hasPointerCapture(event.pointerId)) {
      slot.releasePointerCapture(event.pointerId);
    }
    dock();
  }

  slot.addEventListener("pointerup", drop);
  slot.addEventListener("pointercancel", drop);

  slot.addEventListener("click", function (event) {
    if (!moved) return;
    event.preventDefault();
    event.stopPropagation();
  });

  window.addEventListener("touchmove", function (event) {
    if (holding) event.preventDefault();
  }, { passive: false });

  window.addEventListener("resize", function () {
    if (following || holding) hold(lastX, lastY);
    else dock();
  });

  window.addEventListener("scroll", function () {
    if (following || holding) hold(lastX, lastY);
    else dock();
  }, true);

  dock();
  requestAnimationFrame(function () {
    torch.classList.add("can-slide");
  });
})();
